import { useEffect } from 'react';
import { useStore } from '../store';
import { fmtTime } from '../types';

const KIND_LABEL: Record<string, string> = {
  reception: '接待', equipment: '设备', assist: '接应', rest: '休息', hall: '展厅', urgent: '紧急',
};

export default function TasksPage() {
  const { tasks, loadTasks, taskDone, deskDate } = useStore();

  useEffect(() => {
    loadTasks();
    const t = setInterval(loadTasks, 10000); // 平板端轮询，保持任务同步
    return () => clearInterval(t);
  }, [deskDate]);

  const pending = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <div>
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>展厅协助任务</h2>
          <button className="btn soft" onClick={loadTasks}>刷新</button>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', margin: '6px 0 12px' }}>
          按预计到达时间排序，每 10 秒自动同步；紧急任务置顶标红
        </p>
        {pending.length === 0 && <p style={{ color: 'var(--ink-soft)' }}>当前没有待办协助任务</p>}
        {[...pending].sort((a, b) => (a.kind === 'urgent' ? -1 : 0) - (b.kind === 'urgent' ? -1 : 0) || a.eta.localeCompare(b.eta)).map((t) => (
          <div key={t.id} className={`task-item ${t.kind === 'urgent' ? 'urgent' : ''}`}>
            <div className="eta">
              <div className="hh">{fmtTime(t.eta)}</div>
              <div className="nn">{t.nodeName}</div>
            </div>
            <div className="info">
              <div className="t">
                <span className={`badge ${t.kind === 'urgent' ? 'danger' : 'info'}`}>{KIND_LABEL[t.kind] || t.kind}</span>{' '}
                {t.title}
              </div>
              <div className="d">{t.visitor} · 预约码 {t.code} · {t.detail}</div>
            </div>
            <button className="btn ok" onClick={() => taskDone(t.id)}>完成</button>
          </div>
        ))}
      </section>

      {done.length > 0 && (
        <section className="card">
          <h3>已完成</h3>
          {done.map((t) => (
            <div key={t.id} className="task-item done">
              <div className="eta"><div className="hh">{fmtTime(t.eta)}</div><div className="nn">{t.nodeName}</div></div>
              <div className="info">
                <div className="t">{t.title}</div>
                <div className="d">{t.doneBy || ''} 于 {fmtTime(t.doneAt)} 完成</div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
