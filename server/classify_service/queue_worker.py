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
import io
import logging
import os
import sys
from itertools import count

from bson import ObjectId

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.config import make_ts_key
from shared.db import get_db, get_gridfs_bucket
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


async def _store_images_to_gridfs(
    image_bytes_list: list[bytes],
    image_type: str,
    greenhouse_row: int,
    distance_from_row_start: float,
    timestamp: str,
) -> list[ObjectId]:
    """Upload annotated images to GridFS and return their file IDs."""
    bucket = get_gridfs_bucket()
    file_ids = []
    for idx, img_bytes in enumerate(image_bytes_list):
        metadata = {
            "greenhouse_row": greenhouse_row,
            "distanceFromRowStart": distance_from_row_start,
            "timestamp": timestamp,
            "image_type": image_type,
            "image_index": idx,
        }
        file_id = await bucket.upload_from_stream(
            f"{image_type}_{greenhouse_row}_{distance_from_row_start}_{timestamp}_{idx}.jpg",
            io.BytesIO(img_bytes),
            metadata=metadata,
        )
        file_ids.append(file_id)
    return file_ids


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

        # Run both classifiers in parallel
        tomato_result, flower_result = await asyncio.gather(
            _classifier.classify_tomatoes(image_bytes_list),
            _classifier.classify_flowers(image_bytes_list),
        )

        # Store annotated images to GridFS
        tomato_ids, flower_ids = await asyncio.gather(
            _store_images_to_gridfs(
                tomato_result["annotated_image_bytes"],
                "tomato_annotated",
                greenhouse_row, distance, timestamp,
            ),
            _store_images_to_gridfs(
                flower_result["annotated_image_bytes"],
                "flower_annotated",
                greenhouse_row, distance, timestamp,
            ),
        )

        # Remove raw bytes before storing classification data
        tomato_data = {k: v for k, v in tomato_result.items() if k != "annotated_image_bytes"}
        flower_data = {k: v for k, v in flower_result.items() if k != "annotated_image_bytes"}

        # Update MongoDB document
        ts_key = f"timestamps.{make_ts_key(timestamp)}"
        await collection.update_one(
            {"_id": ObjectId(doc_id_str)},
            {"$set": {
                f"{ts_key}.tomato_classification":    tomato_data,
                f"{ts_key}.flower_classification":    flower_data,
                f"{ts_key}.tomato_annotated_images":  [str(fid) for fid in tomato_ids],
                f"{ts_key}.flower_annotated_images":  [str(fid) for fid in flower_ids],
            }},
        )

        # Update daily trend aggregate for this timestamp's date
        await update_daily_trend(timestamp[:10])

        logger.info("Job complete: doc_id=%s ts=%s | tomatoes=%d flowers=%d",
                    doc_id_str, timestamp,
                    tomato_data["summary"]["total"],
                    flower_data["total_flowers"])

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
