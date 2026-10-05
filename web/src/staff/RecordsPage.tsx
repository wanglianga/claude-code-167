import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Timeline } from '../components/common';
import { incidentLabel } from '../types';

export default function RecordsPage() {
  const { records, loadRecords } = useStore();
  const [phone, setPhone] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { loadRecords(); }, []);

  return (
    <div>
      <section className="card">
        <h2>服务记录（预约前 / 入馆中 / 参观后全程留痕）</h2>
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <input style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 8 }}
            placeholder="按手机号筛选（留空查全部）" value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
          <button className="btn" onClick={() => loadRecords(phone || undefined)}>查询</button>
        </div>
        {records.length === 0 && <p style={{ color: 'var(--ink-soft)' }}>暂无归档记录；参观结束后自动归档</p>}
        {records.map((r) => (
          <div key={r.id} className="visit-item" onClick={() => setOpen(open === r.id ? null : r.id)} role="button" tabIndex={0}>
            <div className="top">
              <span className="name">{r.visitorName} · {r.visitDate} {r.timeSlot}</span>
              <span className="badge">{r.outcome}</span>
            </div>
            <div className="meta">
              {r.phone} · {r.reservation.partySize}人
              {r.routeSummary && ` · 参观${r.routeSummary.halls.length}展厅/${r.routeSummary.totalDistance}米`}
              {r.loans.length > 0 && ` · 借轮椅${r.loans.reduce((s, l) => s + l.count, 0)}辆`}
              {r.incidents.length > 0 && ` · ${r.incidents.length}项现场事件`}
            </div>
            {open === r.id && (
              <div style={{ marginTop: 10 }}>
                {r.incidents.length > 0 && (
                  <p style={{ fontSize: '0.84rem' }}>
                    现场事件：{r.incidents.map((i) => `${incidentLabel(i.type)}(${i.status === 'resolved' ? '已解决' : '未结案'})`).join('、')}
                  </p>
                )}
                <Timeline items={r.timeline} />
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
