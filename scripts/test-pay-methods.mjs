/* تست E2E — روش‌های پرداخت: کارت‌به‌کارت کامل + کنترل روش‌ها از پنل ادمین + اینماد
 * جریان‌ها:
 *  ۱) تنظیمات پیش‌فرض + ذخیره اطلاعات کارت از پنل
 *  ۲) شروع سفارش کارت‌به‌کارت توسط دانش‌آموز (رزرو موجودی + orders pending)
 *  ۳) تأیید قبل از رسید → رد می‌شود؛ آپلود رسید → review
 *  ۴) دسترسی‌ها: دانش‌آموز دیگر/غیرمدیر نمی‌بیند؛ ادمین رسید تصویری می‌بیند
 *  ۵) تأیید ادمین → سفارش paid + پیامک؛ ردِ یک سفارش دیگر → برگشت موجودی + حذف ردیف‌ها
 *  ۶) خاموش/روشن‌کردن روش‌ها از پنل → صفحه تسویه و start مربوطه قفل می‌شود
 *  ۷) اینماد: ذخیره کد → /settings/public برمی‌گرداند
 * در پایان همه تنظیمات به حالت فعال برمی‌گردند (تست idempotent است) */
const B = 'http://localhost:4000/api'
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' — ' + name); if (!cond) process.exitCode = 1 }
const j = (r) => r.json()
const req = (t, path, opts = {}) => fetch(B + path, {
  ...opts,
  body: opts.body && typeof opts.body === 'object' ? JSON.stringify(opts.body) : opts.body,
  headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
}).then(j)

/* PNG یک‌پیکسلی معتبر برای رسید */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const login = async (id, pw) => {
  const r = await req(null, '/auth/login', { method: 'POST', body: { id, password: pw } })
  if (!r.token) throw new Error('login failed: ' + JSON.stringify(r))
  return r
}

const main = async () => {
  const admin = await login('admin', '12345678')
  const sara = await login('sara', '12345678')
  const amir = await login('amir', '12345678')

  /* ---- ۱) تنظیمات پیش‌فرض ---- */
  const cfg0 = await req(null, '/pay/config')
  ok('پیش‌فرض: هر دو روش روشن', cfg0.methods?.zarinpal === true && cfg0.methods?.card2card === true)

  /* ---- ۲) ذخیره اطلاعات کارت از پنل ادمین ---- */
  const badCard = await req(admin.token, '/admin/settings', { method: 'PUT', body: { c2c_card_number: 'abcدلخواه' } })
  ok('شماره کارت نامعتبر رد می‌شود', badCard.error && /رقم/.test(badCard.error))
  const sv = await req(admin.token, '/admin/settings', { method: 'PUT', body: {
    c2c_card_number: '6037-9976-1111-2222', c2c_card_bank: 'بانک ملی', c2c_card_holder: 'مؤسسه مدرسیار', c2c_note: 'واریز از طریق اپ بله‌پی رایگان است',
  } })
  ok('ذخیره اطلاعات کارت', sv.ok === true)
  const cfg1 = await req(null, '/pay/config')
  ok('کارت در config عمومی نمایش داده می‌شود', cfg1.card?.number === '6037-9976-1111-2222' && cfg1.card?.bank === 'بانک ملی')

  /* ---- ۳) شروع سفارش کارت‌به‌کارت ---- */
  const body = {
    items: [{ id: 'm1', kind: 'market', qty: 2 }],
    shipKey: 'prepaid',
    contact: { name: 'سارا محمدی', phone: '09120000002', email: 'sara@demo.ir', address: 'تهران، خیابان آزمایشی' },
  }
  const start = await req(sara.token, '/pay/card2card/start', { method: 'POST', body })
  ok('شروع سفارش کارت‌به‌کارت', start.ok === true && /^ORD-\d+$/.test(start.code || '') && start.card?.number === '6037-9976-1111-2222')
  const code = start.code

  /* سفارش واقعی در سفارش‌های من با gateway کارت‌به‌کارت */
  const myOrders1 = await req(sara.token, '/me/orders')
  const mine1 = (myOrders1.orders || []).filter((o) => o.code === code)
  ok('سفارش pending با gateway=card2card ثبت شد', mine1.length > 0 && mine1[0].gateway === 'card2card' && mine1[0].status === 'pending')

  /* موجودی رزرو شد — نسبت به قبل از سفارش (idempotent در اجراهای مکرر) */
  const stockOf = async (id) => {
    const pr = await req(null, '/products')
    const arr = Array.isArray(pr) ? pr : (pr.products || [])
    return arr.find((p) => p.id === id)?.stock
  }
  const stockBefore1 = await stockOf('m1')
  const startProbe = await req(sara.token, '/pay/card2card/start', { method: 'POST', body: { ...body, items: [{ id: 'm1', kind: 'market', qty: 1 }] } })
  const stockAfter = await stockOf('m1')
  ok('موجودی رزرو شد (کم‌شدن به اندازهٔ qty)', stockAfter === stockBefore1 - 1)
  /* پاک‌سازی سفارش پروب با رد ادمین (برگشت موجودی) */
  const listProbe = await req(admin.token, '/pay/admin/c2c')
  const probeRow = (listProbe.payments || []).find((p) => p.code === startProbe.code)
  await req(admin.token, `/pay/admin/c2c/${probeRow.authority}/reject`, { method: 'POST', body: {} })
  ok('پاک‌سازی پروب: موجودی برگشت', (await stockOf('m1')) === stockBefore1)

  /* ---- ۴) صف ادمین + گاردها ---- */
  const list1 = await req(admin.token, '/pay/admin/c2c')
  const row1 = (list1.payments || []).find((p) => p.code === code)
  ok('سفارش در صف ادمین است (بدون رسید)', row1 && row1.status === 'pending' && row1.hasReceipt === false)
  const earlyApprove = await req(admin.token, `/pay/admin/c2c/${row1.authority}/approve`, { method: 'POST', body: {} })
  ok('تأیید بدون رسید رد می‌شود', earlyApprove.error && /رسید/.test(earlyApprove.error))
  const amirView = await req(amir.token, `/pay/card2card/status/${code}`)
  ok('دانش‌آموز دیگر وضعیت سفارش سارا را نمی‌بیند', amirView.error)
  const noAdmin = await req(sara.token, '/pay/admin/c2c')
  ok('دانش‌آموز به صف ادمین دسترسی ندارد', noAdmin.error)

  /* ---- ۵) آپلود رسید ---- */
  const badImg = await req(sara.token, `/pay/card2card/${code}/receipt`, { method: 'POST', body: { image: 'data:text/html;base64,PGI+' } })
  ok('فایل غیرتصویری رد می‌شود', badImg.error && /تصویر/.test(badImg.error))
  const up = await req(sara.token, `/pay/card2card/${code}/receipt`, { method: 'POST', body: { image: PNG } })
  ok('آپلود رسید موفق', up.ok === true && up.status === 'review')
  const st1 = await req(sara.token, `/pay/card2card/status/${code}`)
  ok('وضعیت = review + hasReceipt', st1.status === 'review' && st1.hasReceipt === true)

  /* تصویر رسید: ادمین می‌بیند (PNG)، سارا نمی‌تواند (گارد ادمین) */
  const imgR = await fetch(`${B}/pay/admin/c2c/${row1.authority}/receipt`, { headers: { Authorization: `Bearer ${admin.token}` } })
  ok('ادمین تصویر رسید را می‌بیند (image/png)', imgR.status === 200 && (imgR.headers.get('content-type') || '').includes('image/png'))
  const imgNo = await fetch(`${B}/pay/admin/c2c/${row1.authority}/receipt`, { headers: { Authorization: `Bearer ${sara.token}` } })
  ok('غیرمدیر رسید را نمی‌بیند (۴۰۳)', imgNo.status === 403)

  /* ---- ۶) تأیید ادمین → paid + دسترسی ---- */
  const ap = await req(admin.token, `/pay/admin/c2c/${row1.authority}/approve`, { method: 'POST', body: {} })
  ok('تأیید ادمین', ap.ok === true && !!ap.refId)
  const myOrders2 = await req(sara.token, '/me/orders')
  const mine2 = (myOrders2.orders || []).filter((o) => o.code === code)
  ok('سفارش بعد از تأیید = paid', mine2.length > 0 && mine2[0].status === 'paid')
  const ap2 = await req(admin.token, `/pay/admin/c2c/${row1.authority}/approve`, { method: 'POST', body: {} })
  ok('تأیید دوباره idempotent است', ap2.ok === true)

  /* ---- ۷) جریان رد رسید ---- */
  const stockBefore2 = await stockOf('m2')
  const start2 = await req(sara.token, '/pay/card2card/start', { method: 'POST', body: { ...body, items: [{ id: 'm2', kind: 'market', qty: 1 }] } })
  ok('سفارش دوم ساخته شد', start2.ok === true)
  const up2 = await req(sara.token, `/pay/card2card/${start2.code}/receipt`, { method: 'POST', body: { image: PNG } })
  ok('رسید سفارش دوم آپلود شد', up2.ok === true)
  const list2 = await req(admin.token, '/pay/admin/c2c')
  const row2 = (list2.payments || []).find((p) => p.code === start2.code)
  const rj = await req(admin.token, `/pay/admin/c2c/${row2.authority}/reject`, { method: 'POST', body: {} })
  ok('رد رسید توسط ادمین', rj.ok === true)
  const st2 = await req(sara.token, `/pay/card2card/status/${start2.code}`)
  ok('وضعیت = rejected', st2.status === 'rejected')
  const myOrders3 = await req(sara.token, '/me/orders')
  ok('ردیف‌های سفارشِ ردشده حذف شدند', !(myOrders3.orders || []).some((o) => o.code === start2.code))
  const prods2 = await req(null, '/products')
  const m2b = (Array.isArray(prods2) ? prods2 : (prods2.products || [])).find((p) => p.id === 'm2')
  ok('موجودی بعد از رد برگشت', m2b ? m2b.stock === stockBefore2 : true)

  /* ---- ۸) خاموش/روشن‌کردن روش‌ها از پنل ---- */
  await req(admin.token, '/admin/settings', { method: 'PUT', body: { pay_card2card_enabled: '' } })
  const cfg2 = await req(null, '/pay/config')
  const off = await req(sara.token, '/pay/card2card/start', { method: 'POST', body })
  ok('روش غیرفعال → config و start هر دو قفل', cfg2.methods?.card2card === false && off.error && /غیرفعال/.test(off.error))
  await req(admin.token, '/admin/settings', { method: 'PUT', body: { pay_card2card_enabled: '1', pay_zarinpal_enabled: '' } })
  const cfg3 = await req(null, '/pay/config')
  const zOff = await req(sara.token, '/pay/zarinpal/start', { method: 'POST', body })
  ok('زرین‌پال غیرفعال → start قفل', cfg3.methods?.zarinpal === false && zOff.error && /غیرفعال/.test(zOff.error))
  await req(admin.token, '/admin/settings', { method: 'PUT', body: { pay_zarinpal_enabled: '1' } })
  const cfg4 = await req(null, '/pay/config')
  ok('بازگشت به حالت فعال (پاک‌سازی)', cfg4.methods?.zarinpal === true && cfg4.methods?.card2card === true)

  /* ---- ۹) اینماد ---- */
  await req(admin.token, '/admin/settings', { method: 'PUT', body: { enamad_html: '<a href="https://trustseal.enamad.ir/?id=test">eNAMAD</a>' } })
  const pub = await req(null, '/settings/public')
  ok('اینماد در تنظیمات عمومی برمی‌گردد', (pub.enamadHtml || '').includes('trustseal.enamad.ir'))
  await req(admin.token, '/admin/settings', { method: 'PUT', body: { enamad_html: '' } })
}

main().catch((e) => { console.error('FAIL — exception:', e.message); process.exitCode = 1 })
