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
import base64
import logging
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
)

logger = logging.getLogger("classifier")

# ---------------------------------------------------------------------------
# Module-level model state (loaded once at startup, held in memory)
# ---------------------------------------------------------------------------
tomato_model: YOLO | None = None
flower_model: YOLO | None = None

# Bounding-box colors (BGR for OpenCV)
_TOMATO_COLORS: dict[str, tuple[int, int, int]] = {
    "Ripe":      (0, 200,   0),   # green
    "Half_Ripe": (0, 200, 255),   # yellow
    "Unripe":    (0,   0, 220),   # red
}

_FLOWER_COLORS: dict[int, tuple[int, int, int]] = {
    0: (255, 100,   0),   # blue
    1: (255,   0, 150),   # purple-pink
    2: (0,   180, 255),   # orange
}


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


def _encode_image(img: np.ndarray) -> bytes:
    """Encode OpenCV BGR ndarray → JPEG bytes."""
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return buf.tobytes()


def _draw_box(
    img: np.ndarray,
    x1: float, y1: float, x2: float, y2: float,
    color: tuple[int, int, int],
    label: str,
) -> None:
    """Draw a filled-background label + bounding box on img (in-place)."""
    pt1 = (int(x1), int(y1))
    pt2 = (int(x2), int(y2))
    cv2.rectangle(img, pt1, pt2, color, 2)

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.5
    thickness = 1
    (tw, th), baseline = cv2.getTextSize(label, font, font_scale, thickness)

    text_y = max(int(y1) - 6, th + 4)
    bg_pt1 = (int(x1), text_y - th - 2)
    bg_pt2 = (int(x1) + tw + 2, text_y + baseline)
    cv2.rectangle(img, bg_pt1, bg_pt2, color, cv2.FILLED)

    text_color = (0, 0, 0) if sum(color) > 400 else (255, 255, 255)
    cv2.putText(img, label, (int(x1) + 1, text_y), font, font_scale, text_color, thickness)


# ---------------------------------------------------------------------------
# Sync inference implementations (run in thread-pool executor)
# ---------------------------------------------------------------------------

def _run_tomato_inference(image_bytes_list: list[bytes], conf_threshold: float = 0.25) -> dict:
    if tomato_model is None:
        raise RuntimeError("Tomato model not loaded — call load_models() first.")

    per_image: list[dict] = []
    annotated: list[bytes] = []
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

                color = _TOMATO_COLORS.get(label, (200, 200, 200))
                _draw_box(img, x1, y1, x2, y2, color, f"{label} {confidence:.2f}")

        per_image.append({
            "image_index": idx,
            "detections": img_detections,
            "summary": {
                "total": len(img_detections),
                "by_class": img_by_class,
            },
        })
        annotated.append(_encode_image(img))

    return {
        "images": per_image,
        "summary": {
            "total": sum(len(p["detections"]) for p in per_image),
            "by_class": agg_by_class,
        },
        "annotated_image_bytes": annotated,
    }


def _run_flower_inference(image_bytes_list: list[bytes], conf_threshold: float = 0.25) -> dict:
    if flower_model is None:
        raise RuntimeError("Flower model not loaded — call load_models() first.")

    per_image: list[dict] = []
    annotated: list[bytes] = []
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

                color = _FLOWER_COLORS.get(stage, (200, 200, 200))
                stage_name = FLOWER_CLASSES.get(stage, f"stage_{stage}")
                _draw_box(img, x1, y1, x2, y2, color, f"{stage_name} {confidence:.2f}")

        per_image.append({
            "image_index": idx,
            "flowers": img_flowers,
            "total_flowers": len(img_flowers),
            "stage_counts": img_stage_counts,
        })
        annotated.append(_encode_image(img))

    return {
        "images": per_image,
        "total_flowers": sum(p["total_flowers"] for p in per_image),
        "stage_counts": agg_stage_counts,
        "annotated_image_bytes": annotated,
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
    annotated: list[bytes] = []
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

        b64_str = resp.get("annotated_image_b64", resp.get("annotated_image", ""))
        annotated.append(base64.b64decode(b64_str) if b64_str else b"")

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
        "annotated_image_bytes": annotated,
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
    annotated: list[bytes] = []
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

        b64_str = resp.get("annotated_image_b64", resp.get("annotated_image", ""))
        annotated.append(base64.b64decode(b64_str) if b64_str else b"")

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
        "annotated_image_bytes": annotated,
    }


async def classify_depth(
    rgb_image: bytes,
    depth_image: bytes,
    tomato_detections: list[dict],
) -> dict:
    """
    [FUTURE] Depth analysis using Intel RealSense D435i.

    This function will:
      1. Accept an RGB image, an aligned RealSense D435i depth image (16-bit
         or float32 depth map), and the tomato bounding-box detections produced
         by classify_tomatoes().
      2. Map each RGB bounding box onto the aligned depth image to crop the
         corresponding depth region for that tomato.
      3. Sample depth values within the bounding box, filter outliers, and
         compute an estimated tomato radius → volume (sphere approximation or
         ellipsoid if width ≠ height).
      4. Annotate the depth image with bounding boxes and volume labels.
      5. Store the annotated depth image in GridFS with image_type="depth".
      6. Return a depth_analysis dict structured per the MongoDB schema:
         { "tomatoes": [{"bbox", "estimated_volume_cm3", "mean_depth_mm"}, ...] }
         to be saved under timestamps.<ts>.depth_analysis in the row_data doc.

    Args:
        rgb_image:         Raw bytes of the RGB frame.
        depth_image:       Raw bytes of the aligned D435i depth frame.
        tomato_detections: Output of classify_tomatoes()["detections"].

    Returns:
        dict: Depth analysis data per MongoDB schema.

    Raises:
        NotImplementedError: Always — depth analysis not yet implemented.
    """
    raise NotImplementedError("Depth analysis not yet implemented")
