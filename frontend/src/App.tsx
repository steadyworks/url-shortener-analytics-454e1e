import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Analytics from './pages/Analytics'
import Expired from './pages/Expired'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/analytics/:slug" element={<Analytics />} />
        <Route path="/expired" element={<Expired />} />
      </Routes>
    </BrowserRouter>
  )
}
