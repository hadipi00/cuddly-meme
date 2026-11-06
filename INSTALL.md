# نصب مدرس‌یار روی سرور (Debian / Ubuntu)

نصب‌کنندهٔ آسان یک‌خطی — فقط روت، فقط دبیان (یا اوبونتو). همه‌چیز را خودکار بالا می‌آورد و **بعد از خروج از سرور (logout) و ری‌استارت سرور هم سایت روشن می‌ماند** (سرویس systemd با اجرای خودکار).

---

## ۱) پیش‌نیازها

| مورد | مقدار |
| --- | --- |
| سیستم‌عامل | Debian 11/12/13 یا Ubuntu 20.04+ (با systemd) |
| دسترسی | روت (`root`) — فقط روت |
| رم | حداقل ۱GB (اگر کم باشد، نصب‌کننده خودش ۲GB سوییپ می‌سازد) |
| پورت | ۸۰ (اگر اشغال باشد خودکار ۸۰۸۰ می‌شود) |
| اینترنت | برای دانلود Node.js و نصب پکیج‌ها لازم است |

## ۲) آپلود سورس و نصب

**روش الف — آپلود فایل زیپ (پیشنهادی):**

```bash
# روی کامپیوتر خودتان: از گیت‌هاب Download ZIP بزنید، بعد:
scp cuddly-meme-main.zip root@IP_سرور:/root/

# روی سرور:
cd /root
apt install -y unzip || true
unzip cuddly-meme-main.zip
cd cuddly-meme-main
bash install.sh
```

**روش ب — اگر سرور به گیت‌هاب دسترسی دارد:**

```bash
apt install -y git
git clone https://github.com/hadipi00/cuddly-meme.git
cd cuddly-meme
bash install.sh
```

همین. نصب‌کننده به‌صورت خودکار:

1. `curl`, `xz`, `tar` و **Node.js 24 LTS** را نصب می‌کند (اگر نباشند)
2. سورس را در `/opt/modaresyar` مستقر می‌کند
3. پکیج‌های فرانت و بک‌اند را نصب و فرانت را build می‌کند
4. فایل پیکربندی `.env` را با آی‌پی سرور می‌سازد
5. سرویس `systemd` می‌سازد و فعال می‌کند (Restart=always + اجرای خودکار بعد از reboot)
6. پورت را در فایروال ufw باز می‌کند (اگر ufw فعال باشد)
7. در آخر **آدرس سایت و اکانت‌های شروع** را نشان می‌دهد

## ۳) بعد از نصب

آدرس سایت: `http://IP_سرور` (با `modaresyar url` هم قابل دیدن است)

اکانت‌های نمونهٔ اولیه (فقط بار اول ساخته می‌شوند؛ **اولین ورود رمز عوض می‌شود**):

| نقش | نام کاربری | رمز |
| --- | --- | --- |
| مدیر | `admin` | `12345678` |
| مدرس | `reza` | `12345678` |
| دانش‌آموز | `sara` | `12345678` |

> اگر نمی‌خواهید اکانت نمونه ساخته شود: در `/opt/modaresyar/.env` خط `ALLOW_SEED=1` را به `DISABLE_SEED=1` تغییر دهید و `systemctl restart modaresyar` بزنید (فقط قبل از اولین اجرا اثر دارد).

## ۴) مدیریت روزمره

```bash
modaresyar status        # وضعیت سرویس
modaresyar restart       # ری‌استارت
modaresyar logs -f       # لاگ زنده
modaresyar url           # آدرس سایت
modaresyar backup        # بکاپ فوری دیتابیس + فایل‌های آپلودی (بدون توقف سایت)
modaresyar update        # به‌روزرسانی با سورس جدید
```

معادل‌های مستقیم systemd هم کار می‌کند: `systemctl restart modaresyar`، `journalctl -u modaresyar -f`

## ۵) به‌روزرسانی (نسخهٔ جدید)

سورس جدید را روی سرور اکسترکت کنید (هر جا) و داخلش:

```bash
bash install.sh
```

همین. نصب‌کننده idempotent است:

- **دیتابیس** (`server/data/modaresyar.db`) و **کلید JWT** حفظ می‌شوند
- **فایل‌های آپلودی آزمون‌ها** (`server/uploads/`) حفظ می‌شوند
- فایل `.env` شما دست نمی‌خورد
- پکیج‌ها تازه نصب و فرانت دوباره build می‌شود و سرویس ری‌استارت می‌شود

یا داخل سرور بدون آپلود دستی: `modaresyar update` (بعد از جایگزینی سورس در `/opt/modaresyar`).

## ۶) پیکربندی

فایل: `/opt/modaresyar/.env` — بعد از هر تغییر: `systemctl restart modaresyar`

| متغیر | پیش‌فرض | توضیح |
| --- | --- | --- |
| `PORT` | `80` | پورت سایت |
| `PUBLIC_BASE_URL` | `http://IP` | آدرس عمومی — اگر دامنه دارید بگذارید `https://دامنه‌شما` |
| `ALLOW_SEED` / `DISABLE_SEED` | seed فعال | ساخت/عدم ساخت اکانت‌های نمونه |
| `ZARINPAL_MERCHANT_ID` | خالی | درگاه زرین‌پال (بدون آن حالت تست/mock است) |

تنظیمات درگاه و پیامک را بهتر است از **پنل مدیریت → تنظیمات** انجام دهید (در دیتابیس ذخیره می‌شود و به ری‌استارت نیاز ندارد).

## ۷) بکاپ و بازگردانی

```bash
modaresyar backup        # بکاپ آنی (VACUUM INTO — بدون قفل شدن سایت)
```

بکاپ‌ها در `/root/modaresyar-backups/` ذخیره می‌شوند (۱۰ نسخهٔ آخر). بازگردانی = توقف سرویس، جایگزینی فایل `.db`، روشن‌کردن:

```bash
systemctl stop modaresyar
cp /root/modaresyar-backups/modaresyar-db-XXXX.db /opt/modaresyar/server/data/modaresyar.db
systemctl start modaresyar
```

## ۸) عیب‌یابی

| مشکل | راه‌حل |
| --- | --- |
| سایت بالا نمی‌آید | `modaresyar logs` یا `journalctl -u modaresyar -f` |
| پورت ۸۰ اشغال | نصب‌کننده خودش ۸۰۸۰ می‌گذارد؛ یا در `.env` دستی `PORT=` را عوض کنید |
| بعد از تغییر `.env` اثر نکرد | `systemctl restart modaresyar` |
| خطای حافظه هنگام بیلد | نصب‌کننده سوییپ می‌سازد؛ دستی: `fallocate -l 2G /swapfile && mkswap /swapfile && swapon /swapfile` |
| Node قدیمی سیستم | نصب‌کننده Node 24 را در `/usr/local` جدا نصب می‌کند و Node سیستم را دست نمی‌زند |

## ۹) حذف کامل

```bash
bash install.sh --uninstall     # یا: modaresyar uninstall
```

قبل از حذف، از دیتابیس و فایل‌های آپلودی در `/root/modaresyar-backups/uninstall-…` بکاپ خودکار می‌گیرد.

## ۱۰) دو نکتهٔ امنیتی

1. **بعد از اولین ورود، رمز اکانت admin را حتماً عوض کنید** (خود سیستم اجبار می‌کند).
2. برای HTTPS، بعداً می‌توانید nginx یا caddy را جلوی سایت بگذارید (پورت سایت را در `.env` بگذارید مثلاً 3000 و پروکسی کنید). مدرس‌یار خودش با HTTP هم کامل کار می‌کند.
