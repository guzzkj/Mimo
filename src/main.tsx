import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SelecaoConta } from './components/SelecaoConta.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/selecao-conta" element={<SelecaoConta />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
