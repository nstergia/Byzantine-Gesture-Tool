#!/usr/bin/env bash
# Run this file to start Byzantine Gesture:  bash start.sh   (or ./start.sh)
# It launches a local server and opens the browser automatically.
PORT="${1:-8080}"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1

echo "Byzantine Gesture"
echo "Folder: $DIR"

if [ ! -f "src/index.html" ]; then
  echo "ERROR: src/index.html was not found in this folder."
  echo "Extract the whole zip first and run start.sh from the extracted folder."
  exit 1
fi

# Pick a Python 3 that really runs
PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c "import sys; sys.exit(0 if sys.version_info[0]>=3 else 1)" >/dev/null 2>&1; then
    PY="$c"; break
  fi
done
if [ -z "$PY" ]; then
  echo "ERROR: Python 3 was not found. Install it, or run any static server in this folder"
  echo "(for example: npx http-server -p $PORT) and open http://localhost:$PORT/"
  exit 1
fi

echo "Starting local server on http://localhost:${PORT}/"
echo "Press Ctrl+C to stop."
echo ""

(sleep 1.2 && (
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:${PORT}/" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then open "http://localhost:${PORT}/"
  fi
)) &

exec "$PY" serve.py "$PORT"
