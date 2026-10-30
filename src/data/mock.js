// ============ داده‌های نمونه — بعد از اتصال بک‌اند، این فایل با API جایگزین می‌شود ============

export const courseCats = ['برنامه‌نویسی', 'طراحی گرافیک', 'زبان‌های خارجی', 'کنکور و درسی', 'کسب‌وکار', 'مهارت‌های نرم']

export const teachers = [
 { id: 't1', name: 'رضا کریمی', role: 'مدرس برنامه‌نویسی و استاد ارشد آکادمی', bio: '۱۲ سال تجربه تدریس برنامه‌نویسی و معماری نرم‌افزار؛ مدرس بیش از ۸٬۰۰۰ دانشجو در سراسر کشور.', skills: [['جاوااسکریپت', 96], ['React', 92], ['Node.js', 88], ['پایتون', 85]], rating: 4.9, students: 8200, classesCount: 34, color: 'grad-0', joined: '1398/03/12', status: 'active' },
 { id: 't2', name: 'مریم احمدی', role: 'مدرس طراحی و تجربه کاربری', bio: 'طراح ارشد UI/UX با نمونه‌کارهای بین‌المللی؛ علاقه‌مند به پرورش طراحان فردا.', skills: [['Figma', 95], ['UI Design', 93], ['موشن گرافیک', 80]], rating: 4.8, students: 5400, classesCount: 21, color: 'grad-4', joined: '1399/06/01', status: 'active' },
 { id: 't3', name: 'علی نادری', role: 'مدرس زبان انگلیسی و آیلتس', bio: 'دارای مدرک CELTA از کمبریج و نمره ۸.۵ آیلتس؛ روش تدریس تعاملی و مکالمه‌محور.', skills: [['IELTS', 97], ['مکالمه', 94], ['گرامر', 90]], rating: 4.7, students: 6100, classesCount: 27, color: 'grad-2', joined: '1399/09/20', status: 'active' },
 { id: 't4', name: 'حسین موسوی', role: 'مدرس ریاضیات و کنکور', bio: 'نویسنده کتاب‌های کمک‌آموزشی ریاضی؛ رتبه‌ساز کنکور سراسری با ۱۵ سال سابقه.', skills: [['ریاضی کنکور', 98], ['حساب دیفرانسیل', 92], ['آمار', 84]], rating: 4.9, students: 9300, classesCount: 41, color: 'grad-3', joined: '1397/02/15', status: 'active' },
 { id: 't5', name: 'نگار رستمی', role: 'مدرس بازاریابی دیجیتال', bio: 'مشاور بازاریابی برندهای بزرگ؛ متخصص گروت و تبلیغات دیجیتال.', skills: [['دیجیتال مارکتینگ', 91], ['سئو', 89], ['کپی‌رایتینگ', 86]], rating: 4.6, students: 3900, classesCount: 16, color: 'grad-1', joined: '1400/01/10', status: 'active' },
]

const sec = (t, lessons) => ({ title: t, lessons })
export const courses = [
 {
 id: 1, title: 'دوره جامع ری‌اکت و Next.js — از صفر تا پروژه واقعی', teacher: 'رضا کریمی', teacherId: 't1', cat: 'برنامه‌نویسی',
 price: 2480000, oldPrice: 3900000, rating: 4.9, students: 3260, hours: 42, lessonsCount: 128, level: 'مقدماتی تا پیشرفته',
 type: 'recorded', badge: 'پرفروش‌ترین', icon: 'atom', color: 'grad-2',
 desc: 'در این دوره از پایه‌ای‌ترین مفاهیم جاوااسکریپت مدرن شروع می‌کنیم و قدم‌به‌قدم تا ساخت سه پروژه واقعی و قابل ارائه در رزومه پیش می‌رویم. تمام کدها به‌صورت گیت ارائه می‌شود.',
 features: ['۱۲۸ ویدیوی آموزشی با کیفیت 4K', '۳ پروژه واقعی قابل ارائه در رزومه', 'پشتیبانی دائمی توسط مدرس', 'آزمون و تمرین بعد از هر فصل', 'گواهی‌نامه معتبر پایان دوره', 'دسترسی مادام‌العمر به آپدیت‌ها'],
 curriculum: [
 sec('فصل اول: جاوااسکریپت مدرن', [['پیش‌نیازها و نصب ابزارها', '12:40'], ['let، const و توابع', '18:20'], ['آرایه‌ها و متدهای پیشرفته', '24:10'], ['Promises و Async/Await', '21:35']]),
 sec('فصل دوم: ورود به ری‌اکت', [['اولین کامپوننت', '15:00'], ['State و Props', '19:45'], ['هوک‌های پرکاربرد', '26:30'], ['مدیریت فرم‌ها', '17:20']]),
 sec('فصل سوم: پروژه فروشگاه آنلاین', [['طراحی ساختار پروژه', '14:10'], ['سبد خرید و Context', '28:40'], ['اتصال به API', '22:15'], ['استقرار روی هاست', '11:50']]),
 ],
 },
 {
 id: 2, title: 'طراحی UI/UX حرفه‌ای با فیگما + ساخت پورتفولیو', teacher: 'مریم احمدی', teacherId: 't2', cat: 'طراحی گرافیک',
 price: 1890000, oldPrice: 2800000, rating: 4.8, students: 2140, hours: 31, lessonsCount: 94, level: 'مقدماتی',
 type: 'recorded', badge: 'محبوب', icon: 'palette', color: 'grad-4',
 desc: 'یاد بگیرید مثل یک طراح حرفه‌ای فکر کنید؛ از مبانی تئوری رنگ و تایپوگرافی تا طراحی کامل اپلیکیشن و ساخت پورتفولیوی جذاب.',
 features: ['۹۴ ویدیوی آموزشی', 'طراحی ۲ اپلیکیشن کامل', 'فایل‌های فیگما پروژه‌ها', 'بازخورد مستقیم روی تمرین‌ها'],
 curriculum: [
 sec('فصل اول: مبانی طراحی', [['تئوری رنگ', '16:00'], ['تایپوگرافی فارسی', '20:30'], ['گرید و ترکیب‌بندی', '18:45']]),
 sec('فصل دوم: فیگما پیشرفته', [['Auto Layout', '22:00'], ['کامپوننت و Variant', '25:10'], ['پروتوتایپ تعاملی', '19:30']]),
 ],
 },
 {
 id: 3, title: 'آموزش آیلتس ۷+ — استراتژی‌های چهار مهارت', teacher: 'علی نادری', teacherId: 't3', cat: 'زبان‌های خارجی',
 price: 3200000, oldPrice: 4500000, rating: 4.7, students: 1890, hours: 56, lessonsCount: 160, level: 'متوسط',
 type: 'recorded', icon: 'gradcap', color: 'grad-5',
 desc: 'کامل‌ترین دوره آمادگی آیلتس با تحلیل نمونه سوالات واقعی، نکات آزمون‌کننده‌محور و ده‌ها آزمون آزمایشی با تصحیح.',
 features: ['آزمون آزمایشی ماهانه', 'تصحیح رایتینگ توسط مدرس', 'بانک ۵۰۰ واژه آکادمیک', 'کلاس‌های رفع اشکال زنده'],
 curriculum: [
 sec('فصل اول: لیسنینگ', [['انواع سوالات', '18:00'], ['تکنیک پارافریز', '21:10'], ['آزمون کامل', '35:00']]),
 sec('فصل دوم: ریدینگ', [['مدیریت زمان', '16:40'], ['Matching Headings', '19:20'], ['True/False/Not Given', '23:00']]),
 ],
 },
 {
 id: 4, title: 'ریاضیات کنکور — صفر تا صد پادمان و مثلثات', teacher: 'حسین موسوی', teacherId: 't4', cat: 'کنکور و درسی',
 price: 2100000, rating: 4.9, students: 4520, hours: 48, lessonsCount: 110, level: 'کنکور',
 type: 'recorded', badge: 'ویژه کنکور', icon: 'sigma', color: 'grad-3',
 desc: 'تدریس کامل مباحث ریاضی کنکور با هزاران تست و ترفندهای حل سریع؛ به‌همراه برنامه مطالعاتی هفتگی.',
 features: ['۳۵۰۰ تست طبقه‌بندی شده', 'جلسات تست‌زنی زنده', 'دفترچه حل تمرین PDF', 'برنامه مطالعاتی اختصاصی'],
 curriculum: [
 sec('فصل اول: پادمان', [['مفاهیم پایه', '14:30'], ['تحلیل عبارت‌های جبری', '20:00'], ['تست‌های ترکیبی', '25:40']]),
 sec('فصل دوم: مثلثات', [['دایره مثلثاتی', '18:00'], ['معادلات مثلثاتی', '22:30']]),
 ],
 },
 {
 id: 5, title: 'دیجیتال مارکتینگ و رشد کسب‌وکار آنلاین', teacher: 'نگار رستمی', teacherId: 't5', cat: 'کسب‌وکار',
 price: 1750000, oldPrice: 2400000, rating: 4.6, students: 1620, hours: 26, lessonsCount: 72, level: 'مقدماتی تا متوسط',
 type: 'recorded', icon: 'chart', color: 'grad-1',
 desc: 'از تعریف پرسونا و قیف فروش تا ساخت کمپین‌های تبلیغاتی سودده؛ همراه با مطالعه موردی برندهای ایرانی.',
 features: ['قالب‌های آماده کمپین', 'مطالعه موردی واقعی', 'کارگاه تبلیغات گوگل'],
 curriculum: [
 sec('فصل اول: استراتژی', [['پرسونا و بازار هدف', '15:00'], ['قیف فروش', '17:30']]),
 sec('فصل دوم: تبلیغات', [['گوگل ادز', '24:00'], ['اینستاگرام مارکتینگ', '20:10']]),
 ],
 },
 {
 id: 6, title: 'پایتون برای نوجوانان — کدنویسی به زبان ساده', teacher: 'رضا کریمی', teacherId: 't1', cat: 'برنامه‌نویسی',
 price: 1290000, rating: 4.8, students: 2830, hours: 22, lessonsCount: 66, level: 'مقدماتی',
 type: 'recorded', badge: 'مناسب نوجوان', icon: 'terminal', color: 'grad-0',
 desc: 'دوره‌ای شاد و پروژه‌محور برای علاقه‌مندان ۱۲ سال به بالا؛ ساخت بازی و برنامه‌های کاربردی با پایتون.',
 features: ['پروژه‌های کوچک و جذاب', 'بدون نیاز به پیش‌زمینه', 'مناسب هدیه به نوجوانان'],
 curriculum: [
 sec('فصل اول: شروع', [['پایتون چیست؟', '10:00'], ['اولین برنامه', '12:30']]),
 sec('فصل دوم: بازی‌سازی', [['بازی حدس عدد', '18:00'], ['بازی مار', '28:00']]),
 ],
 },
 {
 id: 7, title: 'اکسل پیشرفته و داشبوردسازی مدیریتی', teacher: 'نگار رستمی', teacherId: 't5', cat: 'کسب‌وکار',
 price: 1490000, rating: 4.5, students: 1240, hours: 18, lessonsCount: 58, level: 'متوسط تا پیشرفته',
 type: 'recorded', icon: 'spreadsheet', color: 'grad-3',
 desc: 'فرمول‌نویسی حرفه‌ای، Pivot، Power Query و ساخت داشبوردهای مدیریتی که مدیرها عاشقش می‌شوند.',
 features: ['فایل‌های تمرین واقعی', 'قالب داشبورد آماده', 'تمرین‌های چالشی'],
 curriculum: [
 sec('فصل اول: توابع کلیدی', [['XLOOKUP', '14:00'], ['توابع شرطی', '16:30']]),
 sec('فصل دوم: داشبورد', [['Pivot Table', '20:00'], ['طراحی داشبورد', '24:30']]),
 ],
 },
 {
 id: 8, title: 'مکالمه انگلیسی روزمره — از رستوران تا مصاحبه شغلی', teacher: 'علی نادری', teacherId: 't3', cat: 'زبان‌های خارجی',
 price: 990000, rating: 4.7, students: 3110, hours: 15, lessonsCount: 45, level: 'مقدماتی',
 type: 'recorded', badge: 'اقتصادی', icon: 'chat', color: 'grad-2',
 desc: '۴۵ موقعیت واقعی مکالمه با تلفظ صحیح و نقش‌آفرینی؛ اعتماد به نفس کامل در گفتگوهای روزمره.',
 features: ['سناریوهای واقعی', 'تمرین تلفظ با هوش مصنوعی', 'فلش‌کارت واژگان'],
 curriculum: [
 sec('فصل اول: موقعیت‌های پایه', [['سفر و فرودگاه', '12:00'], ['رستوران و کافه', '11:30']]),
 sec('فصل دوم: محیط کار', [['مصاحبه شغلی', '16:00'], ['جلسات کاری', '14:20']]),
 ],
 },
 {
 id: 9, title: 'شیمی سه‌آموزشی کنکور — حل تست در ۳۰ ثانیه', teacher: 'حسین موسوی', teacherId: 't4', cat: 'کنکور و درسی',
 price: 1980000, oldPrice: 2600000, rating: 4.8, students: 2050, hours: 38, lessonsCount: 92, level: 'کنکور',
 type: 'recorded', icon: 'flask', color: 'grad-5',
 desc: 'ترفندهای سریع حل تست شیمی با تمرکز بر مفهوم؛ شامل کامل‌ترین مرور استوکیومتری و ترمودینامیک.',
 features: ['خلاصه‌نویسی تصویری', '۲۰۰۰ تست با پاسخ تشریحی', 'آزمون‌های شبیه‌ساز'],
 curriculum: [
 sec('فصل اول: استوکیومتری', [['مول و مولار', '15:00'], ['مسائل وزنی-حجمی', '21:00']]),
 sec('فصل دوم: ترمودینامیک', [['آنتریپی و آنتالپی', '19:30']]),
 ],
 },
 {
 id: 10, title: 'فن بیان و ارائه حرفه‌ای — حرف‌هایی که فروش می‌کنند', teacher: 'مریم احمدی', teacherId: 't2', cat: 'مهارت‌های نرم',
 price: 890000, rating: 4.6, students: 1480, hours: 12, lessonsCount: 34, level: 'همه سطوح',
 type: 'recorded', icon: 'mic', color: 'grad-4',
 desc: 'تکنیک‌های عملی سخنرانی، زبان بدن و روایت‌سازی؛ ضبط کردن تمرین‌ها و دریافت بازخورد از مدرس.',
 features: ['بازخورد ویدیویی روی تمرین', 'قالب آماده ارائه', 'تمرین‌های روزانه ۱۰ دقیقه‌ای'],
 curriculum: [
 sec('فصل اول: اعتماد به نفس', [['مدیریت استرس', '13:00'], ['زبان بدن', '15:40']]),
 sec('فصل دوم: ساخت ارائه', [['روایت‌سازی', '17:00']]),
 ],
 },
]

export const liveClasses = [
 { id: 'l1', title: 'ریاضی ۳ — مشتق و کاربردها', teacher: 'حسین موسوی', teacherId: 't4', day: 0, start: '16:00', dur: 90, price: 350000, cap: 30, enrolled: 24, status: 'filling', icon: 'sigma', color: 'grad-3', date: '2026-11-02', desc: 'کلاس زنده حل تمرین با پرسش و پاسخ مستقیم.' },
 { id: 'l2', title: 'کارگاه React — هوک‌های پیشرفته', teacher: 'رضا کریمی', teacherId: 't1', day: 0, start: '18:00', dur: 120, price: 0, cap: 50, enrolled: 41, status: 'filling', icon: 'atom', color: 'grad-0', date: '2026-11-02', desc: 'کارگاه عملی رایگان برای دانشجوهای دوره ری‌اکت.' },
 { id: 'l3', title: 'کلاب مکالمه انگلیسی — هفته‌ای دو جلسه', teacher: 'علی نادری', teacherId: 't3', day: 1, start: '17:00', dur: 60, price: 180000, cap: 20, enrolled: 17, status: 'filling', icon: 'chat', color: 'grad-2', date: '2026-11-03', desc: 'بحث آزاد با موضوعات هفتگی و تصحیح لحظه‌ای.' },
 { id: 'l4', title: 'کریتیک پورتفولیو طراحی', teacher: 'مریم احمدی', teacherId: 't2', day: 2, start: '19:00', dur: 90, price: 250000, cap: 15, enrolled: 15, status: 'full', icon: 'palette', color: 'grad-4', date: '2026-11-04', desc: 'بازخورد حرفه‌ای روی نمونه‌کارهای دانشجوها.' },
 { id: 'l5', title: 'شیمی کنکور — آزمونک هفتگی', teacher: 'حسین موسوی', teacherId: 't4', day: 3, start: '10:00', dur: 150, price: 150000, cap: 100, enrolled: 62, status: 'open', icon: 'flask', color: 'grad-5', date: '2026-11-05', desc: 'آزمون ۳۰ سواله + تحلیل کامل در کلاس.' },
 { id: 'l6', title: 'استارتاپ اسکول — جلسه منتورینگ', teacher: 'نگار رستمی', teacherId: 't5', day: 4, start: '20:00', dur: 90, price: 0, cap: 80, enrolled: 35, status: 'open', icon: 'rocket', color: 'grad-1', date: '2026-11-06', desc: 'نشست هفتگی رایگان بررسی ایده کسب‌وکار.' },
 { id: 'l7', title: 'ریاضی ۲ — حد و پیوستگی', teacher: 'حسین موسوی', teacherId: 't4', day: 5, start: '16:00', dur: 90, price: 350000, cap: 30, enrolled: 19, status: 'open', icon: 'sigma', color: 'grad-3', date: '2026-11-07', desc: 'کلاس زنده مباحث حد و پیوستگی.' },
 { id: 'l8', title: 'پایتون — حل تمرین پروژه‌ها', teacher: 'رضا کریمی', teacherId: 't1', day: 2, start: '14:00', dur: 60, price: 0, cap: 40, enrolled: 28, status: 'open', icon: 'terminal', color: 'grad-0', date: '2026-11-04', desc: 'رفع اشکال پروژه‌های دانشجوها.' },
 { id: 'l9', title: 'کارگاه Context و مدیریت State', teacher: 'رضا کریمی', teacherId: 't1', day: 3, start: '18:00', dur: 90, price: 0, cap: 40, enrolled: 36, status: 'filling', icon: 'atom', color: 'grad-0', date: '2026-11-05', desc: 'مدیریت state در مقیاس بزرگ با Context و reducer.' },
 { id: 'l10', title: 'پرسش و پاسخ پروژه نهایی', teacher: 'رضا کریمی', teacherId: 't1', day: 5, start: '18:00', dur: 90, price: 0, cap: 25, enrolled: 22, status: 'filling', icon: 'terminal', color: 'grad-0', date: '2026-11-07', desc: 'جلسه رفع اشکال گروهی پروژه پایانی دوره ری‌اکت.' },
]

// ---- weekly schedule seed (student view): {day, slot, title, teacher, color, liveId?} ----
export const seedSchedule = [
 { day: 0, slot: 4, title: 'ریاضی ۳ — مشتق', teacher: 'حسین موسوی', color: 'cb-amber', liveId: 'l1' },
 { day: 0, slot: 5, title: 'کارگاه React', teacher: 'رضا کریمی', color: 'cb-teal', liveId: 'l2' },
 { day: 1, slot: 4, title: 'کلاب مکالمه', teacher: 'علی نادری', color: 'cb-sky', liveId: 'l3' },
 { day: 2, slot: 3, title: 'حل تمرین پایتون', teacher: 'رضا کریمی', color: 'cb-teal', liveId: 'l8' },
 { day: 2, slot: 6, title: 'کریتیک پورتفولیو', teacher: 'مریم احمدی', color: 'cb-pink', liveId: 'l4' },
 { day: 3, slot: 2, title: 'آزمونک شیمی', teacher: 'حسین موسوی', color: 'cb-orange', liveId: 'l5' },
 { day: 3, slot: 5, title: 'کارگاه Context', teacher: 'رضا کریمی', color: 'cb-teal', liveId: 'l9' },
 { day: 4, slot: 6, title: 'منتورینگ استارتاپ', teacher: 'نگار رستمی', color: 'cb-violet', liveId: 'l6' },
 { day: 5, slot: 5, title: 'پرسش‌وپاسخ پروژه', teacher: 'رضا کریمی', color: 'cb-teal', liveId: 'l10' },
 { day: 5, slot: 4, title: 'ریاضی ۲ — حد', teacher: 'حسین موسوی', color: 'cb-amber', liveId: 'l7' },
 { day: 1, slot: 1, title: 'مرور فیزیک — خودخوان', teacher: '—', color: 'cb-green' },
]

// ---- مدرس‌مارکت ----
export const marketCats = ['نوشت‌افزار', 'لوازم هنری', 'لوازم اداری', 'دانش‌آموزی', 'پک ویژه']
export const products = [
 { id: 'm1', name: 'خودنویس مدل ۲۰۲۶ طلایی', cat: 'نوشت‌افزار', price: 485000, oldPrice: 620000, rating: 4.8, stock: 34, icon: 'pen', sold: 67, specs: [["جنس بدنه", "فلز و پلاستیک درجه یک"], ["نوع نوک", "۰٫۵ میلی‌متر — نرم‌نویس"], ["کشور سازنده", "ژاپن"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-3', badge: 'پرفروش' },
 { id: 'm2', name: 'پک ۲۴ خودکار رنگی نرم‌نویس', cat: 'نوشت‌افزار', price: 189000, rating: 4.6, stock: 120, icon: 'pencil', sold: 67, specs: [["جنس بدنه", "فلز و پلاستیک درجه یک"], ["نوع نوک", "۰٫۵ میلی‌متر — نرم‌نویس"], ["کشور سازنده", "ژاپن"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-0' },
 { id: 'm3', name: 'دفتر ۱۰۰ برگ کلاسیک جلد چرم', cat: 'نوشت‌افزار', price: 145000, oldPrice: 180000, rating: 4.7, stock: 65, icon: 'notebook', sold: 157, specs: [["جنس بدنه", "فلز و پلاستیک درجه یک"], ["نوع نوک", "۰٫۵ میلی‌متر — نرم‌نویس"], ["کشور سازنده", "ژاپن"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-4' },
 { id: 'm4', name: 'ست ۳۶ مدادرنگی حرفه‌ای هنری', cat: 'لوازم هنری', price: 520000, oldPrice: 690000, rating: 4.9, stock: 18, icon: 'brush', sold: 61, specs: [["تعداد رنگ", "۲۴ رنگ حرفه‌ای"], ["نوع محصول", "ویژه هنرجویان و طراحان"], ["بسته‌بندی", "جعبه مقوایی سخت"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-1', badge: '٪۲۵ تخفیف' },
 { id: 'm5', name: 'آبرنگ ۲۴ رنگ پن‌تاچ', cat: 'لوازم هنری', price: 385000, rating: 4.5, stock: 40, icon: 'palette', sold: 100, specs: [["تعداد رنگ", "۲۴ رنگ حرفه‌ای"], ["نوع محصول", "ویژه هنرجویان و طراحان"], ["بسته‌بندی", "جعبه مقوایی سخت"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-2' },
 { id: 'm6', name: 'بوم نقاشی ۵۰×۷۰ (بسته ۳ عددی)', cat: 'لوازم هنری', price: 310000, rating: 4.4, stock: 22, icon: 'frame', sold: 97, specs: [["تعداد رنگ", "۲۴ رنگ حرفه‌ای"], ["نوع محصول", "ویژه هنرجویان و طراحان"], ["بسته‌بندی", "جعبه مقوایی سخت"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-5' },
 { id: 'm7', name: 'کاغذ اسکیس مارکر A4 — ۵۰ برگ', cat: 'لوازم هنری', price: 165000, rating: 4.6, stock: 80, icon: 'filetext', sold: 106, specs: [["تعداد رنگ", "۲۴ رنگ حرفه‌ای"], ["نوع محصول", "ویژه هنرجویان و طراحان"], ["بسته‌بندی", "جعبه مقوایی سخت"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-3' },
 { id: 'm8', name: 'منگنه فلزی درجه یک ۵۰ عددی', cat: 'لوازم اداری', price: 45000, rating: 4.3, stock: 200, icon: 'paperclip', sold: 79, specs: [["جنس", "فلزی / درجه یک"], ["مناسب برای", "اداری، دانش‌آموزی و دانشگاه"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-0' },
 { id: 'm9', name: 'سوراخ‌کن دفتری فلزی', cat: 'لوازم اداری', price: 98000, rating: 4.5, stock: 56, icon: 'hole', sold: 127, specs: [["جنس", "فلزی / درجه یک"], ["مناسب برای", "اداری، دانش‌آموزی و دانشگاه"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-2' },
 { id: 'm10', name: 'کاغذ A4 تکثر ۵۰۰ برگ (۷۰ گرم)', cat: 'لوازم اداری', price: 185000, oldPrice: 220000, rating: 4.7, stock: 150, icon: 'copy', sold: 55, specs: [["جنس", "فلزی / درجه یک"], ["مناسب برای", "اداری، دانش‌آموزی و دانشگاه"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-5' },
 { id: 'm11', name: 'جامدادی چرمی مدل اسکالر', cat: 'دانش‌آموزی', price: 210000, rating: 4.6, stock: 44, icon: 'case', sold: 130, specs: [["جنس", "چرم مصنوعی ضدآب"], ["ابعاد", "۲۰ × ۱۰ × ۵ سانتی‌متر"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-4' },
 { id: 'm12', name: 'زیرلپتی شیشه‌ای مینیمال', cat: 'لوازم اداری', price: 135000, rating: 4.4, stock: 30, icon: 'layers', sold: 127, specs: [["جنس", "فلزی / درجه یک"], ["مناسب برای", "اداری، دانش‌آموزی و دانشگاه"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-0' },
 { id: 'm13', name: 'پک کامل مدرسه (۱۲ قلم) ویژه مهر', cat: 'پک ویژه', price: 690000, oldPrice: 950000, rating: 4.9, stock: 25, icon: 'backpack', sold: 127, specs: [["تعداد اقلام", "پک کامل چند قلمی"], ["مناسبت", "بازگشت به مدرسه"], ["بسته‌بندی", "جعبه هدیه"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-1', badge: 'ویژه' },
 { id: 'm14', name: 'پک هنرجو — طراحی و نقاشی (۹ قلم)', cat: 'پک ویژه', price: 840000, oldPrice: 1100000, rating: 4.8, stock: 12, icon: 'gift', sold: 133, specs: [["تعداد اقلام", "پک کامل چند قلمی"], ["مناسبت", "بازگشت به مدرسه"], ["بسته‌بندی", "جعبه هدیه"], ["ضمانت", "سلامت فیزیکی کالا"]], color: 'grad-3', badge: 'پیشنهاد ما' },
]

export const testimonials = [
 { name: 'امیرحسین طباطبایی', role: 'قبولی مهندسی کامپیوتر — شریف', quote: 'دوره ری‌اکت مدرس‌یار واقعاً عالی بود؛ پروژه‌محور و بدون حاشیه. الان توی شرکت کار می‌کنم و هر روز از اون چیزی استفاده می‌کنم.', rating: 5, color: 'grad-0' },
 { name: 'فاطمه کریمی', role: 'رتبه ۴۸۰ کنکور ریاضی', quote: 'کلاس‌های آنلاین آقای موسوی با جدول هفتگی مدرس‌یار نظم مطالعاتی‌ام رو کاملاً عوض کرد. آزمونک‌های هفتگی عالی بودن.', rating: 5, color: 'grad-3' },
 { name: 'سینا رجبی', role: 'دانشجوی دوره UI/UX', quote: 'بازخورد مستقیم مدرس روی تمرین‌ها بهترین بخش کار بود. پورتفولیوم با همین دوره ساخته شد و استخدام شدم.', rating: 4, color: 'grad-4' },
 { name: 'نگین شفیعی', role: 'نمره ۷.۵ آیلتس', quote: 'از صفر شروع کردم و بعد از شش ماه نمره ۷.۵ گرفتم. کلاب مکالمه هفتگی حرف اول رو می‌زنه.', rating: 5, color: 'grad-2' },
 { name: 'محمد عزیزی', role: 'بنیان‌گذار استارتاپ', quote: 'هم دوره‌های کسب‌وکارشون رو خریدم هم از مدرس‌مارکت لوازم تحریر تیمم رو تأمین می‌کنم؛ همه‌چیز یکجا، خیلی راحت.', rating: 5, color: 'grad-1' },
 { name: 'درسا نیک‌پی', role: 'دانش‌آموز پایه نهم', quote: 'دوره پایتون نوجوان خیلی باحال بود، بازی مار خودم رو نوشتم و به همه دوستام نشون دادم!', rating: 5, color: 'grad-5' },
]

export const faqItems = [
 { q: 'کلاس‌های آنلاین چگونه برگزار می‌شوند؟', a: 'کلاس‌ها از طریق سامانه کلاس زنده مدرس‌یار با امکان تصویر مدرس، اشتراک صفحه و وایت‌برد برگزار می‌شوند. لینک ورود به کلاس در جدول هفتگی شما فعال می‌شود.' },
 { q: 'به دوره‌های ضبط‌شده چند وقت دسترسی دارم؟', a: 'دسترسی به دوره‌های ضبط‌شده مادام‌العمر است و همه آپدیت‌های بعدی دوره نیز بدون هزینه اضافه در اختیار شما قرار می‌گیرد.' },
 { q: 'اگر از دوره راضی نباشم می‌توانم انصراف دهم؟', a: 'بله؛ تا ۷ روز پس از خرید و مشاهده کمتر از ۲۰٪ دوره، امکان بازگشت کامل وجه بدون هیچ سوالی وجود دارد.' },
 { q: 'گواهی‌نامه پایان دوره معتبر است؟', a: 'پس از اتمام بیش از ۹۰٪ درس‌ها و قبولی در آزمون پایانی، گواهی‌نامه با کد رهگیری یکتا صادر می‌شود که قابل استعلام است.' },
 { q: 'اکانت مدرس چگونه ساخته می‌شود؟', a: 'اکانت مدرسان فقط توسط تیم مدیریت ایجاد می‌شود. مدارک و نمونه‌کار خود را از طریق فرم تماس ارسال کنید تا با شما تماس بگیریم.' },
 { q: 'ارسال سفارش‌های مدرس‌مارکت چقدر طول می‌کشد؟', a: 'سفارش‌های لوازم‌التحریر تهران ظرف ۲۴ ساعت و شهرستان‌ها ظرف ۲ تا ۴ روز کاری ارسال می‌شوند.' },
]

// ---- admin data ----
export const students = [
 { id: 's1', name: 'سارا محمدی', phone: '۰۹۱۲۳۴۵۶۷۸۹', email: 'sara@example.com', joined: '1404/06/02', courses: 4, spent: 6450000, status: 'active' },
 { id: 's2', name: 'امیرحسین طباطبایی', phone: '۰۹۱۹۱۱۱۲۲۳۳', email: 'amir@example.com', joined: '1404/04/18', courses: 2, spent: 4370000, status: 'active' },
 { id: 's3', name: 'فاطمه کریمی', phone: '۰۹۳۵۷۷۷۸۸۹۹', email: 'fatemeh@example.com', joined: '1404/01/25', courses: 3, spent: 5180000, status: 'active' },
 { id: 's4', name: 'سینا رجبی', phone: '۰۹۰۲۳۳۳۴۴۵۵', email: 'sina@example.com', joined: '1403/11/08', courses: 1, spent: 1890000, status: 'inactive' },
 { id: 's5', name: 'نگین شفیعی', phone: '۰۹۱۲۹۹۹۰۰۱۱', email: 'negin@example.com', joined: '1404/07/14', courses: 2, spent: 4190000, status: 'active' },
 { id: 's6', name: 'محمد عزیزی', phone: '۰۹۳۶۵۵۵۶۶۷۷', email: 'mohammad@example.com', joined: '1403/08/30', courses: 5, spent: 8940000, status: 'vip' },
 { id: 's7', name: 'درسا نیک‌پی', phone: '۰۹۱۰۴۴۴۵۵۶۶', email: 'dorsa@example.com', joined: '1404/08/01', courses: 1, spent: 1290000, status: 'active' },
 { id: 's8', name: 'کیان توکلی', phone: '۰۹۲۱۲۲۲۳۳۴۴', email: 'kian@example.com', joined: '1404/05/21', courses: 2, spent: 3370000, status: 'banned' },
 { id: 's9', name: 'یلدا قاسمی', phone: '۰۹۳۹۸۸۸۷۷۶۶', email: 'yelda@example.com', joined: '1404/03/11', courses: 3, spent: 5040000, status: 'active' },
 { id: 's10', name: 'آرش بهرامی', phone: '۰۹۱۷۱۲۳۴۵۶۷', email: 'arash@example.com', joined: '1404/09/05', courses: 1, spent: 2100000, status: 'active' },
]

export const payments = [
 { id: 'p1', code: 'PAY-4821', user: 'سارا محمدی', amount: 2480000, method: 'درگاه زرین‌پال', date: '1404/09/12', status: 'paid', type: 'دوره' },
 { id: 'p2', code: 'PAY-4820', user: 'محمد عزیزی', amount: 840000, method: 'درگاه ملت', date: '1404/09/12', status: 'paid', type: 'مدرس‌مارکت' },
 { id: 'p3', code: 'PAY-4819', user: 'فاطمه کریمی', amount: 350000, method: 'کیف پول', date: '1404/09/11', status: 'paid', type: 'کلاس زنده' },
 { id: 'p4', code: 'PAY-4818', user: 'کیان توکلی', amount: 1980000, method: 'درگاه زرین‌پال', date: '1404/09/11', status: 'refunded', type: 'دوره' },
 { id: 'p5', code: 'PAY-4817', user: 'نگین شفیعی', amount: 3200000, method: 'درگاه سامان', date: '1404/09/10', status: 'paid', type: 'دوره' },
 { id: 'p6', code: 'PAY-4816', user: 'درسا نیک‌پی', amount: 189000, method: 'درگاه ملت', date: '1404/09/10', status: 'paid', type: 'مدرس‌مارکت' },
 { id: 'p7', code: 'PAY-4815', user: 'یلدا قاسمی', amount: 520000, method: 'درگاه زرین‌پال', date: '1404/09/09', status: 'paid', type: 'مدرس‌مارکت' },
 { id: 'p8', code: 'PAY-4814', user: 'آرش بهرامی', amount: 2100000, method: 'کارت به کارت', date: '1404/09/09', status: 'pending', type: 'دوره' },
 { id: 'p9', code: 'PAY-4813', user: 'سینا رجبی', amount: 180000, method: 'کیف پول', date: '1404/09/08', status: 'paid', type: 'کلاس زنده' },
 { id: 'p10', code: 'PAY-4812', user: 'امیرحسین طباطبایی', amount: 1890000, method: 'درگاه سامان', date: '1404/09/08', status: 'paid', type: 'دوره' },
]

export const coupons = [
 { id: 'c1', code: 'YALDA30', type: 'درصدی', value: '۳۰٪', used: 48, cap: 100, expires: '1404/10/01', status: 'active' },
 { id: 'c2', code: 'WELCOME', type: 'درصدی', value: '۱۵٪', used: 210, cap: 9999, expires: '—', status: 'active' },
 { id: 'c3', code: 'MARKET100', type: 'مبلغی', value: '۱۰۰ هزار', used: 66, cap: 200, expires: '1404/09/30', status: 'active' },
 { id: 'c4', code: 'REACT50', type: 'درصدی', value: '۵۰٪', used: 100, cap: 100, expires: '1404/08/15', status: 'expired' },
 { id: 'c5', code: 'TEACHER20', type: 'درصدی', value: '۲۰٪', used: 12, cap: 50, expires: '1404/11/20', status: 'inactive' },
]

export const marketOrders = [
 { id: 'MO-1042', user: 'سارا محمدی', items: 'پک کامل مدرسه ×۱', total: 690000, date: '1404/09/12', status: 'shipped', addr: 'تهران، سعادت‌آباد' },
 { id: 'MO-1041', user: 'محمد عزیزی', items: 'کاغذ A4 ×۳', total: 555000, date: '1404/09/12', status: 'processing', addr: 'اصفهان، خیابان چهارباغ' },
 { id: 'MO-1040', user: 'درسا نیک‌پی', items: 'خودنویس ×۲', total: 970000, date: '1404/09/11', status: 'delivered', addr: 'تهران، پونک' },
 { id: 'MO-1039', user: 'یلدا قاسمی', items: 'ست مدادرنگی ×۱', total: 520000, date: '1404/09/11', status: 'delivered', addr: 'مشهد، بلوار وکیل‌آباد' },
 { id: 'MO-1038', user: 'کیان توکلی', items: 'پک هنرجو ×۱', total: 840000, date: '1404/09/10', status: 'canceled', addr: 'شیراز، زند' },
 { id: 'MO-1037', user: 'آرش بهرامی', items: 'جامدادی ×۱، دفتر ×۲', total: 500000, date: '1404/09/10', status: 'shipped', addr: 'تبریز، ولیعصر' },
]

export const tickets = [
 { id: 'TK-220', user: 'سارا محمدی', subject: 'مشکل در پخش ویدیوی فصل سوم', priority: 'بالا', date: '1404/09/12', status: 'open', msg: 'سلام، ویدیوی درس سوم فصل سه بعد از دقیقه ۱۰ متوقف می‌شه. لطفاً بررسی کنید.' },
 { id: 'TK-219', user: 'امیرحسین طباطبایی', subject: 'درخواست فاکتور رسمی', priority: 'متوسط', date: '1404/09/11', status: 'answered', msg: 'برای شرکت فاکتور رسمی با مهر نیاز دارم، مراحلش چطوره؟' },
 { id: 'TK-218', user: 'فاطمه کریمی', subject: 'تغییر جلسه کلاس ریاضی', priority: 'کم', date: '1404/09/11', status: 'closed', msg: 'امکان جابجایی جلسه پنجشنبه به جمعه هست؟' },
 { id: 'TK-217', user: 'نگین شفیعی', subject: 'خطا در کد تخفیف YALDA30', priority: 'بالا', date: '1404/09/10', status: 'open', msg: 'کد تخفیف رو که می‌زنم خطای نامعتبر می‌ده.' },
 { id: 'TK-216', user: 'محمد عزیزی', subject: 'گواهی‌نامه دوره مارکتینگ', priority: 'متوسط', date: '1404/09/09', status: 'answered', msg: 'گواهی‌نامه‌ام هنوز صادر نشده با اینکه ۱۰۰٪ دوره رو دیدم.' },
 { id: 'TK-215', user: 'آرش بهرامی', subject: 'پیگیری مرسوله مدرس‌مارکت', priority: 'متوسط', date: '1404/09/08', status: 'closed', msg: 'کد رهگیری پست رو ارسال نمی‌کنید.' },
]

export const reviews = [
 { id: 'r1', user: 'سینا رجبی', target: 'دوره ری‌اکت و Next.js', rating: 5, text: 'بهترین دوره فارسی ری‌اکت که دیدم، بدون اغراق.', date: '1404/09/10', status: 'approved' },
 { id: 'r2', user: 'یلدا قاسمی', target: 'دوره UI/UX فیگما', rating: 5, text: 'فایل‌های تمرین خیلی کامل بودن، ممنون از خانم احمدی.', date: '1404/09/09', status: 'approved' },
 { id: 'r3', user: 'کیان توکلی', target: 'دوره آیلتس ۷+', rating: 3, text: 'خوب بود ولی انتظار داشتم ریدینگ بیشتری تدریس بشه.', date: '1404/09/08', status: 'pending' },
 { id: 'r4', user: 'درسا نیک‌پی', target: 'پایتون برای نوجوانان', rating: 5, text: 'بااحال‌ترین دوره‌ای که تا حالا گرفتم ', date: '1404/09/07', status: 'pending' },
 { id: 'r5', user: 'محمد عزیزی', target: 'دوره دیجیتال مارکتینگ', rating: 4, text: 'مطالعه موردی برندهای ایرانی خیلی ارزشمند بود.', date: '1404/09/06', status: 'approved' },
]

export const blogPosts = [
 { id: 'b1', title: '۷ تکنیک مطالعه فعال که واقعاً جواب می‌دهند', cat: 'روش مطالعه', date: '1404/09/10', dateISO: '2025-11-01', read: 6, icon: 'book', color: 'grad-0', excerpt: 'خواندن منفعل را کنار بگذارید؛ با این تکنیک‌های علمی یادگیری‌تان را چند برابر کنید.' },
 { id: 'b2', title: 'راهنمای انتخاب دوره برنامه‌نویسی برای شروع', cat: 'برنامه‌نویسی', date: '1404/09/04', dateISO: '2025-11-25', read: 8, icon: 'laptop', color: 'grad-2', excerpt: 'پایتون یا جاوااسکریپت؟ فرانت یا بک‌اند؟ پاسخ این سوال‌ها به هدف شما بستگی دارد.' },
 { id: 'b3', title: 'تقویم پومودورو: نظم مطالعاتی در ۲۵ دقیقه', cat: 'بهره‌وری', date: '1404/08/28', dateISO: '2025-11-19', read: 5, icon: 'timer', color: 'grad-3', excerpt: 'چطور با تکنیک پومودورو تمرکزتان را بازیابید و از جدول هفتگی حداکثر استفاده را ببرید.' },
 { id: 'b4', title: 'پورتفولیوی طراح UI چگونه باید باشد؟', cat: 'طراحی', date: '1404/08/20', dateISO: '2025-11-11', read: 7, icon: 'palette', color: 'grad-4', excerpt: 'نمونه‌کار کم اما عمیق، بهتر از حجم زیاد بی‌هدف است؛ معیارهای ارزیابی کارفرماها را بشناسید.' },
 { id: 'b5', title: 'چک‌لیست لوازم‌التحریر سال تحصیلی جدید', cat: 'مدرس‌مارکت', date: '1404/08/12', dateISO: '2025-11-03', read: 4, icon: 'backpack', color: 'grad-1', excerpt: 'از خودنویس تا کاغذ اسکیس؛ چیزی که واقعاً لازم دارید و چیزی که فقط پول دور انداختن است.' },
 { id: 'b6', title: 'ترس از دوربین در کلاس آنلاین: راه‌حل‌ها', cat: 'آموزش آنلاین', date: '1404/08/05', dateISO: '2025-10-27', read: 6, icon: 'video', color: 'grad-5', excerpt: 'برای مدرسان تازه‌کار؛ چطور جلوی دوربین طبیعی رفتار کنیم و کلاس جذاب برگزار کنیم.' },
]

export const banners = [
 { id: 'bn1', title: 'بنر اصلی صفحه نخست — «مدرس‌یار، همراه آموزش»', place: 'صفحه نخست — بالای صفحه', active: true },
 { id: 'bn2', title: 'کمپین یلدا — ۳۰٪ تخفیف دوره‌ها', place: 'صفحه نخست — وسط', active: true },
 { id: 'bn3', title: 'بنر مدرس‌مارکت — پک ویژه مهر', place: 'صفحه مدرس‌مارکت', active: false },
 { id: 'bn4', title: 'بنر معرفی کلاس‌های زنده', place: 'صفحه کلاس‌های آنلاین', active: true },
]

export const sysLogs = [
 { id: 1, action: 'ورود موفق', user: 'مدیر سامانه', ip: '۲.۱۸۸.۹۹.۱۰', date: '1404/09/12 — ۰۹:۱۴', level: 'info' },
 { id: 2, action: 'ساخت اکانت مدرس', user: 'مدیر سامانه', ip: '۲.۱۸۸.۹۹.۱۰', date: '1404/09/12 — ۰۹:۲۰', level: 'success' },
 { id: 3, action: 'تلاش ناموفق ورود (×۳)', user: 'ناشناس', ip: '۸۵.۲۴.۱۱.۷', date: '1404/09/12 — ۰۳:۴۱', level: 'warn' },
 { id: 4, action: 'بازگشت وجه سفارش PAY-4818', user: 'مدیر مالی', ip: '۲.۱۸۸.۹۹.۱۵', date: '1404/09/11 — ۱۶:۰۲', level: 'warn' },
 { id: 5, action: 'به‌روزرسانی دوره «ری‌اکت»', user: 'رضا کریمی', ip: '۳۱.۵۶.۲۲.۸', date: '1404/09/11 — ۱۱:۳۳', level: 'info' },
 { id: 6, action: 'خطای درگاه پرداخت', user: 'سیستم', ip: '—', date: '1404/09/10 — ۲۲:۱۹', level: 'error' },
]

// ---- student data ----
export const myCourses = [
 { courseId: 1, progress: 68, lastLesson: 'هوک‌های پرکاربرد', lastSeen: '1404/09/12' },
 { courseId: 4, progress: 42, lastLesson: 'تحلیل عبارت‌های جبری', lastSeen: '1404/09/11' },
 { courseId: 8, progress: 85, lastLesson: 'جلسات کاری', lastSeen: '1404/09/09' },
 { courseId: 6, progress: 100, lastLesson: 'بازی مار — پایان دوره', lastSeen: '1404/09/01' },
]

// ۳۰ روز گذشته — دقیقه مطالعه
export const studyLogs = Array.from({ length: 30 }, (_, i) => {
 const base = [35, 55, 80, 45, 110, 65, 30][i % 7]
 return { day: i, minutes: base + ((i * 37) % 45) }
})

export const studyByCourse = [
 { label: 'ری‌اکت و Next.js', value: 1480, color: '#38bdf8' },
 { label: 'ریاضی کنکور', value: 920, color: '#fbbf24' },
 { label: 'مکالمه انگلیسی', value: 640, color: '#a78bfa' },
 { label: 'پایتون', value: 410, color: '#2dd4bf' },
]

export const myOrders = [
 { code: 'ORD-7741', items: 'دوره ری‌اکت و Next.js', total: 2480000, date: '1404/08/02', status: 'paid' },
 { code: 'ORD-7788', items: 'کلاس زنده ریاضی ۳ — ۴ جلسه', total: 1400000, date: '1404/08/25', status: 'paid' },
 { code: 'ORD-7812', items: 'پک کامل مدرسه ×۱', total: 690000, date: '1404/09/12', status: 'shipped' },
 { code: 'ORD-7815', items: 'خودنویس ۲۰۲۶ ×۱', total: 485000, date: '1404/09/13', status: 'pending' },
]

export const assignments = [
 { id: 'a1', course: 'ری‌اکت و Next.js', title: 'ساخت کامپوننت جدول کاربران', due: '1404/09/16', status: 'todo' },
 { id: 'a2', course: 'ریاضی کنکور', title: 'تست‌های ترکیبی پادمان (۲۵ تست)', due: '1404/09/14', status: 'todo' },
 { id: 'a3', course: 'مکالمه انگلیسی', title: 'ضبط مکالمه موقعیت رستوران', due: '1404/09/10', status: 'submitted' },
 { id: 'a4', course: 'ری‌اکت و Next.js', title: 'پیاده‌سازی سبد خرید', due: '1404/09/05', status: 'graded', grade: 19 },
 { id: 'a5', course: 'پایتون نوجوانان', title: 'بازی حدس عدد', due: '1404/08/20', status: 'graded', grade: 20 },
]

export const certificates = [
 { id: 'cert1', course: 'پایتون برای نوجوانان', date: '1404/09/01', code: 'MRY-2026-0412', grade: '۲۰ از ۲۰' },
 { id: 'cert2', course: 'مکالمه انگلیسی روزمره', date: '1404/08/30', code: 'MRY-2026-0398', grade: '۱۸.۵ از ۲۰' },
 { id: 'cert3', course: 'فن بیان و ارائه حرفه‌ای', date: '1404/07/12', code: 'MRY-2026-0321', grade: '۱۹ از ۲۰' },
]

export const studentTickets = [
 { id: 'TK-220', subject: 'مشکل در پخش ویدیو', date: '1404/09/12', status: 'open', replies: 1 },
 { id: 'TK-211', subject: 'سوال درباره گواهی‌نامه', date: '1404/09/02', status: 'answered', replies: 2 },
 { id: 'TK-198', subject: 'درخواست تمدید دسترسی', date: '1404/08/18', status: 'closed', replies: 3 },
]

// ---- teacher data ----
export const teacherClasses = [
 { id: 'tc1', liveId: 'l2', title: 'کارگاه React — هوک‌های پیشرفته', day: 0, start: '18:00', dur: 120, students: 41, room: 'room-react', status: 'scheduled' },
 { id: 'tc2', liveId: 'l8', title: 'حل تمرین پایتون', day: 2, start: '14:00', dur: 60, students: 28, room: 'room-py', status: 'scheduled' },
 { id: 'tc3', liveId: 'l9', title: 'کارگاه Context و مدیریت State', day: 3, start: '18:00', dur: 90, students: 36, room: 'room-ctx', status: 'scheduled' },
 { id: 'tc4', liveId: 'l10', title: 'جلسه پرسش و پاسخ پروژه نهایی', day: 5, start: '18:00', dur: 90, students: 22, room: 'room-final', status: 'scheduled' },
]

export const submissions = [
 { id: 'sb1', student: 'سارا محمدی', assignment: 'ساخت کامپوننت جدول', date: '1404/09/12', status: 'pending', file: 'sara-table.zip' },
 { id: 'sb2', student: 'امیرحسین طباطبایی', assignment: 'سبد خرید', date: '1404/09/11', status: 'pending', file: 'amir-cart.zip' },
 { id: 'sb3', student: 'یلدا قاسمی', assignment: 'سبد خرید', date: '1404/09/10', status: 'graded', grade: 18.5, file: 'yelda-cart.zip' },
 { id: 'sb4', student: 'آرش بهرامی', assignment: 'کامپوننت جدول', date: '1404/09/09', status: 'graded', grade: 16, file: 'arash-table.zip' },
 { id: 'sb5', student: 'درسا نیک‌پی', assignment: 'بازی حدس عدد', date: '1404/09/08', status: 'graded', grade: 20, file: 'dorsa-game.py' },
]

export const teacherEarnings = [
 { label: 'فروردین', value: 42 }, { label: 'اردیبهشت', value: 51 }, { label: 'خرداد', value: 64 },
 { label: 'تیر', value: 48 }, { label: 'مرداد', value: 72 }, { label: 'شهریور', value: 88 },
 { label: 'مهر', value: 76 }, { label: 'آبان', value: 95 }, { label: 'آذر', value: 112 },
]

export const teacherReviews = [
 { id: 'tr1', student: 'سینا رجبی', course: 'ری‌اکت و Next.js', rating: 5, text: 'تدریس بی‌نظیر، سوال‌ها با حوصله جواب داده می‌شن.', date: '1404/09/10' },
 { id: 'tr2', student: 'یلدا قاسمی', course: 'ری‌اکت و Next.js', rating: 5, text: 'کارگاه‌های زنده واقعاً کاربردی‌ان.', date: '1404/09/08' },
 { id: 'tr3', student: 'کیان توکلی', course: 'پایتون نوجوانان', rating: 4, text: 'کاش تمرین‌های بیشتری بود، ولی کلاً عالی.', date: '1404/09/05' },
]

export const teacherStudents = [
 { id: 'ts1', name: 'سارا محمدی', courses: 'ری‌اکت و Next.js', progress: 68, lastSeen: '۱۲ آذر', status: 'active' },
 { id: 'ts2', name: 'امیرحسین طباطبایی', courses: 'ری‌اکت و Next.js', progress: 81, lastSeen: '۱۲ آذر', status: 'active' },
 { id: 'ts3', name: 'یلدا قاسمی', courses: 'ری‌اکت و Next.js، پایتون', progress: 45, lastSeen: '۱۰ آذر', status: 'active' },
 { id: 'ts4', name: 'درسا نیک‌پی', courses: 'پایتون نوجوانان', progress: 100, lastSeen: '۱ آذر', status: 'done' },
 { id: 'ts5', name: 'کیان توکلی', courses: 'پایتون نوجوانان', progress: 24, lastSeen: '۵ آذر', status: 'idle' },
 { id: 'ts6', name: 'آرش بهرامی', courses: 'ری‌اکت و Next.js', progress: 39, lastSeen: 'دیروز', status: 'active' },
]

// ---- charts ----
export const salesSeries = [
 { label: 'آذر', value: 82 }, { label: 'دی', value: 95 }, { label: 'بهمن', value: 118 },
 { label: 'اسفند', value: 140 }, { label: 'فروردین', value: 105 }, { label: 'اردیبهشت', value: 128 },
 { label: 'خرداد', value: 112 }, { label: 'تیر', value: 88 }, { label: 'مرداد', value: 135 },
 { label: 'شهریور', value: 172 }, { label: 'مهر', value: 158 }, { label: 'آبان', value: 190 },
]

export const weekSales = [
 { label: 'شنبه', value: 12 }, { label: 'یکشنبه', value: 18 }, { label: 'دوشنبه', value: 9 },
 { label: 'سه‌شنبه', value: 22 }, { label: 'چهارشنبه', value: 15 }, { label: 'پنجشنبه', value: 31 }, { label: 'جمعه', value: 26 },
]

export const catShare = [
 { label: 'برنامه‌نویسی', value: 38, color: '#38bdf8' },
 { label: 'کنکور و درسی', value: 27, color: '#fbbf24' },
 { label: 'زبان', value: 18, color: '#a78bfa' },
 { label: 'سایر', value: 17, color: '#2dd4bf' },
]

export const notifications = {
 admin: [
 { text: 'پرداخت جدید: «سارا محمدی» دوره ری‌اکت را خریداری کرد (۲٬۴۸۰٬۰۰۰ تومان)', time: '۵ دقیقه پیش' },
 { text: 'تیکت جدید با اولویت بالا از «نگین شفیعی»', time: '۲۰ دقیقه پیش' },
 { text: 'موجودی «ست مدادرنگی حرفه‌ای» رو به پایان است (۱۸ عدد)', time: '۱ ساعت پیش' },
 { text: 'درخواست ساخت اکانت مدرس از فرم تماس', time: 'دیروز' },
 ],
 student: [
 { text: 'کلاس «کارگاه React» فردا ساعت ۱۸:۰۰ برگزار می‌شود', time: '۱ ساعت پیش' },
 { text: 'تمرین جدید برای دوره ریاضی کنکور ثبت شد', time: '۳ ساعت پیش' },
 { text: 'گواهی‌نامه دوره پایتون آماده دانلود است ', time: 'دیروز' },
 { text: 'سفارش مدرس‌مارکت شما (ORD-7812) ارسال شد', time: '۲ روز پیش' },
 ],
 teacher: [
 { text: '۴۲ دانشجو در کارگاه React امروز ثبت‌نام کردند', time: '۲ ساعت پیش' },
 { text: '۲ تکلیف جدید برای تصحیح دارید', time: '۴ ساعت پیش' },
 { text: 'نظر جدید (۵ ستاره) از «سینا رجبی»', time: 'دیروز' },
 { text: 'تسویه حساب مهر تأیید شد (۹۵ میلیون تومان)', time: '۳ روز پیش' },
 ],
}
