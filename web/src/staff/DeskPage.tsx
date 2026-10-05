import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { RouteCard, StatusBadge, Timeline } from '../components/common';
import { INCIDENT_TYPES, incidentLabel, type Visit } from '../types';

export default function DeskPage() {
  const { deskDate, setDeskDate, deskVisits, loadDesk, facilities, visitAction } = useStore();
  const [sel, setSel] = useState<Visit | null>(null);

  useEffect(() => { loadDesk(); }, [deskDate]);
  useEffect(() => {
    if (sel) setSel(deskVisits.find((v) => v.id === sel.id) || null);
  }, [deskVisits]);

  const act = async (id: string, action: string, body?: unknown) => {
    const v = await visitAction(id, action, body);
    if (v) setSel(v);
  };

  return (
    <div className="grid cols-2">
      <div>
        <section className="card">
          <h2>当日预约</h2>
          <div className="field">
            <label htmlFor="d-date">日期</label>
            <input id="d-date" type="date" value={deskDate} onChange={(e) => setDeskDate(e.target.value)} />
          </div>
          {deskVisits.length === 0 && <p style={{ color: 'var(--ink-soft)', fontSize: '0.88rem' }}>当日暂无预约</p>}
          {deskVisits.map((v) => (
            <div key={v.id} className="visit-item" onClick={() => setSel(v)} role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSel(v)}
              style={sel?.id === v.id ? { borderColor: 'var(--brand)' } : undefined}>
              <div className="top">
                <span className="name">{v.reservation.visitorName}</span>
                <StatusBadge status={v.status} />
              </div>
              <div className="meta">
                {v.timeSlot} · {v.reservation.partySize}人 · 码 {v.code}
                {v.reservation.wheelchairCount > 0 && ` · 轮椅${v.reservation.wheelchairCount}`}
                {v.reservation.signLanguage && ' · 手语'}
                {v.incidents.filter((i) => i.status === 'open').length > 0 &&
                  ` · ⚠${v.incidents.filter((i) => i.status === 'open').length}项待处理`}
              </div>
            </div>
          ))}
          <button className="btn soft block" onClick={loadDesk}>刷新</button>
        </section>
      </div>

      <div>
        {!sel ? (
          <section className="card"><p style={{ color: 'var(--ink-soft)' }}>选择左侧预约进行核验与服务安排</p></section>
        ) : (
          <VisitDetail v={sel} act={act} facilities={facilities} />
        )}
      </div>
    </div>
  );
}

function VisitDetail({ v, act, facilities }: {
  v: Visit;
  act: (id: string, action: string, body?: unknown) => void;
  facilities: ReturnType<typeof useStore.getState>['facilities'];
}) {
  const [party, setParty] = useState(v.reservation.partySize);
  const [wc, setWc] = useState(v.reservation.wheelchairCount);
  const [incType, setIncType] = useState('visitor_unwell');
  const [incNote, setIncNote] = useState('');
  const [resolution, setResolution] = useState('');

  useEffect(() => { setParty(v.reservation.partySize); setWc(v.reservation.wheelchairCount); }, [v.id]);

  const guideName = facilities?.guides.find((g) => g.id === v.staff.guideId)?.name;
  const loanedOut = v.loans.filter((l) => l.type === 'wheelchair').reduce((s, l) => s + l.count - l.returned, 0);

  return (
    <>
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{v.reservation.visitorName} <span style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>码 {v.code}</span></h2>
          <StatusBadge status={v.status} />
        </div>
        <p style={{ fontSize: '0.85rem' }}>
          {v.visitDate} {v.timeSlot} · {v.reservation.partySize}人
          {v.reservation.wheelchairCount > 0 && ` · 需轮椅${v.reservation.wheelchairCount}辆`}
          {v.reservation.signLanguage && ' · 手语'}{v.reservation.slowTour && ' · 慢速'}
          {v.reservation.withElderly && ' · 有老人'}{v.reservation.withChildren && ' · 有儿童'}
          {v.reservation.closeParking && ' · 无障碍车位'}
          {!v.reservation.canStandLong && ' · 不宜久站'}
        </p>
        {v.reservation.note && <p style={{ fontSize: '0.83rem', color: 'var(--ink-soft)' }}>备注：{v.reservation.note}</p>}

        <div className="btn-row">
          {v.status === 'booked' && (
            <button className="btn ok" onClick={() => act(v.id, 'checkin')}>核验入馆</button>
          )}
          {v.status === 'checked_in' && (
            <>
              <button className="btn" onClick={() => act(v.id, 'wheelchair', { action: 'loan', count: Math.max(1, v.reservation.wheelchairCount - loanedOut) })}
                disabled={v.reservation.wheelchairCount - loanedOut <= 0}>
                借出轮椅(欠{Math.max(0, v.reservation.wheelchairCount - loanedOut)}辆)
              </button>
              {loanedOut > 0 && (
                <button className="btn soft" onClick={() => act(v.id, 'wheelchair', { action: 'return', count: loanedOut })}>
                  归还轮椅({loanedOut}辆)
                </button>
              )}
              <button className="btn soft" onClick={() => act(v.id, 'reroute', { reason: '人工重新规划' })}>重新规划路线</button>
              <button className="btn danger" onClick={() => { if (confirm('确认结束参观并归档服务记录？')) act(v.id, 'complete', { outcome: '正常完成' }); }}>
                结束参观
              </button>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <h3>人员安排</h3>
        <p style={{ fontSize: '0.88rem' }}>
          讲解员：<b>{guideName || '未安排'}</b>
          {v.staff.volunteerIds.length > 0 &&
            ` · 志愿者：${v.staff.volunteerIds.map((id) => facilities?.volunteers.find((x) => x.id === id)?.name).join('、')}`}
        </p>
        <div className="btn-row">
          {facilities?.guides.map((g) => (
            <button key={g.id} className={`btn soft`} disabled={g.status !== 'available' || v.staff.guideId === g.id}
              onClick={() => act(v.id, 'assign', { guideId: g.id })}>
              {g.name}{g.skills.includes('sign') ? '(手语)' : ''}{g.status !== 'available' ? '(请假)' : ''}
            </button>
          ))}
          {facilities?.volunteers.map((vol) => (
            <button key={vol.id} className="btn ghost"
              onClick={() => act(v.id, 'assign', { volunteerIds: v.staff.volunteerIds.includes(vol.id) ? [] : [vol.id] })}>
              {v.staff.volunteerIds.includes(vol.id) ? '✓ ' : ''}{vol.name}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>陪同人变更</h3>
        <div className="grid cols-2">
          <div className="field">
            <label>总人数</label>
            <input type="number" min={1} max={20} value={party} onChange={(e) => setParty(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>轮椅数</label>
            <input type="number" min={0} max={party} value={wc} onChange={(e) => setWc(Number(e.target.value))} />
          </div>
        </div>
        <button className="btn soft" onClick={() => act(v.id, 'companion', { partySize: party, wheelchairCount: wc })}>
          确认变更(自动重算路线)
        </button>
      </section>

      <section className="card">
        <h3>突发事件</h3>
        <div className="grid cols-2">
          <div className="field">
            <label>类型</label>
            <select value={incType} onChange={(e) => setIncType(e.target.value)}>
              {INCIDENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>说明</label>
            <input value={incNote} onChange={(e) => setIncNote(e.target.value)} placeholder="情况说明" />
          </div>
        </div>
        <button className="btn soft" onClick={() => { act(v.id, 'incidents', { type: incType, note: incNote }); setIncNote(''); }}>
          登记事件
        </button>
        {v.incidents.map((i) => (
          <div key={i.id} style={{ marginTop: 10, padding: '8px 10px', background: '#faf6ef', borderRadius: 8, fontSize: '0.85rem' }}>
            <span className={`badge ${i.status === 'open' ? 'warn' : 'ok'}`}>{i.status === 'open' ? '待处理' : '已解决'}</span>{' '}
            <b>{incidentLabel(i.type)}</b>：{i.note}
            {i.status === 'open' ? (
              <div className="btn-row" style={{ marginTop: 6 }}>
                <input style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8 }}
                  placeholder="处理结果" value={resolution} onChange={(e) => setResolution(e.target.value)} />
                <button className="btn ok" onClick={() => act(v.id, `incidents/${i.id}/resolve`, { resolution: resolution || '已处理' })}>
                  办结
                </button>
              </div>
            ) : (
              <div style={{ color: 'var(--ink-soft)' }}>处理：{i.resolution}</div>
            )}
          </div>
        ))}
      </section>

      {v.route && (
        <section className="card">
          <h3>当前路线（第 {v.routeVersions.length} 版）</h3>
          <RouteCard route={v.route} compact={false} />
        </section>
      )}

      <section className="card">
        <h3>服务时间线</h3>
        <Timeline items={v.timeline} />
      </section>
    </>
  );
}
