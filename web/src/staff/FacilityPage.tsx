import { useEffect } from 'react';
import { useStore } from '../store';

export default function FacilityPage() {
  const { facilities, loadFacilities, updateFacilities, notice } = useStore();

  useEffect(() => { loadFacilities(); }, []);
  if (!facilities) return <section className="card">加载中…</section>;

  return (
    <div className="grid cols-2">
      <section className="card">
        <h2>电梯与展厅</h2>
        {facilities.elevators.map((e) => (
          <div key={e.id} className="facility-row">
            <span>{e.name}</span>
            <button
              className={`btn ${e.status === 'ok' ? 'soft' : 'danger'}`}
              onClick={() => updateFacilities({ elevator: { id: e.id, status: e.status === 'ok' ? 'fault' : 'ok' } })}
            >
              {e.status === 'ok' ? '运行中(点击模拟故障)' : '故障中(点击恢复)'}
            </button>
          </div>
        ))}
        <h3>展厅状态与拥挤度</h3>
        {facilities.halls.map((h) => (
          <div key={h.id} className="facility-row" style={{ flexWrap: 'wrap' }}>
            <span style={{ minWidth: 90 }}>
              {h.name || h.id}
              <span className={`badge ${h.status === 'open' ? (h.crowd > 75 ? 'warn' : 'ok') : 'danger'}`} style={{ marginLeft: 6 }}>
                {h.status === 'closed' ? '闭馆' : h.crowd > 75 ? `拥挤${h.crowd}%` : `${h.crowd}%`}
              </span>
            </span>
            <input type="range" min={0} max={100} value={h.crowd} aria-label={`${h.name}拥挤度`}
              onChange={(e) => updateFacilities({ hall: { id: h.id, crowd: Number(e.target.value) } })} />
            <button className="btn soft" onClick={() => updateFacilities({ hall: { id: h.id, status: h.status === 'open' ? 'closed' : 'open' } })}>
              {h.status === 'open' ? '临时闭馆' : '恢复开放'}
            </button>
          </div>
        ))}
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
          调整会实时触发在馆观众的路线重算与事件登记
        </p>
      </section>

      <section className="card">
        <h2>设备与人员</h2>
        <h3>轮椅库存（{facilities.wheelchairs.available}/{facilities.wheelchairs.total} 可用）</h3>
        <div className="btn-row">
          <button className="btn soft" onClick={() => updateFacilities({ wheelchairs: { ...facilities.wheelchairs, available: Math.max(0, facilities.wheelchairs.available - 1) } })}>
            库存 -1
          </button>
          <button className="btn soft" onClick={() => updateFacilities({ wheelchairs: { ...facilities.wheelchairs, available: Math.min(facilities.wheelchairs.total, facilities.wheelchairs.available + 1) } })}>
            库存 +1
          </button>
          <button className="btn soft" onClick={() => updateFacilities({ wheelchairs: { total: facilities.wheelchairs.total, available: 0 } })}>
            模拟库存耗尽
          </button>
        </div>
        <h3>讲解员排班</h3>
        {facilities.guides.map((g) => (
          <div key={g.id} className="facility-row">
            <span>
              {g.name}
              <span style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                （{g.skills.includes('sign') ? '手语 ' : ''}{g.skills.includes('slow') ? '慢速' : ''}）
              </span>
            </span>
            <button className={`btn ${g.status === 'available' ? 'soft' : 'danger'}`}
              onClick={() => updateFacilities({ guide: { id: g.id, status: g.status === 'available' ? 'leave' : 'available' } })}>
              {g.status === 'available' ? '在岗(点击请假)' : '请假中(点击返岗)'}
            </button>
          </div>
        ))}
        <h3>志愿者</h3>
        {facilities.volunteers.map((v) => (
          <div key={v.id} className="facility-row">
            <span>{v.name}</span>
            <span className="badge ok">可调配</span>
          </div>
        ))}
        {notice && <div className="notice-box" style={{ marginTop: 10 }}>{notice}</div>}
      </section>
    </div>
  );
}
