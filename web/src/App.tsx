import { useEffect } from 'react';
import { useStore } from './store';
import BookPage from './visitor/BookPage';
import MyVisit from './visitor/MyVisit';
import StaffApp from './staff/StaffApp';

export default function App() {
  const { mode, setMode, visitorView, setVisitorView, error, notice, loadMeta, loadFacilities } = useStore();

  useEffect(() => {
    loadMeta();
    loadFacilities();
  }, []);

  return (
    <div>
      <header className="app-header">
        <div>
          <h1>云博 · 无障碍参观服务</h1>
          <div className="sub">预约 — 路线 — 入馆 — 协助 — 服务记录 一体化</div>
        </div>
        <nav className="mode-switch" aria-label="端口切换">
          <button className={mode === 'visitor' ? 'active' : ''} onClick={() => setMode('visitor')}>
            观众端(手机)
          </button>
          <button className={mode === 'staff' ? 'active' : ''} onClick={() => setMode('staff')}>
            工作端(平板)
          </button>
        </nav>
      </header>

      {error && <div className="shell" style={{ paddingBottom: 0 }}><div className="error-box" role="alert">{error}</div></div>}
      {notice && <div className="shell" style={{ paddingBottom: 0 }}><div className="notice-box" role="status">{notice}</div></div>}

      {mode === 'visitor' ? (
        <main className="shell">
          <div className="tabs" role="tablist">
            <button className={visitorView === 'book' ? 'active' : ''} onClick={() => setVisitorView('book')}>
              预约参观
            </button>
            <button className={visitorView === 'mine' ? 'active' : ''} onClick={() => setVisitorView('mine')}>
              我的参观
            </button>
          </div>
          {visitorView === 'book' ? <BookPage /> : <MyVisit />}
        </main>
      ) : (
        <main className="shell wide">
          <StaffApp />
        </main>
      )}
    </div>
  );
}
