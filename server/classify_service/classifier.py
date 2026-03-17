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
import os
import sys

import cv2
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
)

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

    all_detections: list[dict] = []
    annotated: list[bytes] = []
    by_class: dict[str, int] = {"Ripe": 0, "Half_Ripe": 0, "Unripe": 0}

    for img_bytes in image_bytes_list:
        img = _decode_image(img_bytes)
        results = tomato_model(img, verbose=False, conf=conf_threshold)

        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                class_id = int(box.cls[0])
                label = TOMATO_CLASSES.get(class_id, f"class_{class_id}")
                confidence = round(float(box.conf[0]), 4)
                x1, y1, x2, y2 = (round(float(v), 2) for v in box.xyxy[0])

                all_detections.append({
                    "class_id": class_id,
                    "label": label,
                    "confidence": confidence,
                    "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                })
                by_class[label] = by_class.get(label, 0) + 1

                color = _TOMATO_COLORS.get(label, (200, 200, 200))
                _draw_box(img, x1, y1, x2, y2, color, f"{label} {confidence:.2f}")

        annotated.append(_encode_image(img))

    return {
        "detections": all_detections,
        "summary": {
            "total": len(all_detections),
            "by_class": by_class,
        },
        "annotated_image_bytes": annotated,
    }


def _run_flower_inference(image_bytes_list: list[bytes], conf_threshold: float = 0.25) -> dict:
    if flower_model is None:
        raise RuntimeError("Flower model not loaded — call load_models() first.")

    all_flowers: list[dict] = []
    annotated: list[bytes] = []
    stage_counts: dict[str, int] = {"0": 0, "1": 0, "2": 0}

    for img_bytes in image_bytes_list:
        img = _decode_image(img_bytes)
        results = flower_model(img, verbose=False, conf=conf_threshold)

        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                stage = int(box.cls[0])
                confidence = round(float(box.conf[0]), 4)
                x1, y1, x2, y2 = (round(float(v), 2) for v in box.xyxy[0])

                all_flowers.append({
                    "bounding_box": [x1, y1, x2, y2],
                    "stage": stage,
                    "confidence": confidence,
                })
                key = str(stage)
                stage_counts[key] = stage_counts.get(key, 0) + 1

                color = _FLOWER_COLORS.get(stage, (200, 200, 200))
                stage_name = FLOWER_CLASSES.get(stage, f"stage_{stage}")
                _draw_box(img, x1, y1, x2, y2, color, f"{stage_name} {confidence:.2f}")

        annotated.append(_encode_image(img))

    return {
        "flowers": all_flowers,
        "total_flowers": len(all_flowers),
        "stage_counts": stage_counts,
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
            "detections": [{"class_id", "label", "confidence", "bbox"}, ...],
            "summary": {"total": int, "by_class": {"Ripe": int, ...}},
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
            "flowers": [{"bounding_box", "stage", "confidence"}, ...],
            "total_flowers": int,
            "stage_counts": {"0": int, "1": int, "2": int},
            "annotated_image_bytes": [bytes, ...],
        }
    """
    return await asyncio.to_thread(_run_flower_inference, image_bytes_list, conf_threshold)


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
