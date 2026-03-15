import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import ClassifyUpload from './pages/ClassifyUpload'
import RowDetails from './pages/RowDetails'
import Trends from './pages/Trends'
import AyushTesting from './pages/AyushTesting'

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="pt-16">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/classify" element={<ClassifyUpload />} />
          <Route path="/rows" element={<RowDetails />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/ayush" element={<AyushTesting />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
