import { useState } from 'react'
import { EDGES, ELEVATORS, NODES } from '../data/museum'
import type { Floor } from '../types'

const KIND_COLOR: Record<string, string> = {
  entrance: '#6b6357',
  desk: '#b07a1c',
  hall: '#0f6b5c',
  elevator: '#6a4c93',
  rest: '#2e7d43',
  toilet: '#2b5d8a',
  parking: '#555e6b',
  stairs: '#8a3324',
  ramp: '#b07a1c'
}
const KIND_EMOJI: Record<string, string> = {
  entrance: '🚪', desk: 'ℹ️', hall: '🏛', elevator: '🛗', rest: '🪑', toilet: '🚻', parking: '🅿️', stairs: '🪜', ramp: '♿'
}

const FLOOR_LABEL: Record<Floor, string> = { [-1]: 'B1 特展层', 1: 'F1 大厅层', 2: 'F2 古代馆', 3: 'F3 近代·自然馆' }
const FLOOR_ORDER: Floor[] = [-1, 1, 2, 3]

const W = 720
const BAND_H = 158
const PAD_X = 30

function xy(floor: Floor, x: number, y: number) {
  const fi = FLOOR_ORDER.indexOf(floor)
  return { cx: PAD_X + x * 60, cy: fi * BAND_H + 24 + y * 12 }
}

export default function MuseumMap(props: {
  trace?: string[]
  elevatorsDown?: string[]
  closedHalls?: string[]
  crowd?: Record<string, number>
}) {
  const { trace = [], elevatorsDown = [], closedHalls = [], crowd = {} } = props
  const [floor, setFloor] = useState<Floor | 'all'>('all')
  const traceSet = new Set(trace)
  const H = FLOOR_ORDER.length * BAND_H + 10

  const dim = (f: Floor) => floor !== 'all' && floor !== f

  return (
    <div className="card map-card">
      <div className="flex between">
        <h3 style={{ margin: 0 }}>馆区无障碍平面图</h3>
        <div className="flex" style={{ gap: 4 }}>
          <button className={`btn sm ${floor === 'all' ? '' : 'ghost'}`} onClick={() => setFloor('all')}>全部楼层</button>
          {FLOOR_ORDER.map((f) => (
            <button key={f} className={`btn sm ${floor === f ? '' : 'ghost'}`} onClick={() => setFloor(f)}>{f < 0 ? 'B1' : `F${f}`}</button>
          ))}
        </div>
      </div>

      <svg className="map-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="馆区无障碍路线平面图">
        {FLOOR_ORDER.map((f, fi) => (
          <g key={f} opacity={dim(f) ? 0.18 : 1}>
            <rect x="8" y={fi * BAND_H + 6} width={W - 16} height={BAND_H - 12} rx="12"
              fill={fi % 2 ? '#faf6ee' : '#f4efe5'} stroke="#e4dccf" />
            <text x="20" y={fi * BAND_H + 24} fontSize="12" fontWeight="700" fill="#6b6357">{FLOOR_LABEL[f]}</text>
          </g>
        ))}

        {/* 通道边 */}
        {EDGES.filter((e) => e.kind !== 'elevator').map((e) => {
          const a = NODES.find((n) => n.id === e.a)!
          const b = NODES.find((n) => n.id === e.b)!
          if (a.floor !== b.floor) return null
          const pa = xy(a.floor, a.x, a.y)
          const pb = xy(b.floor, b.x, b.y)
          const onTrace = traceSet.has(e.id)
          return (
            <g key={e.id} opacity={dim(a.floor) ? 0.15 : 1}>
              <line x1={pa.cx} y1={pa.cy} x2={pb.cx} y2={pb.cy}
                stroke={onTrace ? '#0f6b5c' : '#d3c9b6'}
                strokeWidth={onTrace ? 5 : 2}
                strokeDasharray={e.kind === 'ramp' ? '7 4' : undefined}
                strokeLinecap="round" />
            </g>
          )
        })}

        {/* 电梯：同位置双门标记 + 楼层连线 */}
        {ELEVATORS.map((ev) => {
          const evNodes = NODES.filter((n) => n.kind === 'elevator' && (n.id.startsWith(ev.id === 'el1' ? 'el1' : 'el2')))
          // el1b 以 "el1" 开头、el1_2 也以 el1 开头；el2 同理
          const pts = evNodes.map((n) => xy(n.floor, n.x, n.y))
          const down = elevatorsDown.includes(ev.id)
          return (
            <g key={ev.id} opacity={floor === 'all' || evNodes.some((n) => !dim(n.floor)) ? 1 : 0.15}>
              {pts.length > 1 && (
                <polyline
                  points={pts.map((p) => `${p.cx},${p.cy}`).join(' ')}
                  fill="none"
                  stroke={down ? '#b4372a' : trace.some((tid) => tid.startsWith(ev.id === 'el1' ? 'ev1' : 'ev2')) ? '#0f6b5c' : '#cdb8e4'}
                  strokeWidth={trace.some((tid) => tid.startsWith(ev.id === 'el1' ? 'ev1' : 'ev2')) ? 4 : 2}
                  strokeDasharray="4 4"
                />
              )}
            </g>
          )
        })}

        {/* 节点 */}
        {NODES.map((n) => {
          const p = xy(n.floor, n.x, n.y)
          const closed = n.kind === 'hall' && closedHalls.includes(n.id)
          const downNode = n.kind === 'elevator' && elevatorsDown.includes(n.id.startsWith('el1') ? 'el1' : 'el2')
          const c = crowd[n.id]
          const crowdColor = c !== undefined ? (c >= 0.8 ? '#b4372a' : c >= 0.6 ? '#b07a1c' : '#2e7d43') : undefined
          return (
            <g key={n.id} opacity={dim(n.floor) ? 0.15 : 1}>
              <circle cx={p.cx} cy={p.cy} r="13"
                fill={closed ? '#b4372a' : downNode ? '#b4372a' : KIND_COLOR[n.kind]}
                stroke="#fffdf8" strokeWidth="2.5" />
              <text x={p.cx} y={p.cy + 4.5} fontSize="11" textAnchor="middle">{KIND_EMOJI[n.kind]}</text>
              {crowdColor && (
                <circle cx={p.cx + 10} cy={p.cy - 10} r="5.5" fill={crowdColor} stroke="#fff" strokeWidth="1.5" />
              )}
              <text x={p.cx} y={p.cy + 27} fontSize="10.5" textAnchor="middle" fill="#2a2620"
                style={{ fontWeight: n.kind === 'hall' ? 700 : 400 }}>
                {n.name.replace(/^(B1|F\d)\s*/, '').split(' · ')[0]}
              </text>
              {closed && <text x={p.cx} y={p.cy - 17} fontSize="9.5" textAnchor="middle" fill="#b4372a" fontWeight="700">临时闭馆</text>}
              {downNode && <text x={p.cx} y={p.cy - 17} fontSize="9.5" textAnchor="middle" fill="#b4372a" fontWeight="700">故障</text>}
            </g>
          )
        })}
      </svg>

      <div className="map-legend">
        <span><i style={{ background: '#0f6b5c' }} />推荐路线</span>
        <span><i style={{ background: '#d3c9b6' }} />无障碍通道</span>
        <span><i style={{ background: '#b07a1c' }} />坡道（虚线）</span>
        <span><i style={{ background: '#6a4c93' }} />电梯</span>
        <span><i style={{ background: '#b4372a' }} />闭馆/故障</span>
        <span>拥挤点：<i style={{ background: '#2e7d43' }} />宽松 <i style={{ background: '#b07a1c' }} />较挤 <i style={{ background: '#b4372a' }} />过挤</span>
      </div>
    </div>
  )
}
