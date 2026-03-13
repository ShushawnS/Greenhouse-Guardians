import os
from dotenv import load_dotenv

# Load server/.env (one level above this file's directory: shared/ → server/)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# MongoDB
MONGO_URI = os.environ["MONGO_URI"]           # required — must be in .env
DB_NAME = os.getenv("DB_NAME", "greenhouse_guardians")
GRIDFS_BUCKET_NAME = "images"

# Service URLs (for inter-service communication)
UPLOAD_SERVICE_URL = os.getenv("UPLOAD_SERVICE_URL", "http://localhost:8001")
CLASSIFY_SERVICE_URL = os.getenv("CLASSIFY_SERVICE_URL", "http://localhost:8002")
RESULTS_SERVICE_URL = os.getenv("RESULTS_SERVICE_URL", "http://localhost:8003")

# Model paths (local cache)
MODELS_DIR = os.getenv(
    "MODELS_DIR",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "models"),
)
TOMATO_MODEL_PATH = os.path.join(MODELS_DIR, "ripeness_best.pt")
FLOWER_MODEL_PATH = os.path.join(MODELS_DIR, "best.pt")

# Hugging Face model repos
TOMATO_HF_REPO = "deenp03/tomato-ripeness-classifier"
TOMATO_HF_FILENAME = "ripeness_best.pt"
FLOWER_HF_REPO = "deenp03/tomato_pollination_stage_classifier"
FLOWER_HF_FILENAME = "best.pt"

# Classification classes
TOMATO_CLASSES = {0: "Unripe", 1: "Half_Ripe", 2: "Ripe"}
FLOWER_CLASSES = {0: "Stage_0", 1: "Stage_1", 2: "Stage_2"}


def make_ts_key(timestamp: str) -> str:
    """
    Sanitize an ISO timestamp for use as a MongoDB document key.

    MongoDB treats '.' as a field-path separator in $set dot notation, so a
    timestamp like '2026-03-13T12:00:00.000000' would be misinterpreted as a
    nested path.  Replace every '.' with '_' to produce a safe key while
    keeping the string unique and human-readable.

    Example:
        '2026-03-13T12:00:00.000000' → '2026-03-13T12:00:00_000000'
    """
    return timestamp.replace(".", "_")


# CORS origins
CORS_ORIGINS = [
    "http://localhost:5173",
    "*",
]
