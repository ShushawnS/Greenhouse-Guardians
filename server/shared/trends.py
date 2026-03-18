"""
trends.py — Shared utility for computing and persisting daily trend aggregates.

Collection: daily_trends
Schema per document:
{
    "date":               "YYYY-MM-DD",   # unique key
    "tomatoes": {
        "ripe":           int,
        "half_ripe":      int,
        "unripe":         int,
        "total":          int,
    },
    "flowers": {
        "stage_0":        int,
        "stage_1":        int,
        "stage_2":        int,
        "total":          int,
    },
    "estimated_yield_kg": float,          # weighted: ripe×1.0, half×0.8, unripe×0.5, 150g avg
    "scan_count":         int,            # number of classified timestamp entries on this date
    "location_count":     int,            # unique (row, distance) pairs scanned on this date
    "last_updated":       str,            # ISO timestamp of when this document was last written
}
"""

import logging
from datetime import datetime, timezone

from .db import get_db

logger = logging.getLogger("trends")

AVG_TOMATO_KG = 0.15


async def update_daily_trend(date_str: str) -> None:
    """
    Recompute and upsert the daily_trends document for a given YYYY-MM-DD date.

    Scans every row_data document for timestamp entries whose key starts with
    date_str (e.g. "2026-03-17"), sums classified results, and upserts a single
    daily_trends document.

    Only timestamp entries that have both tomato_classification AND
    flower_classification are included (i.e. fully classified scans).
    """
    db = get_db()
    docs = await db["row_data"].find(
        {},
        {"greenhouse_row": 1, "distanceFromRowStart": 1, "timestamps": 1},
    ).to_list(length=None)

    ripe = half_ripe = unripe = 0
    stage_0 = stage_1 = stage_2 = 0
    scan_count = 0
    seen_locations: set[tuple] = set()

    for doc in docs:
        for ts_key, ts_entry in doc.get("timestamps", {}).items():
            # ts_key format: "2026-03-17T12:00:00_000000"
            # The date portion is the first 10 characters.
            if not ts_key.startswith(date_str):
                continue

            tc = ts_entry.get("tomato_classification")
            fc = ts_entry.get("flower_classification")
            if not tc or not fc:
                continue  # skip unclassified entries

            bc = tc.get("summary", {}).get("by_class", {})
            ripe      += bc.get("Ripe",      0)
            half_ripe += bc.get("Half_Ripe", 0)
            unripe    += bc.get("Unripe",    0)

            sc = fc.get("stage_counts", {})
            stage_0 += int(sc.get("0", 0))
            stage_1 += int(sc.get("1", 0))
            stage_2 += int(sc.get("2", 0))

            scan_count += 1
            seen_locations.add((doc["greenhouse_row"], doc["distanceFromRowStart"]))

    total_tomatoes = ripe + half_ripe + unripe
    total_flowers  = stage_0 + stage_1 + stage_2
    yield_kg = round(
        (ripe * 1.0 + half_ripe * 0.8 + unripe * 0.5) * AVG_TOMATO_KG, 3
    )

    # If nothing classified exists for this date, remove the daily_trends document entirely
    if scan_count == 0:
        await db["daily_trends"].delete_one({"date": date_str})
        logger.info("daily_trends removed (no data): date=%s", date_str)
        return

    await db["daily_trends"].update_one(
        {"date": date_str},
        {"$set": {
            "date": date_str,
            "tomatoes": {
                "ripe":      ripe,
                "half_ripe": half_ripe,
                "unripe":    unripe,
                "total":     total_tomatoes,
            },
            "flowers": {
                "stage_0": stage_0,
                "stage_1": stage_1,
                "stage_2": stage_2,
                "total":   total_flowers,
            },
            "estimated_yield_kg": yield_kg,
            "scan_count":         scan_count,
            "location_count":     len(seen_locations),
            "last_updated":       datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    logger.info(
        "daily_trends updated: date=%s scans=%d tomatoes=%d flowers=%d yield=%.3f kg",
        date_str, scan_count, total_tomatoes, total_flowers, yield_kg,
    )


async def recompute_all_trends() -> list[str]:
    """
    Rebuild daily_trends for every date that appears in row_data.

    Collects all unique YYYY-MM-DD dates from timestamp keys, then calls
    update_daily_trend for each one.  Returns the sorted list of dates processed.
    """
    db = get_db()
    docs = await db["row_data"].find(
        {}, {"timestamps": 1}
    ).to_list(length=None)

    dates: set[str] = set()
    for doc in docs:
        for ts_key in doc.get("timestamps", {}).keys():
            # Extract YYYY-MM-DD (first 10 chars of the key)
            dates.add(ts_key[:10])

    for date_str in sorted(dates):
        await update_daily_trend(date_str)

    logger.info("recompute_all_trends complete: %d date(s) processed", len(dates))
    return sorted(dates)
