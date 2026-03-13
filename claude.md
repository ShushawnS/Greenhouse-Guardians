# GreenhouseGuardians – Claude Code Project Prompt

## Project Overview

**GreenhouseGuardians** is a full-stack intelligence platform for tomato greenhouse operators. It allows users to upload images from greenhouse rows, automatically classify tomato ripeness and flower pollination stages using YOLOv8 models hosted on Hugging Face, and view summarized analytics through a clean dashboard UI.

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
```

The system consists of **three backend microservices** and a **React frontend**:

| Component          | Tech                        | Port  |
| ------------------ | --------------------------- | ----- |
| Upload Service     | Python (FastAPI)            | 8001  |
| Classify Service   | Python (FastAPI)            | 8002  |
| Results Service    | Python (FastAPI)            | 8003  |
| Frontend           | React + Vite + Tailwind CSS | 5173  |

All services share a single MongoDB Atlas cluster. Use **FastAPI** for all backend services due to its async support, excellent typing, and ease of file handling.

---

## MongoDB Connection

```
mongodb+srv://user:passwd@greenhouseguardians.zxzvapv.mongodb.net/?appName=GreenhouseGuardians
```

- Use `motor` (async MongoDB driver for Python) in every service.
- Use `GridFS` (via `motor.motor_asyncio.AsyncIOMotorGridFSBucket`) for storing all images (original, annotated-tomato, annotated-flower, depth).
- Database name: `greenhouse_guardians`

---

## MongoDB Schema Design

### Collection: `row_data`

Each document represents a **unique (greenhouse_row, distanceFromRowStart) pair** — i.e. a specific physical location in the greenhouse.

```jsonc
{
  "_id": ObjectId,
  "greenhouse_row": int,           // e.g. 1, 2, 3
  "distanceFromRowStart": float,   // e.g. 10.5 (meters)
  "timestamps": {
    "<ISO-timestamp>": {
      "original_images": [GridFS_file_id, ...],      // raw uploaded images
      "tomato_annotated_images": [GridFS_file_id, ...], // images with tomato bounding boxes
      "flower_annotated_images": [GridFS_file_id, ...], // images with flower bounding boxes
      "depth_images": [GridFS_file_id, ...],          // FUTURE: depth camera images
      "tomato_classification": {
        "detections": [
          {
            "class_id": int,       // 0=Unripe, 1=Half_Ripe, 2=Ripe
            "label": str,
            "confidence": float,
            "bbox": { "x1": float, "y1": float, "x2": float, "y2": float }
          }
        ],
        "summary": {
          "total": int,
          "by_class": { "Ripe": int, "Half_Ripe": int, "Unripe": int }
        }
      },
      "flower_classification": {
        "flowers": [
          {
            "bounding_box": [x1, y1, x2, y2],
            "stage": int,          // 0, 1, or 2
            "confidence": float
          }
        ],
        "total_flowers": int,
        "stage_counts": { "0": int, "1": int, "2": int }
      },
      "depth_analysis": null       // FUTURE: tomato volume data from RealSense D435i
    }
  }
}
```

### GridFS Bucket Naming Convention

Use a single GridFS bucket called `images` with metadata to organize:

```jsonc
// metadata stored with each GridFS file
{
  "greenhouse_row": int,
  "distanceFromRowStart": float,
  "timestamp": str,
  "image_type": "original" | "tomato_annotated" | "flower_annotated" | "depth",
  "image_index": int   // which image in the set (0, 1, 2, ...)
}
```

---

## Hugging Face Models

### Tomato Ripeness Classifier (YOLOv8)
- **URL**: `https://huggingface.co/deenp03/tomato-ripeness-classifier/blob/main/ripeness_best.pt`
- **Direct download**: `https://huggingface.co/deenp03/tomato-ripeness-classifier/resolve/main/ripeness_best.pt`
- **Type**: YOLOv8 object detection
- **Classes**: `{0: "Unripe", 1: "Half_Ripe", 2: "Ripe"}`

### Flower Pollination Stage Classifier (YOLOv8)
- **URL**: `https://huggingface.co/deenp03/tomato_pollination_stage_classifier`
- **Direct download**: `https://huggingface.co/deenp03/tomato_pollination_stage_classifier/resolve/main/best.pt` (check repo for exact filename)
- **Type**: YOLOv8 object detection
- **Classes**: `{0: "Stage_0", 1: "Stage_1", 2: "Stage_2"}` (verify exact class names from model metadata)

### Model Loading Strategy
1. **First**: Try to load the model from a local cache path (e.g. `./models/ripeness_best.pt`).
2. **Only if the file does not exist locally**: Download from Hugging Face using `huggingface_hub` library's `hf_hub_download()` and save to the local cache path.
3. Use `ultralytics.YOLO(model_path)` to load.
4. Models should be loaded **once at service startup** and held in memory.

---

## Service Specifications

### 1. Upload Service (port 8001)

#### `POST /uploadData`
**Inputs** (multipart form):
- `timestamp` (string, ISO format)
- `greenhouse_row` (int)
- `distanceFromRowStart` (float)
- `images` (list of uploaded files, 2+)

**Logic**:
1. Find or create the `row_data` document for `(greenhouse_row, distanceFromRowStart)`.
2. Store uploaded images into GridFS with proper metadata.
3. Create a timestamp entry in the document with `original_images` file IDs.
4. Enqueue a classification job to the Classify Service's queue by calling `POST http://classify-service:8002/enqueue` with the document's `_id`, `greenhouse_row`, `distanceFromRowStart`, and `timestamp`.
5. Return success with the document `_id`.

#### `POST /uploadClassify`
**Inputs** (multipart form):
- `timestamp` (string, ISO format)
- `greenhouse_row` (int)
- `distanceFromRowStart` (float)
- `images` (list of uploaded files, 2+)

**Logic**:
1. Find or create the `row_data` document for `(greenhouse_row, distanceFromRowStart)`.
2. Store uploaded images into GridFS with proper metadata.
3. Create a timestamp entry in the document with `original_images` file IDs.
4. Call Classify Service's **direct/priority endpoint** `POST http://classify-service:8002/classifyNow` — this skips the queue and runs classification immediately.
5. Poll the MongoDB document (e.g., every 1–2 seconds, timeout after 120 seconds) until both `tomato_classification` and `flower_classification` exist under the timestamp.
6. Return the classification results along with GridFS file IDs for annotated images.

#### `POST /demoClassify`
**Inputs** (multipart form):
- `images` (list of uploaded files, 2+)

**Logic**:
1. Do **not** store anything in MongoDB.
2. Call Classify Service's `POST http://classify-service:8002/classifyDirect` sending the images directly.
3. Receive annotated images (base64 encoded) and classification summaries back.
4. Return annotated images and summary data in the response.

---

### 2. Classify Service (port 8002)

This service manages classification jobs and runs YOLOv8 inference.

#### Internal State
- Maintain an **in-memory priority queue** (use Python's `asyncio.PriorityQueue` or a list sorted by priority/timestamp).
- A background worker continuously pops items from the queue and processes them.

#### `POST /enqueue`
**Input JSON**:
```json
{
  "document_id": "ObjectId string",
  "greenhouse_row": 1,
  "distanceFromRowStart": 10.0,
  "timestamp": "2026-03-12T15:55:33.813000"
}
```
**Logic**: Add to the priority queue. Return 202 Accepted.

#### `POST /classifyNow`
**Input JSON**:
```json
{
  "document_id": "ObjectId string",
  "greenhouse_row": 1,
  "distanceFromRowStart": 10.0,
  "timestamp": "2026-03-12T15:55:33.813000"
}
```
**Logic**: Skip the queue. Run `classifyFlowers` and `classifyTomatoes` immediately (in parallel using `asyncio.gather`). Store results to MongoDB. Return 200 with a success message.

#### `POST /classifyDirect`
**Input**: Multipart form with `images` (list of files).
**Logic**:
1. Run `classifyFlowers` and `classifyTomatoes` in parallel on the provided images.
2. Do NOT save to MongoDB.
3. Return JSON with annotated images as base64 strings and classification summary data.

#### `classifyTomatoes(images)` — Internal Method
1. Load each image with OpenCV / PIL.
2. Run inference with the tomato YOLOv8 model.
3. Draw bounding boxes on the image (green for Ripe, yellow for Half_Ripe, red for Unripe) with labels and confidence scores.
4. Store annotated image to GridFS (if saving to DB) with `image_type: "tomato_annotated"`.
5. Build and store classification data per the schema above.

#### `classifyFlowers(images)` — Internal Method
1. Load each image with OpenCV / PIL.
2. Run inference with the flower YOLOv8 model.
3. Draw bounding boxes on the image with stage labels and confidence.
4. Store annotated image to GridFS (if saving to DB) with `image_type: "flower_annotated"`.
5. Build and store classification data per the schema above.

#### Background Queue Worker
- Runs in an infinite loop as an asyncio background task.
- Pops the next item from the priority queue.
- Fetches original images from GridFS.
- Runs `classifyFlowers` and `classifyTomatoes` in parallel.
- Updates the MongoDB document with results.

#### FUTURE PLACEHOLDER: `classifyDepth(rgb_image, depth_image, tomato_detections)`
- **Do not implement the logic yet.**
- Create a stub function with a docstring explaining:
  - Takes an RGB image, a RealSense D435i depth image, and the tomato bounding box detections.
  - Maps RGB bounding boxes to the depth image.
  - Computes estimated tomato volume from the depth data.
  - Stores the depth image with bounding boxes and volume labels in GridFS.
  - Saves `depth_analysis` data to the MongoDB document under the timestamp.
- The function should just `pass` or raise `NotImplementedError("Depth analysis not yet implemented")`.

---

### 3. Results Service (port 8003)

#### `GET /getSummaryResults`
**Logic**:
1. Query all documents in `row_data`.
2. For each document, get the **latest timestamp** entry.
3. Extract only the classification summary data (tomato counts, flower counts) — **skip all image data**.
4. Aggregate totals across the entire greenhouse:
   - Total tomatoes by ripeness class
   - Total flowers by stage
   - Per-row breakdown
5. Return the aggregated summary.

**Response shape**:
```json
{
  "total_tomatoes": { "Ripe": 120, "Half_Ripe": 45, "Unripe": 80 },
  "total_flowers": { "0": 30, "1": 50, "2": 20 },
  "total_tomato_count": 245,
  "total_flower_count": 100,
  "rows": [
    {
      "greenhouse_row": 1,
      "distances": [
        {
          "distanceFromRowStart": 10.0,
          "latest_timestamp": "...",
          "tomato_summary": { ... },
          "flower_summary": { ... }
        }
      ]
    }
  ]
}
```

#### `GET /getDetailedRowData?row={row_number}`
**Logic**:
1. Query all documents where `greenhouse_row == row_number`.
2. For each distance entry, get the **latest timestamp's** data.
3. Include: classification data, annotated image GridFS file IDs, and original image file IDs.
4. Provide a sub-endpoint or include base64 image data for the annotated images so the frontend can display them.
5. Return all distances sorted by `distanceFromRowStart`.

**Response shape**:
```json
{
  "greenhouse_row": 1,
  "distances": [
    {
      "distanceFromRowStart": 5.0,
      "latest_timestamp": "...",
      "tomato_classification": { ... },
      "flower_classification": { ... },
      "images": {
        "original": ["base64 or URL ..."],
        "tomato_annotated": ["base64 or URL ..."],
        "flower_annotated": ["base64 or URL ..."]
      }
    }
  ]
}
```

#### `GET /getImage/{file_id}`
A helper endpoint to serve GridFS images by file ID. Returns the image bytes with proper content-type.

#### `GET /getTrends`
**Stub endpoint.** Returns `{"message": "Trends endpoint coming soon", "data": null}` with 200 status.

---

## Frontend Specification

**Tech stack**: React 18, Vite, Tailwind CSS, React Router, Recharts (for charts), Axios.

### Design System

- **Theme**: Light background with a **green color palette**.
  - Primary green: `#22c55e` (green-500)
  - Dark green: `#15803d` (green-700)
  - Light green backgrounds: `#f0fdf4` (green-50), `#dcfce7` (green-100)
  - Accent: `#166534` (green-800) for headings
  - White cards on `#f9fafb` (gray-50) page background
- **Typography**: Use `Inter` font family (import from Google Fonts). Clean, modern, consistent sizing.
  - Page titles: `text-2xl font-bold`
  - Section headers: `text-lg font-semibold`
  - Body: `text-sm` or `text-base`
- **Spacing**: Even and generous — `p-6` for cards, `gap-6` between grid items, `space-y-4` for stacked elements.
- **Cards**: White background, `rounded-xl`, subtle `shadow-sm`, `border border-green-100`.
- **Overall feel**: Clean, calm, professional agricultural dashboard. Think Notion meets a farm management tool.

### Navigation
- Fixed top navbar with the app name **"GreenhouseGuardians"** and a leaf/plant icon.
- Four tabs as nav links: **Dashboard**, **Classify & Upload**, **Row Details**, **Trends**.
- Active tab highlighted in green.

### Tab 1: Dashboard (`/`)
- Calls `GET /getSummaryResults` on load.
- **Top row**: Summary stat cards in a grid:
  - Total Tomatoes (with breakdown: Ripe / Half Ripe / Unripe)
  - Total Flowers (with breakdown by stage)
  - Predicted Yield (placeholder/estimate — calculate as: `ripe_tomatoes + (half_ripe * 0.8) + (unripe * 0.5)` as a rough proxy, labeled "Estimated Yield in X Weeks")
- **Middle row**: Bar chart or donut chart showing tomato ripeness distribution and flower stage distribution side by side (use Recharts).
- **Bottom row**: A table or accordion showing per-row summaries.

### Tab 2: Classify & Upload (`/classify`)
- Calls `POST /uploadClassify` (or `/demoClassify` for demo mode).
- **Upload form**:
  - Dropzone for images (drag & drop + file picker, accept 2+ images).
  - Input fields: Greenhouse Row (number), Distance from Row Start (number), Timestamp (auto-filled with current time, editable).
  - Toggle: "Demo Mode" — if on, skip row/distance fields, call `/demoClassify` instead.
  - Submit button: "Classify" (green, prominent).
- **Results area** (shown after response):
  - Side-by-side display of annotated images (tomato and flower).
  - Summary cards: tomato counts by class, flower counts by stage.
  - Loading spinner while waiting.

### Tab 3: Row Details (`/rows`)
- Calls `GET /getDetailedRowData?row=X`.
- **Controls at top**:
  - Row selector dropdown (populated from available rows).
  - Date/time range filter (default: latest).
- **Main content**:
  - A horizontal visual "row line" showing data points positioned by `distanceFromRowStart`. Each point is a clickable dot/marker.
  - Clicking a point opens a detail panel showing:
    - Original + annotated images (scrollable gallery).
    - Tomato and flower classification summaries.
- **Bottom**: Summary stats for the entire selected row.

### Tab 4: Trends (`/trends`)
- Placeholder page.
- Show a message: "Trends coming soon — track flowers and tomatoes over time."
- Include two empty chart placeholders (Recharts `LineChart` with sample axes labeled "Flowers over time" and "Tomatoes over time").

---

## Project Structure

```
greenhouse-guardians/
├── CLAUDE.md
├── docker-compose.yml         # Optional: for running all services
├── server/
│   ├── shared/
│   │   ├── db.py              # MongoDB connection utility (motor client, GridFS bucket)
│   │   └── config.py          # Shared config: DB URI, service URLs, model paths
│   ├── upload_service/
│   │   ├── main.py            # FastAPI app with /uploadData, /uploadClassify, /demoClassify
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── classify_service/
│   │   ├── main.py            # FastAPI app with /enqueue, /classifyNow, /classifyDirect
│   │   ├── classifier.py      # YOLOv8 model loading + inference + annotation logic
│   │   ├── queue_worker.py    # Background priority queue consumer
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── results_service/
│   │   ├── main.py            # FastAPI app with /getSummaryResults, /getDetailedRowData, /getTrends, /getImage
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── models/                # Local cache for downloaded .pt model files (gitignored)
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.jsx
│       ├── App.jsx            # Router + Layout + Navbar
│       ├── api/
│       │   └── index.js       # Axios instance + API call functions
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── ClassifyUpload.jsx
│       │   ├── RowDetails.jsx
│       │   └── Trends.jsx
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── StatCard.jsx
│       │   ├── ImageGallery.jsx
│       │   ├── RowVisualizer.jsx   # Horizontal row line with distance markers
│       │   ├── LoadingSpinner.jsx
│       │   └── ChartCard.jsx
│       └── index.css          # Tailwind imports + Inter font
└── README.md
```

---

## Key Python Dependencies (per service)

```
# All services
fastapi
uvicorn[standard]
motor                  # async MongoDB driver
pymongo
python-multipart       # for file uploads in FastAPI

# Classify Service additionally
ultralytics            # YOLOv8
huggingface_hub        # for downloading models
opencv-python-headless # image processing
Pillow
numpy
```

---

## Development & Testing Instructions

### Running Services
Each service should be runnable standalone:
```bash
cd server/upload_service && uvicorn main:app --host 0.0.0.0 --port 8001 --reload
cd server/classify_service && uvicorn main:app --host 0.0.0.0 --port 8002 --reload
cd server/results_service && uvicorn main:app --host 0.0.0.0 --port 8003 --reload
cd client && npm run dev
```

### CORS
All backend services must enable CORS for `http://localhost:5173` (Vite dev server) and `*` for development.

### Testing Checklist
1. **Upload Service**:
   - [ ] `/uploadData` creates a document and enqueues classification.
   - [ ] `/uploadClassify` creates a document, triggers immediate classification, polls and returns results.
   - [ ] `/demoClassify` returns annotated images and summaries without touching the DB.
2. **Classify Service**:
   - [ ] Models load on startup (download if not cached).
   - [ ] `/enqueue` adds to queue, background worker processes it.
   - [ ] `/classifyNow` runs classification immediately.
   - [ ] `/classifyDirect` returns results without DB writes.
   - [ ] Annotated images have visible, correct bounding boxes.
3. **Results Service**:
   - [ ] `/getSummaryResults` aggregates all latest data correctly.
   - [ ] `/getDetailedRowData?row=1` returns correct images and data.
   - [ ] `/getImage/{file_id}` serves images from GridFS.
4. **Frontend**:
   - [ ] Dashboard loads and displays summary data.
   - [ ] Classify tab uploads images and shows results.
   - [ ] Row Details tab shows row visualization with clickable points.
   - [ ] All pages are responsive, styled consistently, and use the green theme.

### Error Handling
- All endpoints should return proper HTTP error codes (400 for bad input, 500 for internal errors).
- All endpoints should validate that required fields are present.
- Frontend should display user-friendly error messages and loading states.
- MongoDB operations should use try/except blocks.

---

## Important Implementation Notes

1. **GridFS for ALL images**: Never store image bytes directly in documents. Always use GridFS and store the `file_id` reference.
2. **Model loading**: Load both YOLOv8 models once at Classify Service startup. Keep them in memory. Use `try/except` — try loading from local path first, download from HuggingFace only if the local file doesn't exist.
3. **Async everything**: Use `async/await` throughout. Motor is async-native. Use `asyncio.gather` for parallel classification.
4. **Image annotation**: When drawing bounding boxes, use OpenCV's `cv2.rectangle` and `cv2.putText`. Use distinct colors per class. Return annotated images as both GridFS-stored files and optionally base64 for API responses.
5. **Polling in uploadClassify**: Use a simple async loop with `await asyncio.sleep(1)` checking the DB, with a max timeout of 120 seconds.
6. **Frontend API base URL**: Configure via environment variable or Vite's `import.meta.env.VITE_API_URL`, defaulting to `http://localhost` with appropriate ports for each service. Consider a simple API gateway or proxy config in Vite to route `/api/upload/*`, `/api/classify/*`, `/api/results/*` to their respective services.
7. **Depth analysis placeholder**: The `classifyDepth` stub function should exist in `classifier.py` with a full docstring but no implementation. The MongoDB schema already accounts for `depth_images` and `depth_analysis` fields.