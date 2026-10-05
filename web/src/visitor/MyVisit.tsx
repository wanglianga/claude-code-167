import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { RouteCard, StatusBadge, Timeline } from '../components/common';
import { incidentLabel } from '../types';

const SOS_SPOTS = [
  ['rest1', '一层休息区'], ['rest2', '二层休息区'], ['rest3', '三层休息角'],
  ['lobby', '中央大厅'], ['desk', '服务台'],
] as const;

export default function MyVisit() {
  const { myPhone, myCode, setMyPhone, setMyCode, myVisit, myRecords, loadMyVisits, loadMyVisit, sendSos, facilities } = useStore();
  const [sosOpen, setSosOpen] = useState(false);
  const [sosSpot, setSosSpot] = useState<string>('rest1');
  const [sosNote, setSosNote] = useState('');

  useEffect(() => {
    if (myPhone) loadMyVisits();
  }, []);

  useEffect(() => {
    if (!myVisit || myVisit.status !== 'checked_in') return;
    const t = setInterval(() => loadMyVisit(myVisit.id), 15000); // 参观中自动刷新路线/事件
    return () => clearInterval(t);
  }, [myVisit?.id, myVisit?.status]);

  const v = myVisit;

  return (
    <div>
      <section className="card">
        <h2>查询我的参观</h2>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="m-phone">预约手机号</label>
            <input id="m-phone" inputMode="numeric" maxLength={11} value={myPhone}
              onChange={(e) => setMyPhone(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="field">
            <label htmlFor="m-code">预约码</label>
            <input id="m-code" value={myCode} onChange={(e) => setMyCode(e.target.value.toUpperCase())} placeholder="如 VA1001" />
          </div>
        </div>
        <button className="btn block" onClick={loadMyVisits}>查询</button>
      </section>

      {v && (
        <>
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0 }}>{v.visitDate} {v.timeSlot}</h2>
              <StatusBadge status={v.status} />
            </div>
            <p style={{ fontSize: '0.88rem', margin: '6px 0' }}>
              预约码 <b>{v.code}</b> · {v.reservation.partySize} 人
              {v.reservation.wheelchairCount > 0 && ` · 轮椅 ${v.reservation.wheelchairCount} 辆`}
              {v.reservation.signLanguage && ' · 手语讲解'}
              {v.reservation.slowTour && ' · 慢速讲解'}
            </p>
            {v.status === 'booked' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
                入馆当天请到服务台出示预约码核验；轮椅与讲解员将在核验后安排。
              </p>
            )}
            {v.status === 'checked_in' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--ok)' }}>
                已入馆，沿途工作人员已收到接应任务，请按路线参观。
              </p>
            )}
          </section>

          {v.route && (
            <section className="card">
              <h2>我的路线{ v.routeVersions.length > 1 && <span className="badge info" style={{ marginLeft: 8 }}>已根据现场情况更新</span>}</h2>
              <RouteCard route={v.route} />
            </section>
          )}

          {v.status === 'checked_in' && (
            <section className="card">
              {!sosOpen ? (
                <button className="sos-btn" onClick={() => setSosOpen(true)}>
                  身体不适 / 需要协助
                </button>
              ) : (
                <div>
                  <h3>请求现场协助</h3>
                  <div className="field">
                    <label htmlFor="sos-spot">您当前附近的位置</label>
                    <select id="sos-spot" value={sosSpot} onChange={(e) => setSosSpot(e.target.value)}>
                      {SOS_SPOTS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="sos-note">情况说明</label>
                    <textarea id="sos-note" rows={2} value={sosNote} onChange={(e) => setSosNote(e.target.value)}
                      placeholder="如：头晕、轮椅电量不足等" />
                  </div>
                  <div className="btn-row">
                    <button className="btn danger" onClick={() => { sendSos(sosSpot, sosNote); setSosOpen(false); }}>
                      发送求助
                    </button>
                    <button className="btn ghost" onClick={() => setSosOpen(false)}>取消</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {v.incidents.length > 0 && (
            <section className="card">
              <h2>现场情况</h2>
              {v.incidents.map((i) => (
                <p key={i.id} style={{ fontSize: '0.86rem', margin: '6px 0' }}>
                  <span className={`badge ${i.status === 'open' ? 'warn' : 'ok'}`}>
                    {i.status === 'open' ? '处理中' : '已解决'}
                  </span>{' '}
                  {incidentLabel(i.type)}：{i.note}
                </p>
              ))}
            </section>
          )}

          <section className="card">
            <h2>服务记录</h2>
            <Timeline items={v.timeline} />
          </section>
        </>
      )}

      {myRecords.length > 0 && (
        <section className="card">
          <h2>历史接待记录</h2>
          {myRecords.map((r) => (
            <div key={r.id} style={{ fontSize: '0.86rem', padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
              <b>{r.visitDate}</b> {r.routeSummary ? `参观 ${r.routeSummary.halls.length} 个展厅` : ''}
              {r.incidents.length > 0 && ` · 曾发生 ${r.incidents.length} 项现场协助`}
              <div style={{ color: 'var(--ink-soft)' }}>{r.outcome} · 下次预约我们将延续您的偏好</div>
            </div>
          ))}
        </section>
      )}

      {facilities && (
        <p className="footer-note">
          当前轮椅库存 {facilities.wheelchairs.available} 辆 ·
          电梯 {facilities.elevators.map((e) => `${e.name}${e.status === 'ok' ? '正常' : '故障'}`).join('、')}
        </p>
      )}
    </div>
  );
}
