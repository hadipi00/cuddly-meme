#!/bin/bash
# ModaresYar (مدرسیار) launcher — Express backend (4000) + Vite frontend (3000)
# این اسکریپت در هر cold-start محیط به‌صورت خودکار اجرا می‌شود؛
# پس باید هر دو سرویس را بالا بیاورد و idempotent باشد.
set -uo pipefail

PROJECT_DIR="/home/z/my-project"
LOG_DIR="$PROJECT_DIR/.zscripts"
cd "$PROJECT_DIR" || exit 1
mkdir -p "$LOG_DIR"

log() { echo "[dev.sh $(date '+%H:%M:%S')] $*"; }

check_backend() { curl -s --max-time 2 -o /dev/null -w '%{http_code}' http://localhost:4000/api/health 2>/dev/null; }
check_frontend() { curl -s --max-time 2 -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null; }

# 1) وابستگی‌ها (وقتی node_modules هست سریع رد می‌شود)
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  log "installing root dependencies..."
  bun install >> "$LOG_DIR/dev.log" 2>&1
fi

# 1-ب) وابستگی‌های بک‌اند (server/node_modules بعد از recycle ممکن است نباشد)
if [ ! -d "$PROJECT_DIR/server/node_modules/express" ]; then
  log "installing server dependencies..."
  (cd "$PROJECT_DIR/server" && npm install --no-audit --no-fund --loglevel=error >> "$LOG_DIR/dev.log" 2>&1)
fi

# 2) بک‌اند Express روی 4000
B="$(check_backend)"
if [ "$B" != "200" ]; then
  log "starting Express backend on :4000 ..."
  nohup node server/index.js >> "$LOG_DIR/backend.log" 2>&1 < /dev/null &
  disown 2>/dev/null || true
else
  log "backend already up (200)"
fi

# 3) فرانت‌اند Vite روی 3000
F="$(check_frontend)"
if [ "$F" != "200" ]; then
  log "starting Vite frontend on :3000 ..."
  nohup bun run dev >> "$LOG_DIR/frontend.log" 2>&1 < /dev/null &
  disown 2>/dev/null || true
else
  log "frontend already up (200)"
fi

# 4) انتظار برای آماده‌شدن هر دو
B="000"; F="000"
for _ in $(seq 1 45); do
  B="$(check_backend)"; F="$(check_frontend)"
  if [ "$B" = "200" ] && [ "$F" = "200" ]; then
    log "READY: backend=200 frontend=200"
    exit 0
  fi
  sleep 1
done

log "WARNING after wait: backend=$B frontend=$F (ادامه می‌دهیم؛ ممکن است کند بالا آمده باشند)"
exit 0
