import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ConviteInstalar } from './components/ConviteInstalar.tsx'
import { MascotDefs } from './components/MascotDefs.tsx'
import { registrarServiceWorker } from './lib/instalacao.ts'
import { GuardaSessao } from './components/GuardaSessao.tsx'
import { iniciarBackend } from './lib/remoto/iniciar.ts'

registrarServiceWorker()
iniciarBackend()

// Telas portadas de docs/ref, carregadas sob demanda.
const FluxoAcesso = lazy(() => import('./pages/FluxoAcesso.tsx'))
const DuoMetas = lazy(() => import('./pages/DuoMetas.tsx'))
const Configuracoes = lazy(() => import('./pages/Configuracoes.tsx'))
// Páginas legais públicas (LGPD: transparência).
const Privacidade = lazy(() => import('./pages/Privacidade.tsx'))
const Termos = lazy(() => import('./pages/Termos.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Símbolos do mascote uma vez só, para qualquer rota (painel, Duo, convite de instalação) */}
    <MascotDefs />
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<GuardaSessao><App /></GuardaSessao>} />
          {/* a escolha de conta vive no onboarding (/acesso/plano) */}
          <Route path="/selecao-conta" element={<Navigate to="/acesso/plano" replace />} />

          {/* Acesso e onboarding: cadastro, login, recuperar, verificar, plano, config-*, duo-*, pronto-* */}
          <Route path="/acesso" element={<Navigate to="/acesso/cadastro" replace />} />
          <Route path="/acesso/:tela" element={<FluxoAcesso />} />

          {/* Documentos legais (públicos, sem sessão) */}
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/termos" element={<Termos />} />

          {/* Duo e Metas: rota-layout sem path para o estado sobreviver à navegação interna */}
          <Route element={<GuardaSessao><DuoMetas /></GuardaSessao>}>
            <Route path="/duo/*" />
            <Route path="/metas/*" />
          </Route>

          {/* Configurações, alertas e investimentos */}
          <Route element={<GuardaSessao><Configuracoes /></GuardaSessao>}>
            <Route path="/ajustes/*" />
            <Route path="/investimentos" />
            <Route path="/notificacoes" />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ConviteInstalar />
    </BrowserRouter>
  </StrictMode>,
)
