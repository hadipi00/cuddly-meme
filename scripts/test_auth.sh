#!/bin/bash
# =====================================================================
# تست جامع جریان‌های احراز هویت مدرس‌یار — ورود دوگانه، OTP، ثبت‌نام،
# سشن ماندگار (چرخش + مهلت تب‌ها + کشف سرقت)، بازیابی رمز، CRM ادمین
# =====================================================================
B=http://127.0.0.1:4000/api
DB=/home/z/my-project/server/data/modaresyar.db
PASS=0; FAIL=0
chk() {
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1 — expected[$2] got[$3]"; fi
}
jqget() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(\"d$1\"))" 2>/dev/null; }

# شناسه‌های تصادفی برای هر اجرا — تداخلی با دیتای قبلی نیست
NEWPHONE="0935$(date +%N | cut -c1-7)"
USERNAME="navid$(date +%N | cut -c1-5)"
echo "  (run user: $USERNAME / $NEWPHONE)"

echo "── ۱) ورود با نام‌کاربری/ایمیل/تلفن + رمز ──"
R=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"id":"sara","password":"12345678"}')
chk "login by username sara" "سارا محمدی" "$(echo "$R" | jqget "['user']['name']")"
chk "login has refreshToken" "True" "$(echo "$R" | python3 -c 'import sys,json;print("refreshToken" in json.load(sys.stdin))')"

R=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"id":"sara@demo.ir","password":"12345678"}')
chk "login by email sara@demo.ir" "u-sara" "$(echo "$R" | jqget "['user']['id']")"

R=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"id":"09120000002","password":"12345678"}')
chk "login by phone 09120000002" "u-sara" "$(echo "$R" | jqget "['user']['id']")"

chk "wrong password → 401" "401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"id":"sara","password":"WRONG"}')"

echo "── ۲) ورود با کد پیامکی (OTP login) ──"
R=$(curl -s -X POST $B/auth/otp/request -H 'Content-Type: application/json' -d '{"phone":"09120000002","purpose":"login"}')
DEV=$(echo "$R" | jqget "['devCode']")
chk "otp request → devCode (mock mode)" "True" "$(python3 -c "print(bool('$DEV'))")"
chk "otp request says sent=false (mock)" "False" "$(echo "$R" | jqget "['sent']")"
R=$(curl -s -X POST $B/auth/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"09120000002\",\"code\":\"$DEV\",\"purpose\":\"login\"}")
chk "otp verify → logged in as sara" "u-sara" "$(echo "$R" | jqget "['user']['id']")"

curl -s -X POST $B/auth/otp/request -H 'Content-Type: application/json' -d '{"phone":"09120000004","purpose":"login"}' >/dev/null
R=$(curl -s -X POST $B/auth/otp/verify -H 'Content-Type: application/json' -d '{"phone":"09120000004","code":"000000","purpose":"login"}')
chk "wrong otp code → error msg" "True" "$(echo "$R" | python3 -c 'import sys,json;print(bool(json.load(sys.stdin).get("error")))')"
D3=$(curl -s -X POST $B/auth/otp/request -H 'Content-Type: application/json' -d '{"phone":"09123456789","purpose":"login"}' | jqget "['devCode']")
chk "unregistered phone → 404" "404" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"09123456789\",\"code\":\"$D3\",\"purpose\":\"login\"}")"

echo "── ۳) ثبت‌نام پیامکی: شماره → کد → مشخصات ──"
R=$(curl -s -X POST $B/auth/otp/request -H 'Content-Type: application/json' -d "{\"phone\":\"$NEWPHONE\",\"purpose\":\"register\"}")
DEV=$(echo "$R" | jqget "['devCode']")
R=$(curl -s -X POST $B/auth/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"$NEWPHONE\",\"code\":\"$DEV\",\"purpose\":\"register\"}")
REG=$(echo "$R" | jqget "['regToken']")
chk "register otp → regToken issued" "True" "$(python3 -c "print(bool('$REG'))")"
chk "complete without regToken → 400" "400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/register/complete -H 'Content-Type: application/json' -d '{"firstName":"a","lastName":"b","username":"newuser1","password":"secret1"}')"
R=$(curl -s -X POST $B/auth/register/complete -H 'Content-Type: application/json' -d "{\"regToken\":\"$REG\",\"firstName\":\"نوید\",\"lastName\":\"رضایی\",\"username\":\"$USERNAME\",\"password\":\"navid123\"}")
chk "register complete → user created" "$USERNAME" "$(echo "$R" | jqget "['user']['username']")"
chk "new user phone stored (CRM)" "$NEWPHONE" "$(echo "$R" | jqget "['user']['phone']")"
NAV_TOKEN=$(echo "$R" | jqget "['token']")
NAV_RT=$(echo "$R" | jqget "['refreshToken']")
# نام‌کاربری تکراری — با شمارهٔ جدید
P2="0935$(date +%N | cut -c3-9)"
D2=$(curl -s -X POST $B/auth/otp/request -H 'Content-Type: application/json' -d "{\"phone\":\"$P2\",\"purpose\":\"register\"}" | jqget "['devCode']")
R2=$(curl -s -X POST $B/auth/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"$P2\",\"code\":\"$D2\",\"purpose\":\"register\"}")
REG2=$(echo "$R2" | jqget "['regToken']")
chk "duplicate username → 409" "409" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/register/complete -H 'Content-Type: application/json' -d "{\"regToken\":\"$REG2\",\"firstName\":\"x\",\"lastName\":\"y\",\"username\":\"$USERNAME\",\"password\":\"abcdef\"}")"

echo "── ۴) سشن ماندگار: چرخش + مهلت تب‌ها + کشف سرقت ──"
R=$(curl -s -X POST $B/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$NAV_RT\"}")
RT2=$(echo "$R" | jqget "['refreshToken']")
chk "refresh #1 rotates → new refresh token" "True" "$(python3 -c "print(bool('$RT2') and '$RT2' != '$NAV_RT')")"
# تب دوم با توکنِ چرخیده — در مهلت ۴۵ثانیه‌ای → توکن فعلی برمی‌گردد (بدون قطع کاربر)
R=$(curl -s -X POST $B/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$NAV_RT\"}")
chk "grace: tab2 gets current refresh token" "$RT2" "$(echo "$R" | jqget "['refreshToken']")"
GRACE_TOK=$(echo "$R" | jqget "['token']")
chk "grace: fresh access token issued" "True" "$(python3 -c "print(bool('$GRACE_TOK'))")"
# استفاده از توکن چرخیده بعد از مهلت = سرقت → ابطال کل خانواده (شبیه‌سازی با جابه‌جایی last_used)
python3 - "$DB" "$NAV_RT" <<'PYEOF'
import sys, hashlib, sqlite3, time
db, rt = sys.argv[1], sys.argv[2]
h = hashlib.sha256(rt.encode()).hexdigest()
c = sqlite3.connect(db)
c.execute("UPDATE auth_sessions SET last_used = ? WHERE token_hash = ?", (int(time.time()*1000) - 60_000, h))
c.commit()
PYEOF
chk "reuse beyond grace → 401 (theft detected)" "401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$NAV_RT\"}")"
chk "whole family revoked → current token dead too" "401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT2\"}")"
# خروج واقعی → ابطال سشن
R=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d "{\"id\":\"$USERNAME\",\"password\":\"navid123\"}")
RT3=$(echo "$R" | jqget "['refreshToken']")
curl -s -X POST $B/auth/logout -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT3\"}" >/dev/null
chk "refresh after logout → 401" "401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT3\"}")"

echo "── ۵) بازیابی رمز فراموش‌شده ──"
R=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"id":"amir","password":"12345678"}')
AMIR_RT=$(echo "$R" | jqget "['refreshToken']")
R=$(curl -s -X POST $B/auth/otp/request -H 'Content-Type: application/json' -d '{"phone":"09120000003","purpose":"reset"}')
DEV=$(echo "$R" | jqget "['devCode']")
R=$(curl -s -X POST $B/auth/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"09120000003\",\"code\":\"$DEV\",\"purpose\":\"reset\"}")
RESET=$(echo "$R" | jqget "['resetToken']")
chk "reset otp → resetToken" "True" "$(python3 -c "print(bool('$RESET'))")"
R=$(curl -s -X POST $B/auth/reset-password -H 'Content-Type: application/json' -d "{\"resetToken\":\"$RESET\",\"password\":\"amir-new-99\"}")
RESET_TOK=$(echo "$R" | jqget "['token']")
chk "reset-password ok + auto login" "True" "$(python3 -c "print(bool('$RESET_TOK'))")"
chk "old refresh revoked after reset" "401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$AMIR_RT\"}")"
chk "login with new password" "امیرحسین طباطبایی" "$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"id":"amir","password":"amir-new-99"}' | jqget "['user']['name']")"
echo "  (restore amir demo password directly in DB — demo-guard blocks generic pw via API by design)"
H=$(cd /home/z/my-project/server && node -e "console.log(require('bcryptjs').hashSync('12345678',8))")
python3 - "$DB" "$H" <<'PYEOF2'
import sys, sqlite3
db, h = sys.argv[1], sys.argv[2]
c = sqlite3.connect(db)
c.execute("UPDATE users SET password_hash = ?, must_change_pw = 1 WHERE email = 'amir@demo.ir'", (h,))
c.commit()
PYEOF2
chk "amir password restored to demo" "200" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"id":"amir","password":"12345678"}')"

echo "── ۶) CRM ادمین: لیست کاربران + CSV ──"
AD=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"id":"admin","password":"12345678"}' | jqget "['token']")
R=$(curl -s $B/admin/users -H "Authorization: Bearer $AD")
chk "admin users list has phone" "09120000002" "$(echo "$R" | python3 -c "import sys,json;us=json.load(sys.stdin)['users'];print(next(u['phone'] for u in us if u['id']=='u-sara'))")"
chk "admin users list has username" "sara" "$(echo "$R" | python3 -c "import sys,json;us=json.load(sys.stdin)['users'];print(next(u['username'] for u in us if u['id']=='u-sara'))")"
CODE=$(curl -s -o /tmp/crm.csv -w '%{http_code}' $B/admin/users.csv -H "Authorization: Bearer $AD")
chk "CSV export (admin) → 200" "200" "$CODE"
chk "CSV has phone column" "True" "$(head -1 /tmp/crm.csv | grep -q 'phone' && echo True || echo False)"
chk "CSV has sara row" "True" "$(grep -q '09120000002' /tmp/crm.csv && echo True || echo False)"
chk "CSV forbidden for student" "403" "$(curl -s -o /dev/null -w '%{http_code}' $B/admin/users.csv -H "Authorization: Bearer $NAV_TOKEN")"
chk "users list forbidden for student" "403" "$(curl -s -o /dev/null -w '%{http_code}' $B/admin/users -H "Authorization: Bearer $NAV_TOKEN")"

echo "── ۷) محافظت‌های نرخ ──"
# سقف ساعتی ارسال کد برای یک شماره (۵ در ساعت) — ۷ بار درخواست
for i in 1 2 3 4 5 6 7; do
  curl -s -X POST $B/auth/otp/request -H 'Content-Type: application/json' -d '{"phone":"09359990001","purpose":"register"}' > /dev/null
done
R=$(curl -s -X POST $B/auth/otp/request -H 'Content-Type: application/json' -d '{"phone":"09359990001","purpose":"register"}')
chk "hourly sms cap reached" "True" "$(echo "$R" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(bool(d.get("error")))')"
# کول‌داون ۶۰ثانیه‌ای درخواست پشت‌سرهم (شمارهٔ تازه)
curl -s -X POST $B/auth/otp/request -H 'Content-Type: application/json' -d '{"phone":"09359990002","purpose":"register"}' >/dev/null
R=$(curl -s -X POST $B/auth/otp/request -H 'Content-Type: application/json' -d '{"phone":"09359990002","purpose":"register"}')
chk "60s resend cooldown" "True" "$(echo "$R" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(("wait" in d) or bool(d.get("error")))')"

echo "── ۸) /auth/me و سشن هر تب ──"
R=$(curl -s $B/auth/me -H "Authorization: Bearer $NAV_TOKEN" 2>/dev/null)
# (توکن navid باطل شده — ورود مجدد)
NT=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d "{\"id\":\"$USERNAME\",\"password\":\"navid123\"}" | jqget "['token']")
R=$(curl -s $B/auth/me -H "Authorization: Bearer $NT")
chk "me returns user + fresh token" "$USERNAME" "$(echo "$R" | jqget "['user']['username']")"

echo ""
echo "════ نتیجه: $PASS موفق / $FAIL ناموفق ════"
[ $FAIL -eq 0 ] && echo "ALL GREEN ✅" || echo "ATTENTION ❌"
