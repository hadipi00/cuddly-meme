import { faNum } from '../utils/format'

/** نمودار خطی + ناحیه پر — SVG خالص */
export function LineChart({ data = [], height = 240, color = '#2dd4bf', color2 = '#38bdf8', unit = '' }) {
 const W = 640, H = height, padX = 34, padY = 30
 const max = Math.max(...data.map((d) => d.value), 1) * 1.15
 const stepX = (W - padX * 2) / Math.max(data.length - 1, 1)
 const pts = data.map((d, i) => [padX + i * stepX, H - padY - (d.value / max) * (H - padY * 2)])
 const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
 const area = `${line} L${pts[pts.length - 1]?.[0] ?? padX},${H - padY} L${padX},${H - padY} Z`
 const gid = `g${Math.abs(data.length * 31 + Math.round(max)).toString(36)}`

 return (
 <div className="chart-wrap">
 <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="chart-line" role="img">
 <defs>
 <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
 <stop offset="0" stopColor={color} stopOpacity="0.35" />
 <stop offset="1" stopColor={color2} stopOpacity="0.02" />
 </linearGradient>
 </defs>
 {[0, 0.25, 0.5, 0.75, 1].map((t) => (
 <line key={t} x1={padX} x2={W - padX} y1={padY + t * (H - padY * 2)} y2={padY + t * (H - padY * 2)}
 stroke="rgba(148,163,184,0.12)" strokeDasharray={t === 1 ? '0' : '4 5'} />
 ))}
 <path d={area} fill={`url(#${gid})`} />
 <path d={line} stroke={color} className="line" />
 {pts.map((p, i) => (
 <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 5 : 3}
 fill={i === pts.length - 1 ? color : '#0a1322'} stroke={color} strokeWidth="2" />
 ))}
 {data.map((d, i) => (
 (data.length <= 12 || i % 2 === 0) && (
 <text key={i} x={padX + i * stepX} y={H - 8} textAnchor="middle" fontSize="10.5"
 fill="#64748b" style={{ fontFamily: 'Vazirmatn' }}>{d.label}</text>
 )
 ))}
 {data.length > 0 && (
 <text x={pts[pts.length - 1][0]} y={pts[pts.length - 1][1] - 12} textAnchor="middle" fontSize="11"
 fill={color} fontWeight="700" style={{ fontFamily: 'Vazirmatn' }}>
 {faNum(data[data.length - 1].value)}{unit}
 </text>
 )}
 </svg>
 </div>
 )
}

/** نمودار میله‌ای */
export function BarChart({ data = [], height = 240, color = '#a78bfa' }) {
 const W = 640, H = height, padX = 30, padY = 26
 const max = Math.max(...data.map((d) => d.value), 1) * 1.15
 const bw = (W - padX * 2) / data.length
 return (
 <div className="chart-wrap">
 <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
 {[0, 0.5, 1].map((t) => (
 <line key={t} x1={padX} x2={W - padX} y1={padY + t * (H - padY * 2)} y2={padY + t * (H - padY * 2)}
 stroke="rgba(148,163,184,0.12)" strokeDasharray="4 5" />
 ))}
 {data.map((d, i) => {
 const h = (d.value / max) * (H - padY * 2)
 const x = padX + i * bw + bw * 0.2
 return (
 <g key={i}>
 <rect x={x} y={H - padY - h} width={bw * 0.6} height={h} rx="6" fill={color} opacity={0.35 + 0.65 * (d.value / max)} />
 <text x={x + bw * 0.3} y={H - padY - h - 7} textAnchor="middle" fontSize="10.5" fill="#93a5bb"
 fontWeight="700" style={{ fontFamily: 'Vazirmatn' }}>{faNum(d.value)}</text>
 <text x={x + bw * 0.3} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#64748b"
 style={{ fontFamily: 'Vazirmatn' }}>{d.label}</text>
 </g>
 )
 })}
 </svg>
 </div>
 )
}

/** نمودار دونات + راهنما */
export function Donut({ data = [], size = 180, thickness = 22 }) {
 const total = data.reduce((a, d) => a + d.value, 0) || 1
 const r = (size - thickness) / 2
 const C = 2 * Math.PI * r
 let offset = 0
 return (
 <div className="row wrap g24" style={{ justifyContent: 'center' }}>
 <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ direction: 'ltr', transform: 'rotate(-90deg)' }}>
 <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth={thickness} />
 {data.map((d, i) => {
 const len = (d.value / total) * C
 const el = (
 <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
 strokeDasharray={`${len - 3} ${C - len + 3}`} strokeDashoffset={-offset} strokeLinecap="round" />
 )
 offset += len
 return el
 })}
 </svg>
 <div className="chart-legend" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
 {data.map((d) => (
 <span key={d.label}>
 <i style={{ background: d.color }} />
 {d.label} — <b>{faNum(Math.round((d.value / total) * 100))}٪</b>
 </span>
 ))}
 </div>
 </div>
 )
}

/** اسپارک‌لاین کوچک برای کارت آمار */
export function Spark({ points = [], color = '#2dd4bf', width = 90, height = 30 }) {
 if (!points.length) return null
 const max = Math.max(...points), min = Math.min(...points)
 const span = max - min || 1
 const d = points.map((v, i) =>
 `${i === 0 ? 'M' : 'L'}${(i / (points.length - 1)) * width},${height - ((v - min) / span) * (height - 4) - 2}`
 ).join(' ')
 return (
 <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ direction: 'ltr' }}>
 <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.85" />
 </svg>
 )
}
