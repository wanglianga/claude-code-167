import type { Route, TimelineItem } from '../types';
import { fmtDateTime } from '../types';

export function RouteCard({ route, compact }: { route: Route; compact?: boolean }) {
  return (
    <div>
      <div className="stat-row" role="list">
        <div className="stat" role="listitem"><div className="v">{route.totalDistance}m</div><div className="k">总距离</div></div>
        <div className="stat" role="listitem"><div className="v">约{route.totalMinutes}分钟</div><div className="k">预计耗时</div></div>
        <div className="stat" role="listitem"><div className="v">{route.hallCount}个</div><div className="k">覆盖展厅</div></div>
        <div className="stat" role="listitem"><div className="v">{route.restStops}处</div><div className="k">休息点</div></div>
      </div>

      {route.warnings.length > 0 && (
        <ul className="warn-list" aria-label="路线提示">
          {route.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
        </ul>
      )}

      {!compact && (
        <div aria-label="分段路线">
          {route.legs.map((leg) => (
            <div className="leg" key={leg.seq}>
              <div className="no" aria-hidden>{leg.seq}</div>
              <div className="body">
                <div className="title">{leg.fromName} → {leg.toName}</div>
                <div className="meta">
                  <span>距离 {leg.distance} 米</span>
                  <span>坡度 {leg.maxSlope}%</span>
                  <span>约 {leg.minutes} 分钟</span>
                  {leg.note && <span>{leg.note}</span>}
                </div>
                <div className="fac">
                  {leg.uses.elevator.length > 0 && <span>🛗 乘电梯</span>}
                  {leg.uses.ramp && <span>♿ 坡道</span>}
                  {leg.rests.map((r) => <span key={r} className="rest">🪑 {r}</span>)}
                  {leg.toilets.map((t) => <span key={t} className="wc">🚻 {t}</span>)}
                  {leg.suggestedRest && (
                    <span className="rest">💡 建议到「{leg.suggestedRest.name}」休息(绕行约{leg.suggestedRest.detour}米)</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>暂无记录</p>;
  return (
    <ul className="timeline">
      {[...items].reverse().map((t, i) => (
        <li key={i}>
          <span className="t">{fmtDateTime(t.at)}</span>
          <span className="a">{t.actor}</span>
          <span>{t.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    booked: ['已预约', 'info'],
    checked_in: ['参观中', 'ok'],
    completed: ['已完结', ''],
  };
  const [label, cls] = map[status] || [status, ''];
  return <span className={`badge ${cls}`}>{label}</span>;
}
