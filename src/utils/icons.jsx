/* =====================================================================
 نگاشت آیکون‌های داده‌ها (دوره/محصول/کلاس/بلاگ) به پکیج Lucide
 ایموجی‌ها به‌طور کامل حذف شدند — همه‌جا آیکون وکتوری اختصاصی.
 ===================================================================== */
import {
 Atom, Palette, GraduationCap, Sigma, TrendingUp, Terminal, BarChart3,
 MessagesSquare, FlaskConical, Mic, Pen, Pencil, Notebook, Brush, Droplets,
 Frame, FileText, Paperclip, CircleDot, Copy, Briefcase, Layers, Backpack, Gift,
 BookOpen, Laptop, Timer, Video, Rocket, Shapes, Globe, Music, Camera,
 HeartPulse, Scale, Languages, Calculator, Wrench, Sparkles,
} from 'lucide-react'

export const DATA_ICONS = {
 atom: Atom,
 palette: Palette,
 gradcap: GraduationCap,
 sigma: Sigma,
 chart: TrendingUp,
 terminal: Terminal,
 spreadsheet: BarChart3,
 chat: MessagesSquare,
 flask: FlaskConical,
 mic: Mic,
 pen: Pen,
 pencil: Pencil,
 notebook: Notebook,
 brush: Brush,
 droplets: Droplets,
 frame: Frame,
 filetext: FileText,
 paperclip: Paperclip,
 hole: CircleDot,
 copy: Copy,
 case: Briefcase,
 layers: Layers,
 backpack: Backpack,
 gift: Gift,
 book: BookOpen,
 laptop: Laptop,
 timer: Timer,
 video: Video,
 rocket: Rocket,
 globe: Globe,
 music: Music,
 camera: Camera,
 health: HeartPulse,
 scale: Scale,
 languages: Languages,
 calculator: Calculator,
 wrench: Wrench,
 sparkles: Sparkles,
}

/** آیکون وکتوری بر اساس نام داده — با fallback امن */
export function DataIcon({ name, size = 22, className, strokeWidth = 1.8, style }) {
 const Cmp = DATA_ICONS[name] || Shapes
 return <Cmp size={size} strokeWidth={strokeWidth} className={className} style={style} aria-hidden="true" />
}
