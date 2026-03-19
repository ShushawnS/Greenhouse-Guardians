"""
classifier.py — YOLOv8 model loading, inference, and bounding-box annotation.

Public API
----------
load_models()          – Call once at service startup (sync).
classify_tomatoes()    – Async; returns detections + annotated image bytes.
classify_flowers()     – Async; returns flower data + annotated image bytes.
classify_depth()       – Stub; raises NotImplementedError (future work).
"""

import asyncio
import io
import logging
import math
import os
import sys

import cv2
import httpx
import numpy as np
from ultralytics import YOLO
from huggingface_hub import hf_hub_download

# Resolve shared/ relative to this file's parent directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.config import (
    TOMATO_MODEL_PATH,
    FLOWER_MODEL_PATH,
    TOMATO_HF_REPO,
    TOMATO_HF_FILENAME,
    FLOWER_HF_REPO,
    FLOWER_HF_FILENAME,
    TOMATO_CLASSES,
    FLOWER_CLASSES,
    MODELS_DIR,
    INFERENCE_SERVICE_URL,
    TOMATO_INFERENCE_TRACK,
    FLOWER_INFERENCE_TRACK,
)

logger = logging.getLogger("classifier")

# ---------------------------------------------------------------------------
# Module-level model state (loaded once at startup, held in memory)
# ---------------------------------------------------------------------------
tomato_model: YOLO | None = None
flower_model: YOLO | None = None


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

def load_models() -> None:
    """
    Load both YOLOv8 models into memory.

    Strategy:
      1. Try the local cache path (server/models/).
      2. If the file does not exist, download from Hugging Face and save
         to the cache directory.
      3. Assign to module-level globals so classifiers can use them.
    """
    global tomato_model, flower_model

    os.makedirs(MODELS_DIR, exist_ok=True)

    # -- Tomato ripeness model --
    if os.path.exists(TOMATO_MODEL_PATH):
        print(f"[classifier] Loading tomato model from cache: {TOMATO_MODEL_PATH}")
        tomato_model = YOLO(TOMATO_MODEL_PATH)
    else:
        print(f"[classifier] Downloading tomato model from HuggingFace ({TOMATO_HF_REPO}) …")
        local_path = hf_hub_download(
            repo_id=TOMATO_HF_REPO,
            filename=TOMATO_HF_FILENAME,
            local_dir=MODELS_DIR,
        )
        tomato_model = YOLO(local_path)
        print(f"[classifier] Tomato model saved to: {local_path}")

    # -- Flower pollination model --
    if os.path.exists(FLOWER_MODEL_PATH):
        print(f"[classifier] Loading flower model from cache: {FLOWER_MODEL_PATH}")
        flower_model = YOLO(FLOWER_MODEL_PATH)
    else:
        print(f"[classifier] Downloading flower model from HuggingFace ({FLOWER_HF_REPO}) …")
        local_path = hf_hub_download(
            repo_id=FLOWER_HF_REPO,
            filename=FLOWER_HF_FILENAME,
            local_dir=MODELS_DIR,
        )
        flower_model = YOLO(local_path)
        print(f"[classifier] Flower model saved to: {local_path}")

    print("[classifier] Both models ready.")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _decode_image(image_bytes: bytes) -> np.ndarray:
    """Decode raw image bytes → OpenCV BGR ndarray."""
    arr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)



# ---------------------------------------------------------------------------
# Sync inference implementations (run in thread-pool executor)
# ---------------------------------------------------------------------------

def _run_tomato_inference(image_bytes_list: list[bytes], conf_threshold: float = 0.25) -> dict:
    if tomato_model is None:
        raise RuntimeError("Tomato model not loaded — call load_models() first.")

    per_image: list[dict] = []
    agg_by_class: dict[str, int] = {"Ripe": 0, "Half_Ripe": 0, "Unripe": 0}

    for idx, img_bytes in enumerate(image_bytes_list):
        img = _decode_image(img_bytes)
        results = tomato_model(img, verbose=False, conf=conf_threshold)

        img_detections: list[dict] = []
        img_by_class: dict[str, int] = {"Ripe": 0, "Half_Ripe": 0, "Unripe": 0}

        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                class_id = int(box.cls[0])
                label = TOMATO_CLASSES.get(class_id, f"class_{class_id}")
                confidence = round(float(box.conf[0]), 4)
                x1, y1, x2, y2 = (round(float(v), 2) for v in box.xyxy[0])

                img_detections.append({
                    "class_id": class_id,
                    "label": label,
                    "confidence": confidence,
                    "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                })
                img_by_class[label] = img_by_class.get(label, 0) + 1
                agg_by_class[label] = agg_by_class.get(label, 0) + 1

        per_image.append({
            "image_index": idx,
            "detections": img_detections,
            "summary": {
                "total": len(img_detections),
                "by_class": img_by_class,
            },
        })

    return {
        "images": per_image,
        "summary": {
            "total": sum(len(p["detections"]) for p in per_image),
            "by_class": agg_by_class,
        },
    }


def _run_flower_inference(image_bytes_list: list[bytes], conf_threshold: float = 0.25) -> dict:
    if flower_model is None:
        raise RuntimeError("Flower model not loaded — call load_models() first.")

    per_image: list[dict] = []
    agg_stage_counts: dict[str, int] = {"0": 0, "1": 0, "2": 0}

    for idx, img_bytes in enumerate(image_bytes_list):
        img = _decode_image(img_bytes)
        results = flower_model(img, verbose=False, conf=conf_threshold)

        img_flowers: list[dict] = []
        img_stage_counts: dict[str, int] = {"0": 0, "1": 0, "2": 0}

        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                stage = int(box.cls[0])
                confidence = round(float(box.conf[0]), 4)
                x1, y1, x2, y2 = (round(float(v), 2) for v in box.xyxy[0])

                img_flowers.append({
                    "bounding_box": [x1, y1, x2, y2],
                    "stage": stage,
                    "confidence": confidence,
                })
                key = str(stage)
                img_stage_counts[key] = img_stage_counts.get(key, 0) + 1
                agg_stage_counts[key] = agg_stage_counts.get(key, 0) + 1

        per_image.append({
            "image_index": idx,
            "flowers": img_flowers,
            "total_flowers": len(img_flowers),
            "stage_counts": img_stage_counts,
        })

    return {
        "images": per_image,
        "total_flowers": sum(p["total_flowers"] for p in per_image),
        "stage_counts": agg_stage_counts,
    }


# ---------------------------------------------------------------------------
# Public async API
# ---------------------------------------------------------------------------

async def classify_tomatoes(image_bytes_list: list[bytes], conf_threshold: float = 0.25) -> dict:
    """
    Run tomato ripeness detection on a list of images.

    Each image is decoded, passed through the YOLOv8 model, and annotated
    with colored bounding boxes (green = Ripe, yellow = Half_Ripe, red = Unripe).

    Args:
        image_bytes_list: Raw bytes for each uploaded image.

    Returns:
        {
            "images": [
                {
                    "image_index": int,
                    "detections": [{"class_id", "label", "confidence", "bbox"}, ...],
                    "summary": {"total": int, "by_class": {"Ripe": int, ...}},
                },
                ...
            ],
            "summary": {"total": int, "by_class": {"Ripe": int, ...}},  # aggregate across all images
            "annotated_image_bytes": [bytes, ...],   # one per input image
        }
    """
    return await asyncio.to_thread(_run_tomato_inference, image_bytes_list, conf_threshold)


async def classify_flowers(image_bytes_list: list[bytes], conf_threshold: float = 0.25) -> dict:
    """
    Run flower pollination stage detection on a list of images.

    Each image is decoded, passed through the YOLOv8 model, and annotated
    with colored bounding boxes labeled by stage (0 / 1 / 2).

    Args:
        image_bytes_list: Raw bytes for each uploaded image.

    Returns:
        {
            "images": [
                {
                    "image_index": int,
                    "flowers": [{"bounding_box", "stage", "confidence"}, ...],
                    "total_flowers": int,
                    "stage_counts": {"0": int, "1": int, "2": int},
                },
                ...
            ],
            "total_flowers": int,       # aggregate across all images
            "stage_counts": {"0": int, "1": int, "2": int},  # aggregate across all images
            "annotated_image_bytes": [bytes, ...],
        }
    """
    return await asyncio.to_thread(_run_flower_inference, image_bytes_list, conf_threshold)


# ---------------------------------------------------------------------------
# Shared HTTP client for remote inference
# ---------------------------------------------------------------------------

_http_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=60.0)
    return _http_client


# ---------------------------------------------------------------------------
# Remote inference (external HF Space) — used by /classifyDirect
# ---------------------------------------------------------------------------

import json as _json


def _loggable(data: dict) -> dict:
    """Return a copy of the response dict with any base64 image fields truncated."""
    out = {}
    for k, v in data.items():
        if isinstance(v, str) and len(v) > 80:
            out[k] = v[:80] + f"…[{len(v)} chars]"
        elif isinstance(v, dict):
            out[k] = _loggable(v)
        else:
            out[k] = v
    return out


async def _call_remote_tomatoes(image_bytes: bytes, conf_threshold: float, idx: int) -> dict:
    """Call the remote /api/tomatoes endpoint for a single image."""
    client = get_http_client()
    response = await client.post(
        f"{INFERENCE_SERVICE_URL}/api/tomatoes",
        files={"file": (f"image_{idx}.jpg", image_bytes, "image/jpeg")},
        data={"tomato_conf": str(conf_threshold)},
    )
    response.raise_for_status()
    data = response.json()
    logger.info("━━ REMOTE TOMATOES RAW [img %d] ━━\n%s", idx, _json.dumps(_loggable(data), indent=2))
    return data


async def _call_remote_flowers(image_bytes: bytes, conf_threshold: float, idx: int) -> dict:
    """Call the remote /api/flowers endpoint for a single image."""
    client = get_http_client()
    response = await client.post(
        f"{INFERENCE_SERVICE_URL}/api/flowers",
        files={"file": (f"image_{idx}.jpg", image_bytes, "image/jpeg")},
        data={"flower_conf": str(conf_threshold)},
    )
    response.raise_for_status()
    data = response.json()
    logger.info("━━ REMOTE FLOWERS RAW [img %d] ━━\n%s", idx, _json.dumps(_loggable(data), indent=2))
    return data


async def classify_tomatoes_remote(
    image_bytes_list: list[bytes],
    conf_threshold: float = 0.30,
) -> dict:
    """
    Run tomato ripeness detection via the remote inference service.

    Calls /api/tomatoes once per image in parallel, then aggregates results.
    Annotated images are provided directly by the remote service as base64 strings.

    Returns the same shape as classify_tomatoes() with an additional
    "annotated_image_bytes" key containing decoded bytes for each image.
    """
    tasks = [
        _call_remote_tomatoes(img_bytes, conf_threshold, idx)
        for idx, img_bytes in enumerate(image_bytes_list)
    ]
    responses = await asyncio.gather(*tasks)

    per_image: list[dict] = []
    agg_by_class: dict[str, int] = {"Ripe": 0, "Half_Ripe": 0, "Unripe": 0}

    for idx, resp in enumerate(responses):
        # Remote API wraps results under a "tomatoes" key
        tomatoes_val = resp.get("tomatoes", resp)
        detections = tomatoes_val.get("detections", [])
        by_class: dict[str, int] = {"Ripe": 0, "Half_Ripe": 0, "Unripe": 0}
        for det in detections:
            label = det.get("label", "")
            by_class[label] = by_class.get(label, 0) + 1
            agg_by_class[label] = agg_by_class.get(label, 0) + 1

        per_image.append({
            "image_index": idx,
            "detections": detections,
            "summary": {"total": len(detections), "by_class": by_class},
        })

    total = sum(len(p["detections"]) for p in per_image)
    logger.info(
        "━━ REMOTE TOMATOES ━━  %d image(s)  |  %d detected  "
        "|  Ripe: %d  Half_Ripe: %d  Unripe: %d",
        len(per_image), total,
        agg_by_class["Ripe"], agg_by_class["Half_Ripe"], agg_by_class["Unripe"],
    )
    for p in per_image:
        logger.info(
            "  img %d → %d tomatoes  %s",
            p["image_index"], p["summary"]["total"],
            {k: v for k, v in p["summary"]["by_class"].items() if v > 0} or "none",
        )

    return {
        "images": per_image,
        "summary": {"total": total, "by_class": agg_by_class},
    }


async def classify_flowers_remote(
    image_bytes_list: list[bytes],
    conf_threshold: float = 0.25,
) -> dict:
    """
    Run flower pollination stage detection via the remote inference service.

    Calls /api/flowers once per image in parallel, then aggregates results.
    Annotated images are provided directly by the remote service as base64 strings.

    Returns the same shape as classify_flowers() with an additional
    "annotated_image_bytes" key containing decoded bytes for each image.
    """
    tasks = [
        _call_remote_flowers(img_bytes, conf_threshold, idx)
        for idx, img_bytes in enumerate(image_bytes_list)
    ]
    responses = await asyncio.gather(*tasks)

    per_image: list[dict] = []
    agg_stage_counts: dict[str, int] = {"0": 0, "1": 0, "2": 0}

    for idx, resp in enumerate(responses):
        if not isinstance(resp, dict):
            logger.error("[remote/flowers img=%d] unexpected response type %s: %r", idx, type(resp).__name__, resp)
            raise ValueError(f"Remote flower API returned non-dict for image {idx}: {resp!r}")

        # The remote API returns "flowers" as a nested summary dict, not a flat list.
        # Unwrap it: resp["flowers"]["flowers"] holds the actual detection list.
        flowers_val = resp.get("flowers")
        if isinstance(flowers_val, dict):
            raw_flowers = flowers_val.get("flowers", [])
        elif isinstance(flowers_val, list):
            raw_flowers = flowers_val
        elif isinstance(resp.get("detections"), list):
            raw_flowers = resp.get("detections")
        else:
            raw_flowers = []
            logger.warning("[remote/flowers img=%d] could not find flower detections in: %r", idx, resp)

        stage_counts: dict[str, int] = {"0": 0, "1": 0, "2": 0}
        normalized: list[dict] = []
        for f in raw_flowers:
            if not isinstance(f, dict):
                logger.warning("[remote/flowers img=%d] skipping non-dict flower item: %r", idx, f)
                continue
            stage = f.get("stage", f.get("class_id", 0))
            key = str(stage)
            stage_counts[key] = stage_counts.get(key, 0) + 1
            agg_stage_counts[key] = agg_stage_counts.get(key, 0) + 1
            bbox = f.get("bounding_box", f.get("bbox", []))
            if isinstance(bbox, dict):
                bbox = [bbox.get("x1", 0), bbox.get("y1", 0), bbox.get("x2", 0), bbox.get("y2", 0)]
            normalized.append({
                "bounding_box": bbox,
                "stage": stage,
                "confidence": f.get("confidence", 0.0),
            })

        per_image.append({
            "image_index": idx,
            "flowers": normalized,
            "total_flowers": len(normalized),
            "stage_counts": stage_counts,
        })

    total_flowers = sum(p["total_flowers"] for p in per_image)
    logger.info(
        "━━ REMOTE FLOWERS  ━━  %d image(s)  |  %d detected  "
        "|  Stage0: %s  Stage1: %s  Stage2: %s",
        len(per_image), total_flowers,
        agg_stage_counts["0"], agg_stage_counts["1"], agg_stage_counts["2"],
    )
    for p in per_image:
        logger.info(
            "  img %d → %d flowers  %s",
            p["image_index"], p["total_flowers"],
            {k: v for k, v in p["stage_counts"].items() if v > 0} or "none",
        )

    return {
        "images": per_image,
        "total_flowers": total_flowers,
        "stage_counts": agg_stage_counts,
    }


# ---------------------------------------------------------------------------
# Track-routing helpers — use these everywhere instead of calling local/remote
# directly.  The active track is controlled by TOMATO_INFERENCE_TRACK and
# FLOWER_INFERENCE_TRACK in shared/config.py (env vars).
# ---------------------------------------------------------------------------

async def run_tomato_classification(
    image_bytes_list: list[bytes],
    conf_threshold: float = 0.25,
    track: str | None = None,
) -> dict:
    """
    Dispatch tomato classification to the configured track (remote or local).
    The `track` argument overrides the TOMATO_INFERENCE_TRACK env var when provided.
    """
    effective = track if track in ("remote", "local") else TOMATO_INFERENCE_TRACK
    logger.info("tomato track=%s  images=%d", effective, len(image_bytes_list))
    if effective == "remote":
        return await classify_tomatoes_remote(image_bytes_list, conf_threshold)
    return await classify_tomatoes(image_bytes_list, conf_threshold)


async def run_flower_classification(
    image_bytes_list: list[bytes],
    conf_threshold: float = 0.25,
    track: str | None = None,
) -> dict:
    """
    Dispatch flower classification to the configured track (remote or local).
    The `track` argument overrides the FLOWER_INFERENCE_TRACK env var when provided.
    """
    effective = track if track in ("remote", "local") else FLOWER_INFERENCE_TRACK
    logger.info("flower track=%s  images=%d", effective, len(image_bytes_list))
    if effective == "remote":
        return await classify_flowers_remote(image_bytes_list, conf_threshold)
    return await classify_flowers(image_bytes_list, conf_threshold)


async def classify_depth(
    rgb_image_bytes: bytes,
    depth_npy_bytes: bytes | None = None,
    fx: float | None = None,
    fy: float | None = None,
    depth_scale: float | None = None,
    conf_threshold: float = 0.25,
) -> dict:
    """
    Depth analysis using the segmentation API + optional RealSense depth data.

    Calls the remote /api/segment endpoint to get polygon-based tomato detections
    from the RGB image, fits a minimum enclosing circle to each polygon, and
    optionally computes real-world radius + sphere volume using a depth array
    and pinhole camera model.

    Depth is fully optional: if depth_npy_bytes or camera intrinsics are absent,
    only pixel-space circle geometry is returned (depth/volume fields are None).

    Args:
        rgb_image_bytes:  Raw JPEG bytes of the RGB frame.
        depth_npy_bytes:  Raw bytes of a uint16 .npy depth array (H×W, units
                          per depth_scale). None to skip depth analysis.
        fx:               Camera focal length in pixels, x-axis.
        fy:               Camera focal length in pixels, y-axis.
        depth_scale:      Metres per depth unit (e.g. 0.001 for RealSense mm).
        conf_threshold:   Minimum confidence to keep a detection.

    Returns:
        {
            "tomatoes": [
                {
                    "id": int,
                    "label": str,
                    "confidence": float,
                    "center_px": [float, float],
                    "radius_px": float,
                    "depth_mm":   float | None,
                    "radius_cm":  float | None,
                    "volume_cm3": float | None,
                    "volume_mL":  float | None,
                }
            ],
            "depth_enabled": bool,
            "confidence_threshold": float,
            "total": int,
        }
    """
    # ── Step 1: Call segmentation API ──────────────────────────────────────
    client = get_http_client()
    try:
        response = await client.post(
            f"{INFERENCE_SERVICE_URL}/api/segment",
            files={"file": ("image.jpg", rgb_image_bytes, "image/jpeg")},
            timeout=90.0,
        )
        response.raise_for_status()
        seg_data = response.json()
    except Exception as exc:
        logger.error("Segmentation API call failed: %s", exc)
        raise

    raw_detections = seg_data.get("detections", [])

    # ── Step 2: Client-side confidence filtering ────────────────────────────
    detections = [d for d in raw_detections if d.get("confidence", 1.0) >= conf_threshold]
    logger.info(
        "classify_depth: %d raw detections → %d after conf≥%.2f filtering",
        len(raw_detections), len(detections), conf_threshold,
    )

    # ── Step 3: Load depth array (optional) ────────────────────────────────
    depth_array: np.ndarray | None = None
    has_intrinsics = fx is not None and fy is not None and depth_scale is not None

    if depth_npy_bytes is not None:
        try:
            depth_array = np.load(io.BytesIO(depth_npy_bytes), allow_pickle=False).astype(np.float32)
            # Replace zeros (missing/invalid sensor readings) with NaN
            depth_array[depth_array == 0] = np.nan
        except Exception as exc:
            logger.error("Failed to load depth .npy array: %s", exc)
            raise ValueError(f"Invalid depth array: {exc}") from exc

    depth_enabled = depth_array is not None and has_intrinsics

    # ── Step 4: Per-detection circle fit + optional depth extraction ────────
    results = []
    for idx, det in enumerate(detections):
        polygon = det.get("polygon", [])
        if len(polygon) < 1:
            logger.warning("classify_depth: detection %d has empty polygon, skipping", idx)
            continue

        pts = np.array(polygon, dtype=np.float32).reshape(-1, 1, 2)
        (cx, cy), radius_px = cv2.minEnclosingCircle(pts)
        cx, cy, radius_px = float(cx), float(cy), float(radius_px)

        entry: dict = {
            "id":         idx + 1,
            "label":      det.get("label", "unknown"),
            "confidence": round(det.get("confidence", 0.0), 4),
            "center_px":  [round(cx, 2), round(cy, 2)],
            "radius_px":  round(radius_px, 2),
            "depth_mm":   None,
            "radius_cm":  None,
            "volume_cm3": None,
            "volume_mL":  None,
            "weight_g":   None,
        }

        if depth_enabled:
            assert depth_array is not None  # narrowing for type checkers
            h, w = depth_array.shape

            # Circular mask centred on (cx, cy) with radius radius_px
            y_grid, x_grid = np.ogrid[:h, :w]
            mask = (x_grid - cx) ** 2 + (y_grid - cy) ** 2 <= radius_px ** 2

            depth_vals = depth_array[mask]
            valid = depth_vals[~np.isnan(depth_vals)]

            if len(valid) > 0:
                median_depth_units = float(np.median(valid))
                depth_m = median_depth_units * depth_scale  # type: ignore[operator]
                depth_mm = round(depth_m * 1000, 2)

                # Pinhole model: real-world radius from pixel radius and depth
                focal_px = (fx + fy) / 2.0  # type: ignore[operator]
                radius_m = radius_px * depth_m / focal_px
                radius_cm = round(radius_m * 100, 4)

                # Sphere volume: V = (4/3)πr³, convert m³ → cm³ (* 1e6)
                volume_cm3 = round((4.0 / 3.0) * math.pi * radius_m ** 3 * 1e6, 4)

                entry["depth_mm"]   = depth_mm
                entry["radius_cm"]  = radius_cm
                entry["volume_cm3"] = volume_cm3
                entry["volume_mL"]  = volume_cm3  # 1 cm³ ≈ 1 mL
                entry["weight_g"]   = round(volume_cm3 * 0.95, 4)  # density 0.95 g/cm³
            else:
                logger.warning(
                    "classify_depth: all depth values in mask for detection %d were NaN (occlusion?)", idx
                )

        results.append(entry)

    logger.info(
        "classify_depth complete: %d tomatoes  depth_enabled=%s",
        len(results), depth_enabled,
    )
    return {
        "tomatoes":            results,
        "depth_enabled":       depth_enabled,
        "confidence_threshold": conf_threshold,
        "total":               len(results),
    }
