"""
queue_worker.py — In-memory priority queue and background worker for
                  asynchronous classification jobs.

Usage
-----
From main.py lifespan:
    from queue_worker import classification_queue, start_worker

    worker_task = asyncio.create_task(start_worker())
    ...
    worker_task.cancel()

Enqueue a job:
    await classification_queue.put((priority_counter, job_dict))
"""

import asyncio
import logging
import os
import sys
from itertools import count

from bson import ObjectId

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.config import make_ts_key
from shared.db import get_db
from shared.trends import update_daily_trend

# imported lazily at worker start to avoid circular-import issues
import classifier as _classifier

logger = logging.getLogger("queue_worker")

# ---------------------------------------------------------------------------
# Queue — min-heap; lower value = higher priority.
# Items are (priority_int, job_dict) tuples.
# ---------------------------------------------------------------------------
classification_queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
_counter = count()  # monotonically increasing; gives FIFO within same priority


async def enqueue_job(
    document_id: str,
    greenhouse_row: int,
    distance_from_row_start: float,
    timestamp: str,
) -> None:
    """Add a classification job to the priority queue."""
    job = {
        "document_id": document_id,
        "greenhouse_row": greenhouse_row,
        "distanceFromRowStart": distance_from_row_start,
        "timestamp": timestamp,
    }
    priority = next(_counter)
    await classification_queue.put((priority, job))
    logger.info("Enqueued job: row=%s dist=%s ts=%s (priority=%d)",
                greenhouse_row, distance_from_row_start, timestamp, priority)


# ---------------------------------------------------------------------------
# Internal: GridFS helpers
# ---------------------------------------------------------------------------

async def _fetch_images_from_gridfs(file_ids: list) -> list[bytes]:
    """Download a list of GridFS file IDs and return their bytes."""
    bucket = get_gridfs_bucket()
    images = []
    for fid in file_ids:
        stream = await bucket.open_download_stream(ObjectId(str(fid)))
        data = await stream.read()
        images.append(data)
    return images



# ---------------------------------------------------------------------------
# Internal: process one job
# ---------------------------------------------------------------------------

async def _process_job(job: dict) -> None:
    doc_id_str: str = job["document_id"]
    greenhouse_row: int = job["greenhouse_row"]
    distance: float = job["distanceFromRowStart"]
    timestamp: str = job["timestamp"]

    logger.info("Processing job: doc_id=%s row=%s dist=%s ts=%s",
                doc_id_str, greenhouse_row, distance, timestamp)

    db = get_db()
    collection = db["row_data"]

    try:
        doc = await collection.find_one({"_id": ObjectId(doc_id_str)})
        if doc is None:
            logger.error("Document not found: %s", doc_id_str)
            return

        ts_entry = doc.get("timestamps", {}).get(make_ts_key(timestamp), {})
        original_ids = ts_entry.get("original_images", [])

        if not original_ids:
            logger.warning("No original images for doc=%s ts=%s", doc_id_str, timestamp)
            return

        image_bytes_list = await _fetch_images_from_gridfs(original_ids)

        # Fetch depth image and intrinsics if stored
        depth_ids = ts_entry.get("depth_images", [])
        depth_npy_bytes: bytes | None = None
        if depth_ids:
            depth_bytes_list = await _fetch_images_from_gridfs(depth_ids[:1])
            depth_npy_bytes = depth_bytes_list[0] if depth_bytes_list else None

        intrinsics = ts_entry.get("depth_intrinsics") or {}
        fx: float | None = intrinsics.get("fx")
        fy: float | None = intrinsics.get("fy")
        depth_scale: float | None = intrinsics.get("depth_scale")
        has_depth = depth_npy_bytes is not None

        # Run classifiers in parallel (depth classifier added when depth is present)
        coros: list = [
            _classifier.run_tomato_classification(image_bytes_list),
            _classifier.run_flower_classification(image_bytes_list),
        ]
        if has_depth:
            coros.append(_classifier.classify_depth(
                rgb_image_bytes=image_bytes_list[0],
                depth_npy_bytes=depth_npy_bytes,
                fx=fx, fy=fy, depth_scale=depth_scale,
            ))

        gathered = await asyncio.gather(*coros)
        tomato_result = gathered[0]
        flower_result = gathered[1]
        depth_result: dict | None = gathered[2] if has_depth else None

        # Update MongoDB document
        ts_key = f"timestamps.{make_ts_key(timestamp)}"
        update_fields: dict = {
            f"{ts_key}.tomato_classification": tomato_result,
            f"{ts_key}.flower_classification": flower_result,
        }
        if depth_result is not None:
            update_fields[f"{ts_key}.depth_analysis"] = depth_result

        await collection.update_one(
            {"_id": ObjectId(doc_id_str)},
            {"$set": update_fields},
        )

        # Update daily trend aggregate for this timestamp's date
        await update_daily_trend(timestamp[:10])

        logger.info(
            "Job complete: doc_id=%s ts=%s | tomatoes=%d flowers=%d depth=%s",
            doc_id_str, timestamp,
            tomato_result["summary"]["total"],
            flower_result["total_flowers"],
            f"{depth_result['total']} detected" if depth_result else "skipped",
        )

    except Exception:
        logger.exception("Error processing job doc_id=%s ts=%s", doc_id_str, timestamp)


# ---------------------------------------------------------------------------
# Background worker loop
# ---------------------------------------------------------------------------

async def start_worker() -> None:
    """
    Infinite asyncio loop that drains the classification queue.
    Start this as an asyncio.Task in the FastAPI lifespan handler.
    """
    logger.info("Background classification worker started.")
    while True:
        try:
            _priority, job = await classification_queue.get()
            await _process_job(job)
        except asyncio.CancelledError:
            logger.info("Worker cancelled — shutting down.")
            break
        except Exception:
            logger.exception("Unexpected error in worker loop.")
        finally:
            try:
                classification_queue.task_done()
            except ValueError:
                pass
