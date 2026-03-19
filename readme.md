# Greenhouse Guardians

**Team #22 — Guardians of the Greenhouse**

A full-stack intelligence platform for tomato greenhouse operators. Upload images from greenhouse rows, classify tomato ripeness and flower pollination stages with YOLOv8, and track crop health over time through a clean dashboard.

---

## Features

- **Tomato ripeness detection** — classifies tomatoes as Unripe, Half-Ripe, or Ripe with annotated bounding boxes
- **Flower stage detection** — classifies flowers as Bud (0), Anthesis (1), or Post-Anthesis (2)
- **Per-row visualizer** — horizontal timeline showing all scanned distances in a row, with clickable image galleries
- **Trends** — daily aggregated counts over the last 7 days
- **Timeline** — chronological feed of all classification events with auto-refresh
- **Demo mode** — try classification without storing anything to the database
- **Configurable inference** — toggle between remote (Hugging Face Space) and local (YOLOv8) inference per model

---

## Architecture

Three Python/FastAPI microservices + React frontend, all backed by MongoDB Atlas.

```
Upload Service  (8001)  →  Classify Service (8002)  →  MongoDB
                                                    ↗
Results Service (8003)  ──────────────────────────
```

The **Classify Service** supports two inference tracks:
- **Remote** (default) — calls a hosted Hugging Face Space inference API
- **Local** — runs YOLOv8 directly, downloading models from HuggingFace on first use

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- A MongoDB Atlas cluster (free tier works)
- `server/.env` configured (see below)

### 1. Configure Environment

```bash
cp server/.env.example server/.env
# Edit server/.env and fill in your MONGO_URI
```

### 2. Install Dependencies

```bash
# Backend
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r upload_service/requirements.txt \
            -r classify_service/requirements.txt \
            -r results_service/requirements.txt

# Frontend
cd ../client && npm install
```

### 3. Start All Services

```bash
./dev.sh
```

This starts all three backend services and the Vite dev server simultaneously, with color-coded log prefixes. Press `Ctrl+C` to stop everything.

**Service URLs:**
| Service | URL |
|---|---|
| Upload | http://localhost:8001 |
| Classify | http://localhost:8002 |
| Results | http://localhost:8003 |
| Frontend | http://localhost:5173 |

### Run Services Individually

```bash
cd server/upload_service  && uvicorn main:app --port 8001 --reload
cd server/classify_service && uvicorn main:app --port 8002 --reload
cd server/results_service  && uvicorn main:app --port 8003 --reload
cd client && npm run dev
```

---

## Configuration

All backend config lives in `server/.env` and is loaded by `server/shared/config.py`.

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | *(required)* | MongoDB Atlas connection string |
| `DB_NAME` | `greenhouse_guardians` | Database name |
| `TOMATO_INFERENCE_TRACK` | `remote` | `remote` or `local` |
| `FLOWER_INFERENCE_TRACK` | `remote` | `remote` or `local` |
| `INFERENCE_SERVICE_URL` | HF Space URL | Endpoint for remote inference |
| `EXTRA_CORS_ORIGINS` | *(empty)* | Comma-separated additional CORS origins |

---

## API Reference

### Upload Service (8001)

| Method | Path | Description |
|---|---|---|
| POST | `/uploadData` | Store images + enqueue async classification |
| POST | `/uploadClassify` | Store images + classify immediately, poll until done |
| POST | `/demoClassify` | Classify images without storing to DB |

### Classify Service (8002)

| Method | Path | Description |
|---|---|---|
| POST | `/enqueue` | Add job to background queue |
| POST | `/classifyNow` | Skip queue, classify immediately |
| POST | `/classifyDirect` | Classify images in-memory, return results |

### Results Service (8003)

| Method | Path | Description |
|---|---|---|
| GET | `/getSummaryResults` | Aggregate latest data across all rows |
| GET | `/getDetailedRowData?row=N` | Full data + image URLs for a specific row |
| GET | `/getImage/{file_id}` | Serve a GridFS image |
| GET | `/getTrends` | 7-day daily trend aggregates |

---

## Frontend Pages

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | Summary stat cards, donut charts, per-row table |
| `/classify` | Classify & Upload | Upload form with demo mode toggle |
| `/rows` | Row Details | Row visualizer, image gallery, per-distance stats |
| `/trends` | Trends | Line charts for tomatoes and flowers over 7 days |
| `/timeline` | Timeline | Chronological scan feed with auto-refresh |
| `/settings` | Settings | Confidence threshold, inference track, display options |
| `/onboarding` | Onboarding | First-run greenhouse configuration |

---

## Deployment

The backend deploys to a [Hugging Face Space](https://huggingface.co/spaces) via GitHub Actions (`.github/workflows/deploy-hf-spaces.yml`).

The `deploy/hf-spaces/` directory contains a self-contained Docker image that runs all three services behind nginx on port 7860 using supervisord. ML models are downloaded to `/tmp/models` on first inference.

---

## ML Models

| Model | Hugging Face Repo | Classes |
|---|---|---|
| Tomato Ripeness | `deenp03/tomato-ripeness-classifier` | Unripe, Half_Ripe, Ripe |
| Flower Stage | `deenp03/tomato_pollination_stage_classifier` | Stage_0 (Bud), Stage_1 (Anthesis), Stage_2 (Post-Anthesis) |

---

## Project Structure

```
greenhouse-guardians/
├── dev.sh                        # Start all services (one command)
├── server/
│   ├── .env.example              # Config template
│   ├── shared/                   # Shared config, DB helpers, trends utilities
│   ├── upload_service/
│   ├── classify_service/
│   ├── results_service/
│   └── images/                   # Sample images (flower/weekN/rowN/Nm.jpg)
├── client/
│   └── src/
│       ├── tokens.js             # Design tokens (colors, typography)
│       ├── api/index.js          # All API calls (Axios)
│       ├── context/              # SettingsContext (global app settings)
│       ├── hooks/                # useGreenhouseConfig (localStorage)
│       ├── pages/                # Dashboard, Classify, RowDetails, Trends, etc.
│       └── components/           # Navbar, StatCard, RowVisualizer, ImageGallery, etc.
└── deploy/hf-spaces/             # Docker + nginx + supervisord for HF Space deployment
```
