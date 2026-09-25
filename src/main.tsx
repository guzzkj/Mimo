import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// Telas portadas de docs/ref, carregadas sob demanda.
const FluxoAcesso = lazy(() => import('./pages/FluxoAcesso.tsx'))
const DuoMetas = lazy(() => import('./pages/DuoMetas.tsx'))
const Configuracoes = lazy(() => import('./pages/Configuracoes.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<App />} />
          {/* a escolha de conta vive no onboarding (/acesso/plano) */}
          <Route path="/selecao-conta" element={<Navigate to="/acesso/plano" replace />} />

          {/* Acesso e onboarding: cadastro, login, recuperar, verificar, plano, config-*, duo-*, pronto-* */}
          <Route path="/acesso" element={<Navigate to="/acesso/cadastro" replace />} />
          <Route path="/acesso/:tela" element={<FluxoAcesso />} />

          {/* Duo e Metas: rota-layout sem path para o estado sobreviver à navegação interna */}
          <Route element={<DuoMetas />}>
            <Route path="/duo/*" />
            <Route path="/metas/*" />
          </Route>

          {/* Configurações, alertas e investimentos */}
          <Route element={<Configuracoes />}>
            <Route path="/ajustes/*" />
            <Route path="/investimentos" />
            <Route path="/notificacoes" />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
