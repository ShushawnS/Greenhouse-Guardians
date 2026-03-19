#!/bin/bash
# dev.sh — Start all Greenhouse Guardians services locally
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER="$ROOT/server"
CLIENT="$ROOT/client"
VENV="$SERVER/.venv/bin/activate"

# Verify venv exists
if [ ! -f "$VENV" ]; then
  echo "ERROR: Python venv not found at $SERVER/.venv"
  echo "Run: cd server && python3 -m venv .venv && source .venv/bin/activate && pip install -r upload_service/requirements.txt -r classify_service/requirements.txt -r results_service/requirements.txt"
  exit 1
fi

# Verify node_modules exists
if [ ! -d "$CLIENT/node_modules" ]; then
  echo "ERROR: node_modules not found. Run: cd client && npm install"
  exit 1
fi

echo "Starting all services... (Ctrl+C to stop all)"

# Start each service in the background, tee output with a colored prefix
(source "$VENV" && cd "$SERVER/upload_service"  && uvicorn main:app --host 0.0.0.0 --port 8001 --reload 2>&1 | sed 's/^/[upload  ] /') &
(source "$VENV" && cd "$SERVER/classify_service" && uvicorn main:app --host 0.0.0.0 --port 8002 --reload 2>&1 | sed 's/^/[classify] /') &
(source "$VENV" && cd "$SERVER/results_service"  && uvicorn main:app --host 0.0.0.0 --port 8003 --reload 2>&1 | sed 's/^/[results ] /') &
(cd "$CLIENT" && npm run dev 2>&1 | sed 's/^/[frontend] /') &

# Wait for all background jobs; kill them all on Ctrl+C
trap 'echo "Stopping all services..."; kill 0' SIGINT SIGTERM
wait
