# GreenhouseGuardians – Claude Code Project Prompt

## Project Overview

**GreenhouseGuardians** is a full-stack intelligence platform for tomato greenhouse operators. It allows users to upload images from greenhouse rows, automatically classify tomato ripeness and flower pollination stages using YOLOv8 models, and view summarized analytics through a clean dashboard UI.

---

## Architecture

```
                        ┌────────────────┐
  /uploadData ─────────►│                │
  /uploadClassify ─────►│ Upload Service │──────────┐
  /demoClassify ───────►│                │          │
                        └────────────────┘          │
                                                    ▼
  /getSummaryResults ──►┌─────────────────┐   ┌──────────┐   ┌──────────────────┐
  /getDetailedRowData ─►│ Results Service │◄──│ MongoDB  │◄──│ Classify Service │
  /getTrends ──────────►│                 │   └──────────┘   └──────────────────┘
                        └─────────────────┘
                                                    ▲
                                       ┌────────────────────────┐
                                       │ ML Inference Service   │
                                       │ (HF Space / local)     │
                                       └────────────────────────┘
```

The system consists of **three backend microservices**, an **optional external ML inference service**, and a **React frontend**:

| Component              | Tech                        | Port / Location                            |
| ---------------------- | --------------------------- | ------------------------------------------ |
| Upload Service         | Python (FastAPI)            | 8001                                       |
| Classify Service       | Python (FastAPI)            | 8002                                       |
| Results Service        | Python (FastAPI)            | 8003                                       |
| Frontend               | React + Vite                | 5173                                       |
| ML Inference Service   | FastAPI (HF Space / local)  | `INFERENCE_SERVICE_URL` env var            |

All services share a single MongoDB Atlas cluster. Use **FastAPI** for all backend services.

---

## Environment & Configuration

All backend services share a single `.env` file at `server/.env` (gitignored). Copy `server/.env.example` to get started.

```bash
# MongoDB Atlas
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<AppName>
DB_NAME=greenhouse_guardians

# Inter-service URLs (change for Docker / different hosts)
UPLOAD_SERVICE_URL=http://localhost:8001
CLASSIFY_SERVICE_URL=http://localhost:8002
RESULTS_SERVICE_URL=http://localhost:8003

# External ML inference service (HF Space)
INFERENCE_SERVICE_URL=https://deenp03-guardians-of-the-greenhouse-inference.hf.space

# Inference track per model: "remote" (HF Space) or "local" (YOLOv8)
TOMATO_INFERENCE_TRACK=remote
FLOWER_INFERENCE_TRACK=remote

# CORS (extend via EXTRA_CORS_ORIGINS=url1,url2)
```

Config is centralized in `server/shared/config.py`. All services import from there — do not duplicate config.

---

## MongoDB Connection

- Driver: `motor` (async) — `AsyncIOMotorGridFSBucket` for GridFS
- Database: `greenhouse_guardians`
- Image storage: GridFS bucket `images` (never store image bytes in documents)

### Collection: `row_data`

Each document represents a unique `(greenhouse_row, distanceFromRowStart)` pair.

```jsonc
{
  "_id": ObjectId,
  "greenhouse_row": int,           // e.g. 1, 2, 3
  "distanceFromRowStart": float,   // meters, e.g. 10.5
  "timestamps": {
    "<sanitized-ISO-timestamp>": {   // dots replaced with underscores (see make_ts_key)
      "original_images": [GridFS_file_id, ...],
      "tomato_annotated_images": [GridFS_file_id, ...],
      "flower_annotated_images": [GridFS_file_id, ...],
      "depth_images": [GridFS_file_id, ...],          // FUTURE
      "tomato_classification": {
        "detections": [
          { "class_id": int, "label": str, "confidence": float,
            "bbox": { "x1": float, "y1": float, "x2": float, "y2": float } }
        ],
        "summary": { "total": int, "by_class": { "Ripe": int, "Half_Ripe": int, "Unripe": int } }
      },
      "flower_classification": {
        "flowers": [
          { "bounding_box": [x1, y1, x2, y2], "stage": int, "confidence": float }
        ],
        "total_flowers": int,
        "stage_counts": { "0": int, "1": int, "2": int }
      },
      "depth_analysis": null        // FUTURE
    }
  }
}
```

**Timestamp key sanitization**: ISO timestamps contain `.` which MongoDB interprets as a field-path separator. Use `make_ts_key(ts)` from `shared/config.py` to convert `.` → `_` before using as a key. Use `_key_to_ts(key)` to reverse.

### Collection: `daily_trends`

Aggregated daily stats for the Trends page. Managed by `server/shared/trends.py`.

```jsonc
{
  "date": "YYYY-MM-DD",
  "tomatoes": { "ripe": int, "half_ripe": int, "unripe": int, "total": int },
  "flowers": { "stage_0": int, "stage_1": int, "stage_2": int, "total": int },
  "estimated_yield_kg": float,   // ripe×1.0 + half×0.8 + unripe×0.5, at 150g avg
  "scan_count": int,
  "location_count": int,
  "last_updated": str
}
```

### GridFS Metadata

```jsonc
{
  "greenhouse_row": int,
  "distanceFromRowStart": float,
  "timestamp": str,
  "image_type": "original" | "tomato_annotated" | "flower_annotated" | "depth",
  "image_index": int
}
```

---

## ML Inference

### Models

| Model | HF Repo | Filename | Classes |
|---|---|---|---|
| Tomato Ripeness | `deenp03/tomato-ripeness-classifier` | `ripeness_finetuned_new.pt` | `{0: Unripe, 1: Half_Ripe, 2: Ripe}` |
| Flower Stage | `deenp03/tomato_pollination_stage_classifier` | `best.pt` | `{0: Stage_0, 1: Stage_1, 2: Stage_2}` |

### Inference Tracks

Each model has an independently configurable inference track (`TOMATO_INFERENCE_TRACK` / `FLOWER_INFERENCE_TRACK`):

- **`remote`** — calls the hosted HF Space inference API (`INFERENCE_SERVICE_URL`). This is the default and avoids local GPU/memory requirements.
- **`local`** — loads YOLOv8 model locally. On startup, try local cache (`server/models/`) first; download from HuggingFace only if missing. Models held in memory.

### Bounding Box Colors (when annotating locally)

- Tomatoes: green (Ripe), yellow (Half_Ripe), red (Unripe)
- Flowers: labeled by stage with distinct colors

---

## Service Specifications

### 1. Upload Service (port 8001)

#### `POST /uploadData`
Inputs (multipart): `timestamp`, `greenhouse_row`, `distanceFromRowStart`, `images[]`

1. Upsert `row_data` document for `(greenhouse_row, distanceFromRowStart)`.
2. Store images in GridFS; record file IDs in timestamp entry.
3. Call `POST classify-service:8002/enqueue` → fire-and-forget classification.
4. Return `{ document_id }`.

#### `POST /uploadClassify`
Inputs (multipart): `timestamp`, `greenhouse_row`, `distanceFromRowStart`, `images[]`

1. Upsert `row_data` doc, store images in GridFS.
2. Call `POST classify-service:8002/classifyNow` (skips queue, immediate).
3. Poll MongoDB every ~1s (timeout 120s) until both classifications are present.
4. Return classification results + annotated image file IDs.

#### `POST /demoClassify`
Inputs (multipart): `images[]`

1. Do **not** touch MongoDB.
2. Forward images to `classify-service:8002/classifyDirect`.
3. Return base64 annotated images + classification summaries.

---

### 2. Classify Service (port 8002)

Manages YOLOv8 classification with an in-memory async priority queue.

#### `POST /enqueue`
JSON: `{ document_id, greenhouse_row, distanceFromRowStart, timestamp }`
→ Enqueue for background processing. Returns 202.

#### `POST /classifyNow`
JSON: `{ document_id, greenhouse_row, distanceFromRowStart, timestamp }`
→ Skip queue; run `classifyTomatoes` + `classifyFlowers` in parallel (`asyncio.gather`). Persist to MongoDB. Returns 200.

#### `POST /classifyDirect`
Multipart: `images[]`
→ Run inference (no DB writes). Return base64 annotated images + summaries.

#### Background Worker
- Async loop popping from the priority queue.
- Fetches originals from GridFS, runs both classifiers in parallel, updates MongoDB.

#### `classifyDepth` — FUTURE STUB
Exists in `classifier.py` with a docstring but raises `NotImplementedError`. Takes RGB image, RealSense D435i depth image, tomato detections → estimates tomato volume.

---

### 3. Results Service (port 8003)

#### `GET /getSummaryResults`
- Query all `row_data`, take latest timestamp per doc.
- Aggregate total tomato counts (by class), flower counts (by stage), per-row breakdown.
- Response: `{ total_tomatoes, total_flowers, total_tomato_count, total_flower_count, rows[] }`

#### `GET /getDetailedRowData?row={n}`
- Query all docs for `greenhouse_row == n`, sorted by `distanceFromRowStart`.
- Return latest timestamp's classification data + image URLs (`/getImage/{file_id}` format).

#### `GET /getImage/{file_id}`
- Serve GridFS image bytes with correct content-type.

#### `GET /getTrends`
- Returns 7-day `daily_trends` data for the Trends charts.

---

## Frontend Specification

**Stack**: React 18, Vite, React Router, Recharts, Axios. No Tailwind — uses inline styles with design tokens.

### Design Tokens (`client/src/tokens.js`)

Earthy, warm minimal palette:

```js
C.bg0 = '#f9f7f4'   // page background
C.bg1 = '#ffffff'   // card surface
C.green = '#3d6b4f' // brand green (forest)
C.t1 = '#1c1917'    // primary text
C.t2 = '#6b6560'    // secondary text
C.t3 = '#a09890'    // muted text
// Semantic: ripe (green), halfRipe (amber), unripe (red)
// Flowers: flower0 (slate blue), flower1 (violet), flower2 (burnt sienna)
```

Flower stage labels: `{ 0: 'Bud', 1: 'Anthesis', 2: 'Post-Anthesis' }`.

### Routes

| Path | Page | Notes |
|---|---|---|
| `/onboarding` | Onboarding | Full-screen, no navbar |
| `/` | Dashboard | Summary stats + charts |
| `/classify` | Classify & Upload | Upload form + results |
| `/rows` | Row Details | Row visualizer + image gallery |
| `/trends` | Trends | Line charts from `daily_trends` |
| `/timeline` | Timeline | Chronological scan feed |
| `/settings` | Settings | Confidence threshold, inference track, auto-refresh |

### Key Pages

**Dashboard**: Calls `/getSummaryResults`. Stat cards (total tomatoes/flowers, estimated yield), donut charts by ripeness/stage, per-row table. Supports week selection.

**Classify & Upload**: Upload dropzone (2+ images), row/distance inputs, timestamp (auto-filled). Demo mode toggle → calls `/demoClassify` instead. Shows annotated images + summary after response.

**Row Details**: Row selector dropdown, horizontal visualizer with clickable distance markers, image gallery modal, per-distance classification breakdown.

**Timeline**: Chronological feed of classification events. Auto-refresh (configurable in Settings, polls every 20s).

**Trends**: Line charts for tomato ripeness and flower stage counts over the last 7 days (from `daily_trends`).

**Settings**: Confidence threshold slider (10–100%, presets at 25/50/75%), tomato/flower inference track toggle (remote/local), auto-refresh toggle, "Replay intro" button.

**Onboarding**: First-run flow to configure greenhouse row count. Config stored in localStorage via `useGreenhouseConfig` hook.

---

## Project Structure

```
greenhouse-guardians/
├── CLAUDE.md
├── readme.md
├── dev.sh                         # Start all services locally (one command)
├── .github/workflows/
│   └── deploy-hf-spaces.yml       # CI: deploy backend to Hugging Face Spaces
├── deploy/hf-spaces/
│   ├── Dockerfile                 # All 3 backend services + nginx via supervisord
│   ├── nginx.conf                 # Reverse proxy: routes /upload/, /classify/, /results/
│   ├── supervisord.conf           # Process manager for services inside container
│   └── requirements.txt
├── server/
│   ├── .env                       # Gitignored — real credentials
│   ├── .env.example               # Template to copy
│   ├── shared/
│   │   ├── config.py              # All config: DB URI, URLs, model paths, CORS
│   │   ├── db.py                  # Motor client + GridFS bucket helpers
│   │   └── trends.py             # daily_trends collection read/write utilities
│   ├── upload_service/
│   │   ├── main.py                # /uploadData, /uploadClassify, /demoClassify
│   │   └── requirements.txt
│   ├── classify_service/
│   │   ├── main.py                # /enqueue, /classifyNow, /classifyDirect
│   │   ├── classifier.py          # YOLOv8 inference + annotation + classifyDepth stub
│   │   ├── queue_worker.py        # Background async queue consumer
│   │   └── requirements.txt
│   ├── results_service/
│   │   ├── main.py                # /getSummaryResults, /getDetailedRowData, /getImage, /getTrends
│   │   └── requirements.txt
│   ├── models/                    # Local .pt cache (gitignored)
│   └── images/                    # Sample images organized by flower/week/row/distance
└── client/
    ├── vite.config.js
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx                # Router + Layout + SettingsProvider
    │   ├── tokens.js              # Design tokens (C.*, TOMATO_COLORS, FLOWER_COLORS)
    │   ├── api/index.js           # Axios instances + all API call functions
    │   ├── context/
    │   │   └── SettingsContext.jsx  # Global settings (confidence, track, autoRefresh)
    │   ├── hooks/
    │   │   └── useGreenhouseConfig.js  # Greenhouse config (row count) in localStorage
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── ClassifyUpload.jsx
    │   │   ├── RowDetails.jsx
    │   │   ├── Trends.jsx
    │   │   ├── Timeline.jsx
    │   │   ├── Settings.jsx
    │   │   └── Onboarding.jsx
    │   └── components/
    │       ├── Navbar.jsx
    │       ├── StatCard.jsx
    │       ├── ChartCard.jsx
    │       ├── DonutChart.jsx
    │       ├── GreenhouseHeatmap.jsx
    │       ├── ImageGallery.jsx
    │       ├── ImageModal.jsx
    │       ├── LoadingSpinner.jsx
    │       └── RowVisualizer.jsx
    └── index.css
```

---

## Development

### Quick Start

```bash
# 1. Backend — one-time setup
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r upload_service/requirements.txt \
            -r classify_service/requirements.txt \
            -r results_service/requirements.txt
cp .env.example .env   # fill in MONGO_URI

# 2. Frontend — one-time setup
cd client && npm install

# 3. Start everything
./dev.sh    # starts all 3 services + frontend with colored prefixed logs
```

### Running Services Individually

```bash
cd server/upload_service  && uvicorn main:app --host 0.0.0.0 --port 8001 --reload
cd server/classify_service && uvicorn main:app --host 0.0.0.0 --port 8002 --reload
cd server/results_service  && uvicorn main:app --host 0.0.0.0 --port 8003 --reload
cd client && npm run dev
```

### CORS
All services allow `http://localhost:5173` and `*` for development. Extend via `EXTRA_CORS_ORIGINS` env var.

### Deployment
The backend deploys to a Hugging Face Space via `.github/workflows/deploy-hf-spaces.yml`. The `deploy/hf-spaces/` directory contains a self-contained Docker image that runs all three services behind nginx on port 7860 using supervisord.

---

## Key Python Dependencies

```
# All services
fastapi
uvicorn[standard]
motor
pymongo
python-dotenv
python-multipart

# Classify Service additionally
ultralytics            # YOLOv8
huggingface_hub
opencv-python-headless
Pillow
numpy
httpx                  # for calling remote inference service
```

---

## Important Implementation Notes

1. **GridFS for ALL images**: Never store bytes in documents — always GridFS + file_id reference.
2. **Timestamp key sanitization**: Always use `make_ts_key()` / `_key_to_ts()` when reading/writing timestamp keys in MongoDB.
3. **Inference track**: Check `TOMATO_INFERENCE_TRACK` / `FLOWER_INFERENCE_TRACK` before deciding local vs. remote. Default is `remote` (HF Space).
4. **Async everything**: `async/await` throughout. Motor is async-native. Use `asyncio.gather` for parallel classification.
5. **Model loading (local track)**: Load once at startup. Try local cache first; download from HuggingFace only if missing.
6. **Polling in uploadClassify**: `await asyncio.sleep(1)` loop checking DB, max 120s timeout.
7. **Frontend API**: The `client/src/api/index.js` file has separate Axios instances for each service. Update base URLs there if service locations change.
8. **Design tokens**: All colors, spacing, and type come from `client/src/tokens.js`. Never hardcode color values in components.
9. **Depth analysis**: `classifyDepth` stub exists in `classifier.py` — do not implement, just keep the stub.
10. **daily_trends**: Updated on every successful classification via `update_daily_trend()` in `shared/trends.py`.
