import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import ClassifyUpload from './pages/ClassifyUpload'
import RowDetails from './pages/RowDetails'
import Trends from './pages/Trends'
import Timeline from './pages/Timeline'
import Settings from './pages/Settings'
import Onboarding from './pages/Onboarding'
import { SettingsProvider } from './context/SettingsContext'

function Layout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f9f7f4' }}>
      <Navbar />
      <main style={{ paddingTop: 48 }}>{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          {/* Onboarding — no navbar, full-screen */}
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Main app — always accessible */}
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/classify" element={<ClassifyUpload />} />
                  <Route path="/rows" element={<RowDetails />} />
                  <Route path="/trends" element={<Trends />} />
                  <Route path="/timeline" element={<Timeline />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  )
}
