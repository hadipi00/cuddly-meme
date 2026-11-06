#!/bin/bash
# Start script for ModaresYar (cuddly-meme) — backend on :4000, frontend on :3000
set -u
PROJ=/home/z/my-project
LOG_DIR=$PROJ/.zscripts
mkdir -p "$LOG_DIR"

# --- stop previous instances (by port) ---
for port in 3000 4000; do
  pids=$(ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | sort -u)
  [ -n "$pids" ] && kill $pids 2>/dev/null
done
sleep 2

# --- backend: Express + SQLite (must run with node, uses node:sqlite) ---
cd "$PROJ/server"
nohup node index.js > "$LOG_DIR/backend.log" 2>&1 &
echo "[start] backend PID: $!"

# --- frontend: vite dev server on 0.0.0.0:3000 ---
cd "$PROJ"
nohup bun run dev > "$LOG_DIR/frontend.log" 2>&1 &
echo "[start] frontend PID: $!"

# --- wait and report ---
sleep 8
echo "=== PORTS ==="
ss -tlnp 2>/dev/null | grep -E ':3000 |:4000 ' || echo "ports not up yet"
echo "=== BACKEND HEALTH ==="
curl -s --max-time 5 http://127.0.0.1:4000/api/health || echo "(backend not responding yet)"
echo ""
echo "=== FRONTEND (vite) ==="
curl -s --max-time 5 -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3000/ || echo "(frontend not responding yet)"
