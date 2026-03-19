"""
Classify Service  —  port 8002

Endpoints
---------
POST /enqueue        – Add a job to the background priority queue.
POST /classifyNow    – Classify immediately (skip queue), save to MongoDB.
POST /classifyDirect – Classify immediately, return results + base64 images,
                       do NOT touch MongoDB.
"""

import asyncio
import base64
import io
import logging
import os
import sys
import time
from contextlib import asynccontextmanager

from bson import ObjectId
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.config import CORS_ORIGINS, make_ts_key
from shared.db import close_db, get_db, get_gridfs_bucket
from shared.trends import update_daily_trend

import classifier
from queue_worker import classification_queue, enqueue_job, start_worker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("classify_service")

# ---------------------------------------------------------------------------
# Lifespan: model loading + background worker
# ---------------------------------------------------------------------------

_worker_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _worker_task

    logger.info("Loading YOLOv8 models …")
    await asyncio.to_thread(classifier.load_models)
    logger.info("Models loaded.")

    _worker_task = asyncio.create_task(start_worker())
    logger.info("Background worker started.")

    yield

    if _worker_task:
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass

    await close_db()
    logger.info("Classify Service shutdown complete.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Classify Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class EnqueueRequest(BaseModel):
    document_id: str
    greenhouse_row: int
    distanceFromRowStart: float
    timestamp: str


class ClassifyNowRequest(BaseModel):
    document_id: str
    greenhouse_row: int
    distanceFromRowStart: float
    timestamp: str
    confidence_threshold: float = 0.25
    tomato_track: str = "remote"
    flower_track: str = "remote"


# ---------------------------------------------------------------------------
# Helpers shared by /classifyNow and the queue worker
# ---------------------------------------------------------------------------

async def _fetch_images_from_gridfs(file_ids: list) -> list[bytes]:
    bucket = get_gridfs_bucket()
    images = []
    for fid in file_ids:
        stream = await bucket.open_download_stream(ObjectId(str(fid)))
        data = await stream.read()
        images.append(data)
    return images


async def _store_images_to_gridfs(
    image_bytes_list: list[bytes],
    image_type: str,
    greenhouse_row: int,
    distance: float,
    timestamp: str,
) -> list[str]:
    bucket = get_gridfs_bucket()
    file_ids = []
    for idx, img_bytes in enumerate(image_bytes_list):
        metadata = {
            "greenhouse_row": greenhouse_row,
            "distanceFromRowStart": distance,
            "timestamp": timestamp,
            "image_type": image_type,
            "image_index": idx,
        }
        fid = await bucket.upload_from_stream(
            f"{image_type}_{greenhouse_row}_{distance}_{timestamp}_{idx}.jpg",
            io.BytesIO(img_bytes),
            metadata=metadata,
        )
        file_ids.append(str(fid))
    return file_ids


async def _classify_and_save(
    document_id: str,
    greenhouse_row: int,
    distance: float,
    timestamp: str,
    image_bytes_list: list[bytes],
    conf_threshold: float = 0.25,
    tomato_track: str | None = None,
    flower_track: str | None = None,
) -> dict:
    """
    Run both classifiers in parallel, persist annotated images to GridFS,
    and update the row_data document.  Returns the classification dicts.
    """
    tomato_result, flower_result = await asyncio.gather(
        classifier.run_tomato_classification(image_bytes_list, conf_threshold, track=tomato_track),
        classifier.run_flower_classification(image_bytes_list, conf_threshold, track=flower_track),
    )

    tomato_ids, flower_ids = await asyncio.gather(
        _store_images_to_gridfs(
            tomato_result["annotated_image_bytes"],
            "tomato_annotated", greenhouse_row, distance, timestamp,
        ),
        _store_images_to_gridfs(
            flower_result["annotated_image_bytes"],
            "flower_annotated", greenhouse_row, distance, timestamp,
        ),
    )

    tomato_data = {k: v for k, v in tomato_result.items() if k != "annotated_image_bytes"}
    flower_data = {k: v for k, v in flower_result.items() if k != "annotated_image_bytes"}

    ts_key = f"timestamps.{make_ts_key(timestamp)}"
    await get_db()["row_data"].update_one(
        {"_id": ObjectId(document_id)},
        {"$set": {
            f"{ts_key}.tomato_classification":   tomato_data,
            f"{ts_key}.flower_classification":   flower_data,
            f"{ts_key}.tomato_annotated_images": tomato_ids,
            f"{ts_key}.flower_annotated_images": flower_ids,
        }},
    )

    return {
        "tomato_classification": tomato_data,
        "flower_classification": flower_data,
        "tomato_annotated_image_ids": tomato_ids,
        "flower_annotated_image_ids": flower_ids,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/enqueue", status_code=202)
async def enqueue(req: EnqueueRequest):
    """
    Add a classification job to the background priority queue.
    Returns 202 Accepted immediately; processing happens asynchronously.
    """
    await enqueue_job(
        document_id=req.document_id,
        greenhouse_row=req.greenhouse_row,
        distance_from_row_start=req.distanceFromRowStart,
        timestamp=req.timestamp,
    )
    return {"status": "queued", "document_id": req.document_id}


@app.post("/classifyNow")
async def classify_now(req: ClassifyNowRequest):
    """
    Skip the queue and run classification immediately.
    Fetches original images from GridFS, classifies, saves results to MongoDB.
    """
    db = get_db()
    doc = await db["row_data"].find_one({"_id": ObjectId(req.document_id)})
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    ts_entry = doc.get("timestamps", {}).get(make_ts_key(req.timestamp), {})
    original_ids = ts_entry.get("original_images", [])
    if not original_ids:
        raise HTTPException(status_code=400, detail="No original images found for this timestamp.")

    image_bytes_list = await _fetch_images_from_gridfs(original_ids)

    t0 = time.perf_counter()
    results = await _classify_and_save(
        document_id=req.document_id,
        greenhouse_row=req.greenhouse_row,
        distance=req.distanceFromRowStart,
        timestamp=req.timestamp,
        image_bytes_list=image_bytes_list,
        conf_threshold=req.confidence_threshold,
        tomato_track=req.tomato_track,
        flower_track=req.flower_track,
    )
    total_ms = round((time.perf_counter() - t0) * 1000)

    # Update daily trend aggregate for this timestamp's date
    date_str = req.timestamp[:10]
    await update_daily_trend(date_str)

    logger.info("classifyNow complete: doc=%s ts=%s (%dms)", req.document_id, req.timestamp, total_ms)
    return {"status": "complete", **results, "timing_ms": {"total": total_ms}}


@app.post("/classifyDirect")
async def classify_direct(
    images: list[UploadFile] = File(...),
    confidence_threshold: float = Form(0.25),
    tomato_conf: float = Form(0.30),
    flower_conf: float = Form(0.25),
    tomato_track: str = Form("remote"),
    flower_track: str = Form("remote"),
):
    """
    Classify uploaded images without touching MongoDB.
    Track is selected per-request via tomato_track / flower_track form fields
    ("remote" or "local"), falling back to env var defaults.
    Returns a single flat result.
    """
    if len(images) < 1:
        raise HTTPException(status_code=400, detail="At least one image is required.")

    image_bytes_list = [await img.read() for img in images]

    async def timed(coro):
        t0 = time.perf_counter()
        result = await coro
        return result, round((time.perf_counter() - t0) * 1000)

    try:
        (tomato_result, t_ms), (flower_result, f_ms) = await asyncio.gather(
            timed(classifier.run_tomato_classification(image_bytes_list, tomato_conf, track=tomato_track)),
            timed(classifier.run_flower_classification(image_bytes_list, flower_conf, track=flower_track)),
        )
    except Exception as exc:
        logger.error("classifyDirect failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))

    def to_b64(byte_list):
        return [base64.b64encode(b).decode("utf-8") for b in byte_list]

    return {
        "tomato_classification": {
            "images": tomato_result["images"],
            "summary": tomato_result["summary"],
        },
        "flower_classification": {
            "images": flower_result["images"],
            "total_flowers": flower_result["total_flowers"],
            "stage_counts": flower_result["stage_counts"],
        },
        "annotated_images": {
            "tomato": to_b64(tomato_result["annotated_image_bytes"]),
            "flower": to_b64(flower_result["annotated_image_bytes"]),
        },
        "timing_ms": {"tomato_model": t_ms, "flower_model": f_ms},
        "tracks": {
            "tomato": tomato_track,
            "flower": flower_track,
        },
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models_loaded": {
            "tomato": classifier.tomato_model is not None,
            "flower": classifier.flower_model is not None,
        },
        "queue_size": classification_queue.qsize(),
    }
