"""
Results Service  —  port 8003

Endpoints
---------
GET /getSummaryResults              – Aggregate latest-timestamp data across all rows.
GET /getDetailedRowData?row=<int>   – Full data for every distance in a row (image URLs included).
GET /getImage/{file_id}             – Serve a GridFS image by file ID.
GET /getTrends                      – Stub; returns placeholder message.
"""

import logging
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

from bson import ObjectId
from bson.errors import InvalidId
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.config import CORS_ORIGINS
from shared.db import close_db, get_db, get_gridfs_bucket, ping_db
from shared.trends import recompute_all_trends, update_daily_trend

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("results_service")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _key_to_ts(key: str) -> str:
    """
    Reverse of make_ts_key: convert a sanitized MongoDB key back to an
    ISO 8601 timestamp string.

    '2026-03-13T12:00:00_000000' → '2026-03-13T12:00:00.000000'

    ISO 8601 timestamps never contain underscores, so this replace is safe.
    """
    return key.replace("_", ".")


def _latest_ts_key(timestamps: dict) -> str | None:
    """Return the lexicographically greatest key in a timestamps dict, or None."""
    if not timestamps:
        return None
    return max(timestamps.keys())


async def _read_gridfs_bytes(file_id_str: str) -> tuple[bytes, str]:
    """
    Download a GridFS file and return (bytes, content_type).
    Raises HTTPException(404) if not found, 400 if the ID is malformed.
    """
    try:
        oid = ObjectId(file_id_str)
    except InvalidId as exc:
        raise HTTPException(status_code=400, detail=f"Invalid file_id: {file_id_str}") from exc

    try:
        bucket = get_gridfs_bucket()
        stream = await bucket.open_download_stream(oid)
        data = await stream.read()
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Image not found: {file_id_str}") from exc

    # Infer content-type from the filename stored in GridFS
    filename: str = getattr(stream, "filename", "") or ""
    if filename.lower().endswith(".png"):
        ct = "image/png"
    else:
        ct = "image/jpeg"

    return data, ct


def _image_urls(file_ids: list) -> list[str]:
    """Convert a list of GridFS file_id strings/ObjectIds to /getImage/ URL paths."""
    return [f"/getImage/{fid}" for fid in file_ids]


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    ok = await ping_db()
    logger.info("MongoDB connection: %s", "ok" if ok else "FAILED")
    yield
    await close_db()
    logger.info("Results Service shutdown complete.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Results Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# GET /getSummaryResults
# ---------------------------------------------------------------------------

@app.get("/getSummaryResults")
async def get_summary_results():
    """
    Aggregate the latest-timestamp classification data across all row_data
    documents, restricted to locations whose latest timestamp falls within
    the last 6.99 days.  Image arrays are excluded — only counts and summaries.
    """
    collection = get_db()["row_data"]
    docs = await collection.find(
        {},
        {
            "greenhouse_row": 1,
            "distanceFromRowStart": 1,
            "timestamps": 1,
        },
    ).to_list(length=None)

    # Aggregation accumulators
    total_tomatoes: dict[str, int] = {"Ripe": 0, "Half_Ripe": 0, "Unripe": 0}
    total_flowers: dict[str, int] = {"0": 0, "1": 0, "2": 0}

    # Only include locations whose latest timestamp is within the last 6.99 days
    cutoff = datetime.now(timezone.utc) - timedelta(days=6.99)

    # Build per-row map: row_number → list of distance entries
    rows_map: dict[int, list[dict]] = {}

    for doc in docs:
        row_num: int = doc["greenhouse_row"]
        distance: float = doc["distanceFromRowStart"]
        timestamps: dict = doc.get("timestamps", {})

        ts_key = _latest_ts_key(timestamps)
        if ts_key is None:
            continue

        # Skip if latest timestamp is older than the cutoff
        try:
            ts_dt = datetime.fromisoformat(_key_to_ts(ts_key)).replace(tzinfo=timezone.utc)
            if ts_dt < cutoff:
                continue
        except ValueError:
            pass

        ts_entry = timestamps[ts_key]
        tomato_cls = ts_entry.get("tomato_classification")
        flower_cls = ts_entry.get("flower_classification")

        # Skip locations that haven't been classified yet
        if not tomato_cls or not flower_cls:
            continue

        tomato_summary = tomato_cls.get("summary", {})
        flower_stage_counts = flower_cls.get("stage_counts", {})

        # Accumulate greenhouse-wide totals
        by_class = tomato_summary.get("by_class", {})
        for label in ("Ripe", "Half_Ripe", "Unripe"):
            total_tomatoes[label] += by_class.get(label, 0)

        for stage_key in ("0", "1", "2"):
            total_flowers[stage_key] += flower_stage_counts.get(stage_key, 0)

        # Per-row distance entry
        distance_entry = {
            "distanceFromRowStart": distance,
            "latest_timestamp": _key_to_ts(ts_key),
            "tomato_summary": tomato_summary,
            "flower_summary": {
                "total_flowers":  flower_cls.get("total_flowers", 0),
                "stage_counts":   flower_stage_counts,
            },
        }
        rows_map.setdefault(row_num, []).append(distance_entry)

    # Sort distances within each row; sort rows by row number
    rows = [
        {
            "greenhouse_row": row_num,
            "distances": sorted(entries, key=lambda e: e["distanceFromRowStart"]),
        }
        for row_num, entries in sorted(rows_map.items())
    ]

    return {
        "total_tomatoes":      total_tomatoes,
        "total_flowers":       total_flowers,
        "total_tomato_count":  sum(total_tomatoes.values()),
        "total_flower_count":  sum(total_flowers.values()),
        "rows":                rows,
    }


# ---------------------------------------------------------------------------
# GET /getDetailedRowData
# ---------------------------------------------------------------------------

@app.get("/getDetailedRowData")
async def get_detailed_row_data(row: int = Query(..., description="Greenhouse row number")):
    """
    Return full classification data and image URLs for every distance point
    in the requested row, sorted by distanceFromRowStart.
    """
    collection = get_db()["row_data"]
    docs = await collection.find(
        {"greenhouse_row": row}
    ).to_list(length=None)

    if not docs:
        raise HTTPException(status_code=404, detail=f"No data found for row {row}.")

    distances: list[dict] = []

    for doc in sorted(docs, key=lambda d: d["distanceFromRowStart"]):
        timestamps: dict = doc.get("timestamps", {})
        latest_key = _latest_ts_key(timestamps)
        if latest_key is None:
            continue

        latest_entry = timestamps[latest_key]

        # Build all_timestamps sorted newest-first
        all_timestamps = []
        for ts_key in sorted(timestamps.keys(), reverse=True):
            ts_entry = timestamps[ts_key]
            all_timestamps.append({
                "timestamp":             _key_to_ts(ts_key),
                "tomato_classification": ts_entry.get("tomato_classification"),
                "flower_classification": ts_entry.get("flower_classification"),
                "images": {
                    "original":         _image_urls(ts_entry.get("original_images", [])),
                    "tomato_annotated": _image_urls(ts_entry.get("tomato_annotated_images", [])),
                    "flower_annotated": _image_urls(ts_entry.get("flower_annotated_images", [])),
                },
            })

        distance_entry = {
            "distanceFromRowStart":  doc["distanceFromRowStart"],
            "latest_timestamp":      _key_to_ts(latest_key),
            "tomato_classification": latest_entry.get("tomato_classification"),
            "flower_classification": latest_entry.get("flower_classification"),
            "images": {
                "original":         _image_urls(latest_entry.get("original_images", [])),
                "tomato_annotated": _image_urls(latest_entry.get("tomato_annotated_images", [])),
                "flower_annotated": _image_urls(latest_entry.get("flower_annotated_images", [])),
            },
            "all_timestamps": all_timestamps,
        }
        distances.append(distance_entry)

    return {
        "greenhouse_row": row,
        "distances": distances,
    }


# ---------------------------------------------------------------------------
# GET /getImage/{file_id}
# ---------------------------------------------------------------------------

@app.get("/getImage/{file_id}")
async def get_image(file_id: str):
    """Serve a GridFS image by its file ID."""
    data, content_type = await _read_gridfs_bytes(file_id)
    return Response(content=data, media_type=content_type)


# ---------------------------------------------------------------------------
# GET /getAllData
# ---------------------------------------------------------------------------

@app.get("/getAllData")
async def get_all_data():
    """
    Return every document in row_data with ALL timestamps/runs and image URLs.
    Used by the Ayush Testing tab to display raw DB contents.
    """
    collection = get_db()["row_data"]
    docs = await collection.find({}).to_list(length=None)

    result = []
    for doc in sorted(docs, key=lambda d: (d["greenhouse_row"], d["distanceFromRowStart"])):
        timestamps: dict = doc.get("timestamps", {})
        runs = []
        for ts_key in sorted(timestamps.keys()):
            ts_entry = timestamps[ts_key]
            runs.append({
                "timestamp": _key_to_ts(ts_key),
                "tomato_classification": ts_entry.get("tomato_classification"),
                "flower_classification": ts_entry.get("flower_classification"),
                "images": {
                    "original":         _image_urls(ts_entry.get("original_images", [])),
                    "tomato_annotated": _image_urls(ts_entry.get("tomato_annotated_images", [])),
                    "flower_annotated": _image_urls(ts_entry.get("flower_annotated_images", [])),
                },
            })
        result.append({
            "greenhouse_row":       doc["greenhouse_row"],
            "distanceFromRowStart": doc["distanceFromRowStart"],
            "runs":                 runs,
        })

    return {"documents": result}


# ---------------------------------------------------------------------------
# DELETE /deleteData
# ---------------------------------------------------------------------------

@app.delete("/deleteData")
async def delete_data(row: Optional[int] = Query(None, description="Row number to delete; omit to delete all rows")):
    """
    Delete row_data documents and their associated GridFS images.
    - If `row` is provided: delete only that row's document(s).
    - If `row` is omitted: delete ALL documents in row_data and ALL images in GridFS.
    """
    collection = get_db()["row_data"]
    bucket = get_gridfs_bucket()

    query = {"greenhouse_row": row} if row is not None else {}

    # Collect GridFS file IDs and affected dates before deletion
    docs = await collection.find(query, {"timestamps": 1}).to_list(length=None)

    file_ids: list[ObjectId] = []
    affected_dates: set[str] = set()

    for doc in docs:
        for ts_key, ts_entry in doc.get("timestamps", {}).items():
            affected_dates.add(ts_key[:10])  # extract YYYY-MM-DD
            for field in ("original_images", "tomato_annotated_images", "flower_annotated_images", "depth_images"):
                for fid in ts_entry.get(field, []):
                    try:
                        file_ids.append(ObjectId(str(fid)))
                    except Exception:
                        pass

    # Delete all referenced GridFS files
    for fid in file_ids:
        try:
            await bucket.delete(fid)
        except Exception:
            pass  # Already gone or never stored — continue

    # Delete the row_data documents
    result = await collection.delete_many(query)

    # Recompute (or remove) daily_trends for every affected date
    for date_str in affected_dates:
        await update_daily_trend(date_str)

    scope = f"row {row}" if row is not None else "all rows"
    return {
        "deleted_documents": result.deleted_count,
        "deleted_images": len(file_ids),
        "scope": scope,
        "trend_dates_updated": sorted(affected_dates),
    }


# ---------------------------------------------------------------------------
# GET /getTrends
# ---------------------------------------------------------------------------

@app.get("/getTrends")
async def get_trends():
    """
    Return all documents from the daily_trends collection, sorted by date ascending.
    Each document represents one day's aggregated classification results.
    Returns an empty list if no trend data has been computed yet.
    """
    docs = await get_db()["daily_trends"].find(
        {}, {"_id": 0}
    ).sort("date", 1).to_list(length=None)

    return {"data": docs, "count": len(docs)}


# ---------------------------------------------------------------------------
# POST /recomputeTrends
# ---------------------------------------------------------------------------

@app.post("/recomputeTrends")
async def recompute_trends():
    """
    Rebuild the entire daily_trends collection from scratch by scanning all
    row_data documents.  Useful after bulk imports or data corrections.
    Returns the list of dates that were processed.
    """
    dates = await recompute_all_trends()
    return {"status": "complete", "dates_processed": dates, "count": len(dates)}


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    db_ok = await ping_db()
    return {"status": "ok", "db": db_ok}
