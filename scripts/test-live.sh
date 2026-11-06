#!/bin/bash
# تست اجرایی سناریوی کلاس زنده — فید مستقل اشتراک صفحه + دوربین موازی
# پایه قابل تغییر:  B=http://127.0.0.1:4000/api bash scripts/test-live.sh
B=${B:-http://127.0.0.1:4123/api}
set -e
echo "== 1) ورود مدرس (u-reza) و دانش‌آموز (u-sara)"
TT=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"reza@demo.ir","password":"12345678"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
TS=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"sara@demo.ir","password":"12345678"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "teacher-token: ${TT:0:18}... student-token: ${TS:0:18}..."

echo "== 2) شروع کلاس l2 توسط مدرس"
curl -s -X POST $B/classes/l2/start -H "Authorization: Bearer $TT" | head -c 200; echo

echo "== 3) heartbeat دانش‌آموز (حضور)"
curl -s -X POST $B/classes/l2/heartbeat -H "Authorization: Bearer $TS" -H 'Content-Type: application/json' -d '{"hand":false}' | head -c 120; echo

# تکه webm جعلی ولی با هدر EBML واقعی تا looksLikeHeader تایید شود
python3 - <<'EOF'
import struct
hdr = bytes([0x1A,0x45,0xDF,0xA3]) + b'\x01\x00\x00\x00\x00\x00\x00\x00' + b'\x42\x82\x18\x42\x80\x74\x65\x73\x74' + bytes(64)
chunk = bytes([0x1F,0x43,0xB6,0x75]) + struct.pack('>I', 60) + bytes(60)
open('/tmp/wb-init.bin','wb').write(hdr)
open('/tmp/wb-chunk.bin','wb').write(chunk)
EOF

echo "== 4) آپلود فید دوربین مدرس (init + 3 تکه)"
curl -s -X POST "$B/classes/l2/media/up?k=teacher&init=1&mic=1&cam=1&fmt=webm&cd=vp8,opus" -H "Authorization: Bearer $TT" -H 'Content-Type: application/octet-stream' --data-binary @/tmp/wb-init.bin; echo
for i in 1 2 3; do curl -s -X POST "$B/classes/l2/media/up?k=teacher&init=0&fmt=webm" -H "Authorization: Bearer $TT" -H 'Content-Type: application/octet-stream' --data-binary @/tmp/wb-chunk.bin > /dev/null; done
echo "camera feed uploaded"

echo "== 5) آپلود فید اشتراک صفحه (کانال مستقل) (init + 2 تکه)"
curl -s -X POST "$B/classes/l2/media/up?k=teacher&screen=1&init=1&mic=0&fmt=webm&cd=vp8" -H "Authorization: Bearer $TT" -H 'Content-Type: application/octet-stream' --data-binary @/tmp/wb-init.bin; echo
for i in 1 2; do curl -s -X POST "$B/classes/l2/media/up?k=teacher&screen=1&init=0&fmt=webm" -H "Authorization: Bearer $TT" -H 'Content-Type: application/octet-stream' --data-binary @/tmp/wb-chunk.bin > /dev/null; done
echo "screen feed uploaded"

echo "== 6) گیرنده دانش‌آموز — هر دو فید باید بیایند (teacher + teacherScreen)"
curl -s "$B/classes/l2/media/feeds?cur=%7B%7D" -H "Authorization: Bearer $TS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
t, ts = d.get('teacher'), d.get('teacherScreen')
assert t and ts, f'FAIL: teacher={bool(t)} teacherScreen={bool(ts)}'
assert ts.get('screen') is True and ts.get('cam') is False, 'screen meta wrong'
assert t.get('screen') is False and t.get('cam') is True, 'camera meta wrong'
cur = {'t': {'s': t['sess'], 'q': t['chunks'][-1]['seq'] if t.get('chunks') else 0}, 'ts': {'s': ts['sess'], 'q': ts['chunks'][-1]['seq'] if ts.get('chunks') else 0}}
import urllib.parse
open('/tmp/cur.json','w').write(json.dumps(cur))
print(f\"OK — teacher sess={t['sess']} seq={t['seq']} | teacherScreen sess={ts['sess']} seq={ts['seq']}\")"

echo "== 7) polling با کرسر — فقط تکه‌های تازه (بدون reset)"
sleep 0.4
for i in 4 5; do curl -s -X POST "$B/classes/l2/media/up?k=teacher&init=0&fmt=webm" -H "Authorization: Bearer $TT" -H 'Content-Type: application/octet-stream' --data-binary @/tmp/wb-chunk.bin > /dev/null; done
CUR=$(python3 -c "import urllib.parse,json;print(urllib.parse.quote(open('/tmp/cur.json').read()))")
curl -s "$B/classes/l2/media/feeds?cur=$CUR" -H "Authorization: Bearer $TS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
t = d.get('teacher') or {}
assert not t.get('reset'), 'unexpected reset'
assert len(t.get('chunks') or []) == 2, f\"expected 2 fresh chunks, got {len(t.get('chunks') or [])}\"
print('OK — cursor polling: 2 fresh chunks, no reset')"

echo "== 8) قطع فقط فید صفحه (k=screen) — دوربین باید بماند"
curl -s -X POST "$B/classes/l2/media/stop?k=screen" -H "Authorization: Bearer $TT" > /dev/null
curl -s "$B/classes/l2/media/feeds?cur=%7B%7D" -H "Authorization: Bearer $TS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('teacher'), 'camera feed must survive'
assert not d.get('teacherScreen'), 'screen feed must be gone'
print('OK — screen feed stopped, camera alive')"

echo "== 9) گیت امنیتی: دانش‌آموز بدون can_speak نمی‌تواند آپلود کند"
CODE=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X POST "$B/classes/l2/media/up?k=student&init=1&fmt=webm" -H "Authorization: Bearer $TS" -H 'Content-Type: application/octet-stream' --data-binary @/tmp/wb-init.bin)
python3 -c "
import json
d = json.load(open('/tmp/resp.json'))
assert '$CODE' == '403' and d.get('noPerm'), f'FAIL: {CODE} {d}'
print('OK — student upload blocked (403 noPerm)')"

echo "== 10) گیت امنیتی: آپلود صفحه فقط برای مدرسِ همان کلاس (k=teacher&screen=1 از دانش‌آموز)"
CODE=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X POST "$B/classes/l2/media/up?k=teacher&screen=1&init=1&fmt=webm" -H "Authorization: Bearer $TS" -H 'Content-Type: application/octet-stream' --data-binary @/tmp/wb-init.bin)
python3 -c "
import json
d = json.load(open('/tmp/resp.json'))
assert '$CODE' == '403', f'FAIL: {CODE} {d}'
print('OK — student cannot use teacher screen channel (403)')"

echo "== 11) چت همچنان سالم"
curl -s -X POST $B/classes/l2/messages -H "Authorization: Bearer $TS" -H 'Content-Type: application/json' -d '{"body":"تست صفحه اشتراک ✓"}' | head -c 120; echo
curl -s "$B/classes/l2/messages?after=0" -H "Authorization: Bearer $TS" | python3 -c "import sys,json;d=json.load(sys.stdin);print('OK — messages:',len(d['messages']))"

echo "== 12) پایان کلاس"
curl -s -X POST $B/classes/l2/end -H "Authorization: Bearer $TT" | head -c 80; echo
echo "ALL LIVE-CLASS TESTS PASSED ✅"
