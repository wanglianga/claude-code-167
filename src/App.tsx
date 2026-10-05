import { NavLink, Route, Routes } from 'react-router-dom'
import { useEffect } from 'react'
import { useStore } from './store'
import HomePage from './pages/HomePage'
import BookPage from './pages/BookPage'
import VisitDetailPage from './pages/VisitDetailPage'
import OpsPage from './pages/OpsPage'

export default function App() {
  const seedDemo = useStore((s) => s.seedDemo)
  useEffect(() => { seedDemo() }, [seedDemo])

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="logo">
            <span className="logo-mark" aria-hidden>♿</span>
            <span>
              畅观博物馆 · 无障碍参观服务
              <small>预约 · 路线 · 轮椅 · 讲解 · 现场安全一体化</small>
            </span>
          </div>
          <nav className="nav">
            <NavLink to="/" end>首页 / 我的预约</NavLink>
            <NavLink to="/book">无障碍预约</NavLink>
            <NavLink to="/ops">馆内工作台（平板）</NavLink>
          </nav>
        </div>
      </header>
      <main className="wrap">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/book" element={<BookPage />} />
          <Route path="/visit/:id" element={<VisitDetailPage />} />
          <Route path="/ops" element={<OpsPage />} />
        </Routes>
      </main>
    </>
  )
}
