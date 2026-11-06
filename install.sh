#!/usr/bin/env bash
# =====================================================================
#  مدرس‌یار (ModaresYar) — نصب‌کنندهٔ آسان برای سرور Debian/Ubuntu
# =====================================================================
#  اجرا (با دسترسی روت، داخل پوشهٔ سورس):
#      bash install.sh
#
#  این اسکریپت:
#    • Node.js ۲۴ (LTS) را در صورت نبود نصب می‌کند
#    • سورس را در /opt/modaresyar مستقر می‌کند (دیتابیس و فایل‌های آپلودی
#      در به‌روزرسانی‌ها دست‌نخورده می‌مانند)
#    • فرانت را build می‌کند و همه‌چیز را روی یک پورت (پیش‌فرض ۸۰) سرو می‌کند
#    • سرویس systemd می‌سازد → بعد از logout و reboot هم سایت بالا می‌ماند
#
#  سایر کارها:
#      bash install.sh --uninstall     ← حذف کامل (با بکاپ خودکار از دیتابیس)
#
#  متغیرهای محیطی (برای حالت خاص/تست — معمولاً لازم نیست):
#      MODARESYAR_DEST=...            مسیر نصب (پیش‌فرض /opt/modaresyar)
#      MODARESYAR_PORT=...            پورت سایت (پیش‌فرض ۸۰؛ اشغال بود → ۸۰۸۰)
#      MODARESYAR_NO_SYSTEMD=1        بدون systemd (اجرای مستقیم — فقط تست)
#      MODARESYAR_ALLOW_NON_ROOT=1    اجازهٔ اجرای بدون روت (فقط تست)
# =====================================================================
set -uo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
umask 022

DEST="${MODARESYAR_DEST:-/opt/modaresyar}"
SERVICE="modaresyar"
NODE_VERSION="v24.22.2"   # LTS — با همین نسخه تست شده
NODE_PREFIX="/usr/local/lib/nodejs"

# ---------------- ابزارهای چاپ رنگی ----------------
if [ -t 1 ]; then
  C_G=$'\033[1;32m'; C_Y=$'\033[1;33m'; C_R=$'\033[1;31m'; C_C=$'\033[1;36m'; C_B=$'\033[1m'; C_0=$'\033[0m'
else
  C_G=''; C_Y=''; C_R=''; C_C=''; C_B=''; C_0=''
fi
step() { printf '\n%s==> %s%s\n' "$C_C" "$*" "$C_0"; }
ok()   { printf '%s  ✔ %s%s\n' "$C_G" "$*" "$C_0"; }
warn() { printf '%s  ⚠ %s%s\n' "$C_Y" "$*" "$C_0"; }
die()  { printf '%s  ✘ خطا: %s%s\n' "$C_R" "$*" "$C_0" >&2; exit 1; }

# ---------------- پیش‌فرض‌ها ----------------
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IS_ROOT=0; [ "$(id -u)" = 0 ] && IS_ROOT=1
HAVE_SYSTEMD=0
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then HAVE_SYSTEMD=1; fi

# =====================================================================
#  حالت حذف نصب
# =====================================================================
if [ "${1:-}" = "--uninstall" ]; then
  step "حذف کامل مدرس‌یار (با بکاپ خودکار از دیتابیس و فایل‌ها)…"
  if [ "$HAVE_SYSTEMD" = 1 ]; then
    systemctl stop "$SERVICE" 2>/dev/null || true
    systemctl disable "$SERVICE" 2>/dev/null || true
    rm -f "/etc/systemd/system/${SERVICE}.service"
    systemctl daemon-reload 2>/dev/null || true
    ok "سرویس systemd حذف شد"
  fi
  if [ -d "$DEST/server/data" ] || [ -d "$DEST/server/uploads" ]; then
    BK="/root/${SERVICE}-backups/uninstall-$(date +%Y%m%d-%H%M%S)"
    if mkdir -p "$BK" 2>/dev/null; then
      tar -czf "$BK/data-and-uploads.tar.gz" -C "$DEST/server" data uploads 2>/dev/null || true
      ok "بکاپ دیتابیس: $BK/data-and-uploads.tar.gz"
    else
      warn "ساخت بکاپ ناموفق بود — قبل از حذف، از $DEST/server/data بکاپ دستی بگیرید!"
      die "برای اطمینان، حذف انجام نشد — دیتا را دستی بکاپ کنید و دوباره تلاش کنید"
    fi
  fi
  rm -f "/usr/local/bin/${SERVICE}"
  rm -rf "$DEST"
  ok "حذف نصب کامل شد — دیتای قبلی در بکاپ بالا نگه داشته شده است"
  exit 0
fi

# =====================================================================
#  ۰) پیش‌نیازها
# =====================================================================
printf '%s\n' "$C_B"
printf '  ╔══════════════════════════════════════════════════╗\n'
printf '  ║        نصب‌کنندهٔ مدرس‌یار — ModaresYar            ║\n'
printf '  ║     پلتفرم آموزش آنلاین | Debian / Ubuntu         ║\n'
printf '  ╚══════════════════════════════════════════════════╝\n'
printf '%s' "$C_0"

if [ "$IS_ROOT" != 1 ] && [ "${MODARESYAR_ALLOW_NON_ROOT:-0}" != "1" ]; then
  die "این اسکریپت باید با دسترسی روت اجرا شود:  sudo bash install.sh"
fi

[ -f "$SRC/package.json" ] || die "فایل package.json در $(pwd) پیدا نشد — این اسکریپت را داخل پوشهٔ سورس مدرس‌یار اجرا کنید"
[ -f "$SRC/server/index.js" ] || die "پوشهٔ server/ کنار install.sh نیست — سورس کامل را آپلود کرده‌اید؟"

if [ "$HAVE_SYSTEMD" != 1 ] && [ "${MODARESYAR_NO_SYSTEMD:-0}" != "1" ]; then
  die "systemd پیدا نشد — این نصب‌کننده برای Debian/Ubuntu با systemd است (برای تست: MODARESYAR_NO_SYSTEMD=1)"
fi

# =====================================================================
#  ۱) بسته‌های پایهٔ سیستم
# =====================================================================
if [ "$IS_ROOT" = 1 ] && command -v apt-get >/dev/null 2>&1; then
  step "۱/۵  نصب بسته‌های پایه (curl, xz, tar)…"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >/dev/null 2>&1 || warn "apt-get update ناموفق بود (اینترنت/آینهٔ دبیان را بعداً چک کنید)"
  apt-get install -y -qq curl ca-certificates xz-utils tar >/dev/null 2>&1 \
    || warn "نصب برخی بسته‌های پایه ناموفق بود — اگر curl/xz از قبل هست، مشکلی نیست"
  ok "بسته‌های پایه آماده‌اند"
else
  step "۱/۵  بسته‌های پایه — رد شد (حالت بدون apt)"
fi

# =====================================================================
#  ۲) Node.js (نسخهٔ >= ۲۲.۱۳ که node:sqlite داخلی دارد)
# =====================================================================
node_ok() { command -v node >/dev/null 2>&1 && node -e "require('node:sqlite')" 2>/dev/null; }

# آیا پورت اشغال است؟ (خطا/عدم توان بستن = اشغال)
port_busy() { "$NODE_BIN" -e "const s=require('net').createServer();s.once('error',()=>process.exit(1));s.listen($1,'0.0.0.0',()=>{s.close();process.exit(0)})" 2>/dev/null || return 0; return 1; }

step "۲/۵  بررسی Node.js…"
if node_ok; then
  ok "Node.js $(node -v) آماده است"
else
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64)  NARCH="x64" ;;
    aarch64) NARCH="arm64" ;;
    *) die "معماری پردازنده ($ARCH) پشتیبانی نمی‌شود" ;;
  esac
  TARBALL="node-${NODE_VERSION}-linux-${NARCH}.tar.xz"
  URL="https://nodejs.org/dist/${NODE_VERSION}/${TARBALL}"
  echo "     دانلود Node.js ${NODE_VERSION} (${NARCH}) از nodejs.org…"
  TMP_TGZ="/tmp/${TARBALL}"
  curl -fL --retry 3 --max-time 300 -o "$TMP_TGZ" "$URL" \
    || die "دانلود Node.js ناموفق بود — اتصال اینترنت سرور را چک کنید: $URL"
  mkdir -p "$NODE_PREFIX"
  tar -xJf "$TMP_TGZ" -C "$NODE_PREFIX"
  rm -f "$TMP_TGZ"
  ln -sf "${NODE_PREFIX}/node-${NODE_VERSION}-linux-${NARCH}/bin/node" /usr/local/bin/node
  ln -sf "${NODE_PREFIX}/node-${NODE_VERSION}-linux-${NARCH}/bin/npm"  /usr/local/bin/npm
  ln -sf "${NODE_PREFIX}/node-${NODE_VERSION}-linux-${NARCH}/bin/npx"  /usr/local/bin/npx
  hash -r
  node_ok || die "Node.js نصب شد اما node:sqlite کار نمی‌کند"
  ok "Node.js $(node -v) نصب شد"
fi
NODE_BIN="$(command -v node)"

# =====================================================================
#  ۳) استقرار سورس در $DEST (بدون دست زدن به دیتابیس/آپلودها)
# =====================================================================
step "۳/۵  استقرار سورس در ${DEST}…"

# پورت: اول از .env قبلی بخوان؛ وگرنه ۸۰ (اگر اشغال بود ۸۰۸۰)
PORT=""
if [ -n "${MODARESYAR_PORT:-}" ]; then
  PORT="$MODARESYAR_PORT"
elif [ -f "$DEST/.env" ]; then
  PORT="$(grep -E '^PORT=' "$DEST/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]\"' || true)"
fi
if [ -z "$PORT" ]; then
  PORT="80"
  if port_busy "$PORT"; then
    warn "پورت ۸۰ اشغال است → پورت ۸۰۸۰ استفاده می‌شود (بعداً در $DEST/.env قابل تغییر است)"
    PORT="8080"
    port_busy "$PORT" && die "پورت‌های ۸۰ و ۸۰۸۰ هر دو اشغال‌اند"
  fi
fi
echo "     پورت سایت: $PORT"

# توقف سرویس قبلی قبل از جایگزینی فایل‌ها
if [ "$HAVE_SYSTEMD" = 1 ]; then
  systemctl stop "$SERVICE" 2>/dev/null || true
elif [ -f "$DEST/${SERVICE}.pid" ]; then
  kill "$(cat "$DEST/${SERVICE}.pid" 2>/dev/null)" 2>/dev/null || true
  for _ in $(seq 1 5); do port_busy "$PORT" || break; sleep 1; done
  if port_busy "$PORT"; then
    warn "پروسهٔ قدیمی هنوز روی پورت $PORT است — توقف اجباری…"
    pkill -f "$NODE_BIN server/index.js" 2>/dev/null || true
    sleep 1
  fi
fi

# هنوز اشغال است؟ (= سرویس بیگانه روی این پورت است)
port_busy "$PORT" && die "پورت $PORT اشغال است — سرویس دیگری روی این پورت هست (در $DEST/.env مقدار PORT را عوض کنید)"

mkdir -p "$DEST"
tar -C "$SRC" -cf - \
  --exclude='node_modules' --exclude='server/data' --exclude='server/uploads' \
  --exclude='dist' --exclude='.git' --exclude='.env' --exclude='.zscripts' \
  --exclude='*.log' --exclude='upload' --exclude='*.pid' \
  . | tar -C "$DEST" -xf -
ok "سورس کپی شد (دیتابیس/آپلودهای قبلی حفظ شدند)"

# =====================================================================
#  ۴) وابستگی‌ها + بیلد فرانت
# =====================================================================
step "۴/۵  نصب وابستگی‌ها (ممکن است چند دقیقه طول بکشد)…"
cd "$DEST" || die "رفتن به $DEST ناموفق بود"

export NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
if [ -f package-lock.json ]; then
  npm ci --loglevel=error || npm install --loglevel=error || die "نصب وابستگی‌های فرانت ناموفق بود"
else
  npm install --loglevel=error || die "نصب وابستگی‌های فرانت ناموفق بود"
fi
ok "وابستگی‌های فرانت نصب شد"

( cd server && { npm ci --omit=dev --loglevel=error || npm install --omit=dev --loglevel=error; } ) \
  || die "نصب وابستگی‌های بک‌اند ناموفق بود"
ok "وابستگی‌های بک‌اند نصب شد"

# سوییپ اضطراری برای سرورهای کم‌رم (بیلد vite به ۱GB رام جواب نمی‌دهد)
if [ "$IS_ROOT" = 1 ]; then
  MEM_KB="$(awk '/MemTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 999999999)"
  SW_KB="$(awk '/SwapTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
  if [ "${MEM_KB:-0}" -lt 1900000 ] && [ "${SW_KB:-0}" -lt 100000 ]; then
    if [ ! -f /swapfile ]; then
      warn "رم کم است (‌<۲GB بدون سوییپ) — ساخت سوییپ ۲GB برای بیلد امن…"
      fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
      chmod 600 /swapfile && mkswap -q /swapfile 2>/dev/null && swapon /swapfile 2>/dev/null || true
      grep -q '^/swapfile' /etc/fstab 2>/dev/null || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    else
      swapon /swapfile 2>/dev/null || true
    fi
    ok "سوییپ فعال شد"
  fi
fi

step "بیلد فرانت‌اند (vite build)…"
npm run build >/tmp/${SERVICE}-build.log 2>&1 || { tail -30 /tmp/${SERVICE}-build.log; die "بیلد فرانت ناموفق بود — لاگ بالا را ببینید"; }
[ -f "$DEST/dist/index.html" ] || die "بیلد انجام شد اما dist/index.html نیست"
ok "بیلد کامل شد ($(du -sh "$DEST/dist" 2>/dev/null | cut -f1))"

# =====================================================================
#  ۵) فایل پیکربندی + سرویس systemd + اجرا
# =====================================================================
step "۵/۵  پیکربندی و اجرای سرویس…"

if [ ! -f "$DEST/.env" ]; then
  SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' | grep -E '^[0-9]+\.' || true)"
  [ -n "$SERVER_IP" ] || SERVER_IP="$(ip -4 addr show scope global 2>/dev/null | awk '/inet /{gsub(/\/.*/,"",$2); print $2; exit}' || true)"
  [ -n "$SERVER_IP" ] || SERVER_IP="127.0.0.1"
  ENV_PORT_SUFFIX=""; [ "$PORT" != 80 ] && ENV_PORT_SUFFIX=":$PORT"
  cat > "$DEST/.env" <<EOF
# ===== پیکربندی مدرس‌یار =====
# بعد از هر تغییر:  systemctl restart ${SERVICE}

NODE_ENV=production
PORT=$PORT
# آدرس عمومی سایت (برای نقشهٔ سایت و درگاه پرداخت) — اگر دامنه دارید بگذارید: https://دامنه‌شما
PUBLIC_BASE_URL=http://${SERVER_IP}${ENV_PORT_SUFFIX}
# ساخت اکانت‌های نمونه در اولین اجرا (admin/reza/sara با رمز عمومی + اجبار تغییر رمز)
# برای غیرفعال‌کردن: این خط را به DISABLE_SEED=1 تغییر دهید
ALLOW_SEED=1
EOF
  ok "فایل پیکربندی ساخته شد: $DEST/.env"
else
  ok "فایل پیکربندی از قبل موجود است (دست نخورد)"
fi

if [ "$HAVE_SYSTEMD" = 1 ]; then
  cat > "/etc/systemd/system/${SERVICE}.service" <<EOF
[Unit]
Description=ModaresYar (مدرسیار) — وب‌سایت آموزشی
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$DEST
EnvironmentFile=$DEST/.env
ExecStart=$NODE_BIN server/index.js
Restart=always
RestartSec=3
KillSignal=SIGTERM
TimeoutStopSec=15
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable "$SERVICE" >/dev/null 2>&1 || true
  systemctl restart "$SERVICE"
  ok "سرویس systemd ساخته و فعال شد (اجرای خودکار بعد از reboot)"
else
  # حالت بدون systemd — فقط برای تست (روی سرور واقعی Debian همیشه systemd هست)
  (
    cd "$DEST" || exit 1
    set -a
    . "./.env"
    set +a
    setsid nohup "$NODE_BIN" server/index.js < /dev/null >> "${SERVICE}.log" 2>&1 &
    echo $! > "${SERVICE}.pid"
  )
  warn "systemd در دسترس نیست — اجرای مستقیم (فقط برای تست!)"
fi

# helper خط فرمان
if cp "$DEST/${SERVICE}.sh" "/usr/local/bin/${SERVICE}" 2>/dev/null; then
  chmod +x "/usr/local/bin/${SERVICE}"
  HELPER_MSG="✔ نصب شد (دستور modaresyar در ترمینال)"
else
  HELPER_MSG="⚠ بدون روت نصب نشد — در اجرای روت نصب می‌شود"
fi

# =====================================================================
#  انتظار برای بالا آمدن سایت
# =====================================================================
step "انتظار برای بالا آمدن سایت…"
HEALTH_OK=0
for _ in $(seq 1 60); do
  R="$(curl -s --max-time 2 "http://127.0.0.1:${PORT}/api/health" 2>/dev/null || true)"
  case "$R" in *'"ok":true'*) HEALTH_OK=1; break ;; esac
  sleep 1
done
if [ "$HEALTH_OK" != 1 ]; then
  echo "----- آخرین لاگ سرویس -----"
  if [ "$HAVE_SYSTEMD" = 1 ]; then journalctl -u "$SERVICE" -n 30 --no-pager -o cat 2>/dev/null || true
  else tail -30 "$DEST/${SERVICE}.log" 2>/dev/null || true; fi
  die "سایت بالا نیامد — لاگ بالا را ببینید (یا: journalctl -u ${SERVICE} -f)"
fi
ok "API سالم است (http://127.0.0.1:${PORT}/api/health ← ok)"

PAGE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${PORT}/" 2>/dev/null || true)"
[ "$PAGE" = "200" ] || warn "صفحهٔ اصلی کد $PAGE داد (اگر ۲۰۰ نیست: journalctl -u ${SERVICE} -f)"
ok "صفحهٔ اصلی سرو می‌شود"

# فایروال — فقط اگر ufw فعال باشد
if [ "$IS_ROOT" = 1 ] && command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw allow "$([ "$PORT" = 80 ] && echo 80/tcp || echo "$PORT/tcp")" >/dev/null 2>&1 || true
  ok "پورت $PORT در ufw باز شد"
fi

# =====================================================================
#  پایان — خلاصه
# =====================================================================
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' | grep -E '^[0-9]+\.' || true)"
[ -n "$SERVER_IP" ] || SERVER_IP="$(ip -4 addr show scope global 2>/dev/null | awk '/inet /{gsub(/\/.*/,"",$2); print $2; exit}' || true)"
[ -n "$SERVER_IP" ] || SERVER_IP="SERVER_IP"
URL_SUFFIX=""; [ "$PORT" != 80 ] && URL_SUFFIX=":$PORT"

printf '\n%s' "$C_G"
printf '  ════════════════════════════════════════════════════════════\n'
printf '   ✔ مدرس‌یار با موفقیت نصب و اجرا شد!\n'
printf '  ════════════════════════════════════════════════════════════\n'
printf '%s\n' "$C_0"
printf '   آدرس سایت      : %shttp://%s%s%s\n' "$C_B" "$SERVER_IP" "$URL_SUFFIX" "$C_0"
printf '   پوشهٔ نصب      : %s\n' "$DEST"
printf '   دیتابیس        : %s/server/data/modaresyar.db\n' "$DEST"
printf '   پیکربندی       : %s/.env  (بعد از تغییر: systemctl restart %s)\n' "$DEST" "$SERVICE"
printf '\n'
printf '   %sاکانت‌های شروع (نمونه):%s\n' "$C_B" "$C_0"
printf '     مدیر        admin  / 12345678   ← اولین ورود رمز عوض می‌شود\n'
printf '     مدرس        reza   / 12345678   ← اولین ورود رمز عوض می‌شود\n'
printf '     دانش‌آموز   sara   / 12345678   ← اولین ورود رمز عوض می‌شود\n'
printf '     %s(اگر نمی‌خواهید اکانت نمونه ساخته شود: در .env بگذارید DISABLE_SEED=1)%s\n' "$C_Y" "$C_0"
printf '\n'
printf '   %sفرمان‌های مدیریت:%s\n' "$C_B" "$C_0"
printf '     modaresyar status      وضعیت سرویس\n'
printf '     modaresyar restart     ری‌استارت\n'
printf '     modaresyar logs        لاگ زنده/اخیر\n'
printf '     modaresyar backup      بکاپ فوری از دیتابیس\n'
printf '     modaresyar update      به‌روزرسانی با سورس جدید (دیتابیس حفظ می‌شود)\n'
printf '     modaresyar url         نمایش آدرس سایت\n'
printf '\n'
printf '   %sبه‌روزرسانی آینده:%s سورس جدید را در سرور اکسترکت کنید و دوباره %sbash install.sh%s بزنید.\n' "$C_B" "$C_0" "$C_B" "$C_0"
printf '   %sحذف کامل:%s bash install.sh --uninstall   (بکاپ خودکار از دیتا)\n' "$C_B" "$C_0"
printf '   %sلاگ زنده:%s journalctl -u %s -f\n\n' "$C_B" "$C_0" "$SERVICE"
printf '%s   ابزار مدیریت: %s\n%s' "$C_C" "$HELPER_MSG" "$C_0"
