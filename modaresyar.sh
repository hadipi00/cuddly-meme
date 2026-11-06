#!/usr/bin/env bash
# =====================================================================
#  modaresyar — ابزار خط فرمان مدیریت سرویس مدرس‌یار
#  نصب‌شده توسط install.sh در /usr/local/bin/modaresyar
# =====================================================================
set -uo pipefail

SERVICE="modaresyar"
DEST="${MODARESYAR_DEST:-/opt/modaresyar}"
BK_DIR="/root/${SERVICE}-backups"

have() { command -v "$1" >/dev/null 2>&1; }

port_of() {
  [ -f "$DEST/.env" ] && grep -E '^PORT=' "$DEST/.env" | head -1 | cut -d= -f2- | tr -d '[:space:]"'
}

site_url() {
  local ip port
  ip="$(hostname -I 2>/dev/null | awk '{print $1}' | grep -E '^[0-9]+\.' || true)"
  [ -n "$ip" ] || ip="127.0.0.1"
  port="$(port_of)"; port="${port:-80}"
  echo "http://${ip}$([ "$port" = 80 ] && echo "" || echo ":$port")"
}

do_backup() {
  [ -d "$DEST/server/data" ] || { echo "✘ دیتابیس پیدا نشد: $DEST/server/data"; return 1; }
  mkdir -p "$BK_DIR" || { echo "✘ ساخت پوشهٔ بکاپ ناموفق (root نیستید؟)"; return 1; }
  local ts dest
  ts="$(date +%Y%m%d-%H%M%S)"
  dest="$BK_DIR/${SERVICE}-db-${ts}.db"
  echo "→ بکاپ دیتابیس (بدون توقف سرویس)…"
  if ( cd "$DEST/server" && node -e "
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync('data/modaresyar.db');
    db.exec(\"VACUUM INTO '${dest}'\");
    db.close();
    console.log('   ✔ ' + '${dest}');
  " ); then
    # فایل‌های آپلودی آزمون‌ها (اگر هستند) کنار بکاپ دیتابیس
    if [ -d "$DEST/server/uploads" ] && [ -n "$(ls -A "$DEST/server/uploads" 2>/dev/null)" ]; then
      tar -czf "$BK_DIR/${SERVICE}-uploads-${ts}.tar.gz" -C "$DEST/server" uploads \
        && echo "   ✔ $BK_DIR/${SERVICE}-uploads-${ts}.tar.gz"
    fi
    # نگه‌داشتن ۱۰ بکاپ آخر
    ls -1t "$BK_DIR"/${SERVICE}-db-*.db 2>/dev/null | tail -n +11 | xargs -r rm -f
    ls -1t "$BK_DIR"/${SERVICE}-uploads-*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
    echo "✔ بکاپ کامل شد (۱۰ نسخهٔ آخر نگه داشته می‌شود)"
  else
    echo "✘ بکاپ ناموفق بود"; return 1
  fi
}

case "${1:-help}" in
  status)  have systemctl && systemctl status "$SERVICE" --no-pager -l || { echo "(بدون systemd)"; ps aux | grep "[s]erver/index.js" || echo "سرویس در حال اجرا نیست"; } ;;
  start)   have systemctl && { systemctl start "$SERVICE" && echo "✔ سرویس روشن شد — $(site_url)"; } || echo "بدون systemd: bash $DEST/../.. غیرفعال" ;;
  stop)    have systemctl && { systemctl stop "$SERVICE" && echo "✔ سرویس خاموش شد"; } || echo "بدون systemd" ;;
  restart) have systemctl && { systemctl restart "$SERVICE" && echo "✔ سرویس ری‌استارت شد — $(site_url)"; } || echo "بدون systemd" ;;
  logs)
    if have systemctl; then
      if [ "${2:-}" = "-f" ] || [ "${2:-}" = "follow" ]; then journalctl -u "$SERVICE" -f --no-pager -o cat
      else journalctl -u "$SERVICE" -n "${2:-100}" --no-pager -o cat; fi
    else tail -n "${2:-100}" "$DEST/${SERVICE}.log"; fi
    ;;
  url)      echo "آدرس سایت: $(site_url)" ;;
  backup)   do_backup ;;
  update)
    echo "→ به‌روزرسانی مدرس‌یار (دیتابیس و فایل‌های آپلودی حفظ می‌شوند)…"
    [ -f "$DEST/install.sh" ] || { echo "✘ $DEST/install.sh پیدا نشد — سورس جدید را آپلود و install.sh را دستی اجرا کنید"; exit 1; }
    bash "$DEST/install.sh"
    ;;
  uninstall) [ -f "$DEST/install.sh" ] && bash "$DEST/install.sh" --uninstall || { echo "✘ install.sh پیدا نشد"; exit 1; } ;;
  *)
    cat <<'EOF'
modaresyar — ابزار مدیریت مدرس‌یار

  modaresyar status            وضعیت سرویس
  modaresyar start | stop | restart
  modaresyar logs [n|-f]       n لاگ آخر یا لاگ زنده (modaresyar logs -f)
  modaresyar url               آدرس فعلی سایت
  modaresyar backup            بکاپ فوری دیتابیس (+فایل‌های آپلودی)
  modaresyar update            به‌روزرسانی با سورس جدید (دیتابیس حفظ می‌شود)
  modaresyar uninstall         حذف کامل (بکاپ خودکار)

پیکربندی:  /opt/modaresyar/.env   →   systemctl restart modaresyar
EOF
    ;;
esac
