"""
Upload Service  —  port 8001

Endpoints
---------
POST /uploadData      – Store images to GridFS, create row_data doc, enqueue classification.
POST /uploadClassify  – Store images, trigger immediate classification, poll and return results.
POST /demoClassify    – Forward images to Classify Service, return annotated results (no DB writes).
"""

import asyncio
import io
import logging
import os
import sys
from contextlib import asynccontextmanager

import httpx
from bson import ObjectId
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pymongo import ReturnDocument

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.config import CLASSIFY_SERVICE_URL, CORS_ORIGINS, make_ts_key
from shared.db import close_db, get_db, get_gridfs_bucket, ping_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("upload_service")

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    ok = await ping_db()
    logger.info("MongoDB connection: %s", "ok" if ok else "FAILED")
    yield
    await close_db()
    logger.info("Upload Service shutdown complete.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Upload Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _store_images_to_gridfs(
    image_files: list[UploadFile],
    greenhouse_row: int,
    distance: float,
    timestamp: str,
    image_type: str = "original",
) -> list[str]:
    """
    Upload a list of UploadFile objects to GridFS.

    Each file is tagged with metadata conforming to the GridFS bucket schema:
      { greenhouse_row, distanceFromRowStart, timestamp, image_type, image_index }

    Returns a list of GridFS file_id strings (one per uploaded image).
    """
    bucket = get_gridfs_bucket()
    file_ids: list[str] = []

    for idx, upload in enumerate(image_files):
        data = await upload.read()
        filename = (
            f"{image_type}_{greenhouse_row}_{distance}_{timestamp}_{idx}"
            f"_{upload.filename or 'image'}"
        )
        metadata = {
            "greenhouse_row": greenhouse_row,
            "distanceFromRowStart": distance,
            "timestamp": timestamp,
            "image_type": image_type,
            "image_index": idx,
        }
        fid = await bucket.upload_from_stream(
            filename,
            io.BytesIO(data),
            metadata=metadata,
        )
        file_ids.append(str(fid))
        logger.debug("Stored %s image %d → GridFS id=%s", image_type, idx, fid)

    return file_ids


async def _find_or_create_row_doc(
    greenhouse_row: int,
    distance: float,
) -> dict:
    """
    Atomically find or create the row_data document for the given
    (greenhouse_row, distanceFromRowStart) pair.
    Returns the full document (after upsert if needed).
    """
    collection = get_db()["row_data"]
    doc = await collection.find_one_and_update(
        {"greenhouse_row": greenhouse_row, "distanceFromRowStart": distance},
        {"$setOnInsert": {
            "greenhouse_row": greenhouse_row,
            "distanceFromRowStart": distance,
            "timestamps": {},
        }},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return doc


async def _create_timestamp_entry(
    doc_id: ObjectId,
    timestamp: str,
    original_image_ids: list[str],
) -> None:
    """
    Write a fresh timestamp entry into the row_data document.
    Initialises all classification fields to None / empty list.
    """
    collection = get_db()["row_data"]
    await collection.update_one(
        {"_id": doc_id},
        {"$set": {
            f"timestamps.{make_ts_key(timestamp)}": {
                "original_images":          original_image_ids,
                "tomato_annotated_images":  [],
                "flower_annotated_images":  [],
                "depth_images":             [],
                "tomato_classification":    None,
                "flower_classification":    None,
                "depth_analysis":           None,
            }
        }},
    )


# ---------------------------------------------------------------------------
# /uploadData
# ---------------------------------------------------------------------------

@app.post("/uploadData", status_code=202)
async def upload_data(
    timestamp: str = Form(...),
    greenhouse_row: int = Form(...),
    distanceFromRowStart: float = Form(...),
    images: list[UploadFile] = File(...),
):
    """
    Store images to GridFS, persist a timestamp entry in row_data,
    and asynchronously enqueue a classification job.
    """
    if len(images) < 2:
        raise HTTPException(status_code=400, detail="At least 2 images are required.")

    # 1. Find or create the row document
    doc = await _find_or_create_row_doc(greenhouse_row, distanceFromRowStart)
    doc_id: ObjectId = doc["_id"]

    # 2. Store images to GridFS
    try:
        file_ids = await _store_images_to_gridfs(
            images, greenhouse_row, distanceFromRowStart, timestamp, "original"
        )
    except Exception as exc:
        logger.exception("GridFS upload failed")
        raise HTTPException(status_code=500, detail=f"Image storage failed: {exc}") from exc

    # 3. Create timestamp entry
    await _create_timestamp_entry(doc_id, timestamp, file_ids)

    # 4. Enqueue classification job (fire-and-forget; don't block the response)
    enqueue_payload = {
        "document_id":        str(doc_id),
        "greenhouse_row":     greenhouse_row,
        "distanceFromRowStart": distanceFromRowStart,
        "timestamp":          timestamp,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{CLASSIFY_SERVICE_URL}/enqueue",
                json=enqueue_payload,
            )
            resp.raise_for_status()
    except Exception as exc:
        # Non-fatal: the document is stored; the job can be re-queued manually.
        logger.warning("Failed to enqueue classification job: %s", exc)

    logger.info(
        "uploadData ok: row=%s dist=%s ts=%s doc_id=%s images=%d",
        greenhouse_row, distanceFromRowStart, timestamp, doc_id, len(file_ids),
    )
    return {
        "status":      "queued",
        "document_id": str(doc_id),
        "image_ids":   file_ids,
        "timestamp":   timestamp,
    }


# ---------------------------------------------------------------------------
# /uploadClassify
# ---------------------------------------------------------------------------

@app.post("/uploadClassify")
async def upload_classify(
    timestamp: str = Form(...),
    greenhouse_row: int = Form(...),
    distanceFromRowStart: float = Form(...),
    images: list[UploadFile] = File(...),
):
    """
    Store images, trigger immediate (priority) classification via /classifyNow,
    then poll MongoDB until both classification fields are populated.
    Returns full classification results and annotated image GridFS IDs.
    """
    if len(images) < 2:
        raise HTTPException(status_code=400, detail="At least 2 images are required.")

    # 1 & 2. Find/create document + store images
    doc = await _find_or_create_row_doc(greenhouse_row, distanceFromRowStart)
    doc_id: ObjectId = doc["_id"]

    try:
        file_ids = await _store_images_to_gridfs(
            images, greenhouse_row, distanceFromRowStart, timestamp, "original"
        )
    except Exception as exc:
        logger.exception("GridFS upload failed")
        raise HTTPException(status_code=500, detail=f"Image storage failed: {exc}") from exc

    # 3. Create timestamp entry
    await _create_timestamp_entry(doc_id, timestamp, file_ids)

    # 4. Trigger immediate classification (skip queue)
    classify_payload = {
        "document_id":          str(doc_id),
        "greenhouse_row":       greenhouse_row,
        "distanceFromRowStart": distanceFromRowStart,
        "timestamp":            timestamp,
    }
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(
                f"{CLASSIFY_SERVICE_URL}/classifyNow",
                json=classify_payload,
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text
        raise HTTPException(status_code=502, detail=f"Classify Service error: {detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Classify Service: {exc}") from exc

    # 5. Poll MongoDB until both classification fields are written (max 120 s)
    collection = get_db()["row_data"]
    for attempt in range(120):
        await asyncio.sleep(1)
        fresh = await collection.find_one({"_id": doc_id})
        ts_entry = (fresh or {}).get("timestamps", {}).get(make_ts_key(timestamp), {})
        if ts_entry.get("tomato_classification") and ts_entry.get("flower_classification"):
            logger.info(
                "uploadClassify complete: doc=%s ts=%s (attempt %d)",
                doc_id, timestamp, attempt + 1,
            )
            return {
                "status":                    "complete",
                "document_id":               str(doc_id),
                "timestamp":                 timestamp,
                "original_image_ids":        file_ids,
                "tomato_annotated_ids":      ts_entry.get("tomato_annotated_images", []),
                "flower_annotated_ids":      ts_entry.get("flower_annotated_images", []),
                "tomato_classification":     ts_entry["tomato_classification"],
                "flower_classification":     ts_entry["flower_classification"],
            }

    raise HTTPException(
        status_code=504,
        detail="Classification did not complete within 120 seconds.",
    )


# ---------------------------------------------------------------------------
# /demoClassify
# ---------------------------------------------------------------------------

@app.post("/demoClassify")
async def demo_classify(images: list[UploadFile] = File(...)):
    """
    Forward images directly to the Classify Service (/classifyDirect).
    Nothing is stored in MongoDB or GridFS.
    Returns annotated images (base64) and classification summaries.
    """
    if len(images) < 1:
        raise HTTPException(status_code=400, detail="At least one image is required.")

    # Read all file bytes up front (UploadFile streams are single-pass)
    files_data: list[tuple[str, bytes, str]] = []
    for upload in images:
        data = await upload.read()
        content_type = upload.content_type or "image/jpeg"
        files_data.append((upload.filename or "image.jpg", data, content_type))

    # Forward to classify service as multipart
    try:
        multipart_files = [
            ("images", (fname, data, ctype))
            for fname, data, ctype in files_data
        ]
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(
                f"{CLASSIFY_SERVICE_URL}/classifyDirect",
                files=multipart_files,
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text
        raise HTTPException(status_code=502, detail=f"Classify Service error: {detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Classify Service: {exc}") from exc

    return resp.json()


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    db_ok = await ping_db()
    return {"status": "ok", "db": db_ok}
