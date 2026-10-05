let counter = 0

export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.floor(Math.random() * 1e4).toString(36)}`
}

export function shortCode(): string {
  return 'MV-' + Math.random().toString(36).slice(2, 7).toUpperCase()
}

/** 当日分钟数 → HH:MM */
export function fmtMin(min: number): string {
  const m = Math.round(min)
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function fmtRange(a: number, b: number): string {
  return `${fmtMin(a)}–${fmtMin(b)}`
}

/** 距离/耗时友好显示 */
export function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} 公里` : `${Math.round(m)} 米`
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

export function weekdayCN(iso: string): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(iso + 'T00:00:00').getDay()]
}

/** 某日期 + HH:MM → 当日分钟数 */
export function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}
