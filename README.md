# مدرس‌یار | ModaresYar

پلتفرم جامع آموزش آنلاین — کلاس زنده (دوربین/اشتراک صفحه/تختهٔ تعاملی)، دوره‌های ضبط‌شده، آزمون آنلاین، رزومه‌ساز، فروشگاه و CRM.

React + Vite + Tailwind (فرانت) — Express + SQLite داخلی Node (بک‌اند) — بدون هیچ وابستگی دیتابیس خارجی.

## نصب روی سرور (Debian / Ubuntu — فقط روت)

```bash
bash install.sh
```

همین. راهنمای کامل: **[INSTALL.md](./INSTALL.md)**

بعد از نصب سایت روی `http://IP_سرور` بالا می‌آید و با سرویس systemd، بعد از logout و reboot هم روشن می‌ماند.

ابزار مدیریت: `modaresyar status | restart | logs | backup | update`

## اجرای محلی (توسعه)

```bash
npm install
cd server && npm install && cd ..
npm run build        # بیلد فرانت در dist/
npm run server       # بک‌اند روی پورت 4000 (سروِ فرانت بیلدشده هم می‌کند)
# یا حالت توسعه:
npm run dev          # Vite روی 3000 (پروکسی /api به 4000)
```
