import { useState } from 'react';
import { useStore } from '../store';
import DeskPage from './DeskPage';
import TasksPage from './TasksPage';
import FacilityPage from './FacilityPage';
import RecordsPage from './RecordsPage';

export default function StaffApp() {
  const { account, staffLogin, staffLogout, staffTab, setStaffTab, error } = useStore();
  const [u, setU] = useState('desk');
  const [p, setP] = useState('');

  if (!account) {
    return (
      <div style={{ maxWidth: 420, margin: '30px auto' }}>
        <section className="card">
          <h2>工作人员登录</h2>
          <div className="field">
            <label htmlFor="s-user">账号</label>
            <input id="s-user" value={u} onChange={(e) => setU(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="s-pass">密码</label>
            <input id="s-pass" type="password" value={p} onChange={(e) => setP(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && staffLogin(u, p)} />
          </div>
          {error && <div className="error-box">{error}</div>}
          <button className="btn block" onClick={() => staffLogin(u, p)}>登录</button>
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: 12 }}>
            演示账号：服务台 desk/desk123 · 展厅 hall/hall123 · 调度 admin/admin123
          </p>
        </section>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="badge info">{account.roleName} · {account.name}</span>
        <div className="tabs" style={{ margin: 0, flex: 1 }}>
          <button className={staffTab === 'desk' ? 'active' : ''} onClick={() => setStaffTab('desk')}>服务台</button>
          <button className={staffTab === 'tasks' ? 'active' : ''} onClick={() => setStaffTab('tasks')}>展厅协助任务</button>
          <button className={staffTab === 'facility' ? 'active' : ''} onClick={() => setStaffTab('facility')}>设施与调度</button>
          <button className={staffTab === 'records' ? 'active' : ''} onClick={() => setStaffTab('records')}>服务记录</button>
        </div>
        <button className="btn ghost" onClick={staffLogout}>退出</button>
      </div>
      {staffTab === 'desk' && <DeskPage />}
      {staffTab === 'tasks' && <TasksPage />}
      {staffTab === 'facility' && <FacilityPage />}
      {staffTab === 'records' && <RecordsPage />}
    </div>
  );
}
