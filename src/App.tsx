import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './componentes/Layout';
import { EntregadoresPagina } from './paginas/EntregadoresPagina';
import { LoginPagina } from './paginas/LoginPagina';
import { MapaPagina } from './paginas/MapaPagina';
import { MotoristaPagina } from './paginas/MotoristaPagina';
import { OcorrenciasPagina } from './paginas/OcorrenciasPagina';
import { TrocarSenhaPagina } from './paginas/TrocarSenhaPagina';
import { UsuariosPagina } from './paginas/UsuariosPagina';
import { CadastroMotoristasPagina } from './paginas/CadastroMotoristasPagina';
import { AlertasPagina } from './paginas/AlertasPagina';

// Telas de análise carregadas sob demanda (não pesam a abertura do painel).
const IndicadoresPagina = lazy(() => import('./paginas/IndicadoresPagina').then((m) => ({ default: m.IndicadoresPagina })));
const FechamentoPagina = lazy(() => import('./paginas/FechamentoPagina').then((m) => ({ default: m.FechamentoPagina })));
const CoordenadasPagina = lazy(() => import('./paginas/CoordenadasPagina').then((m) => ({ default: m.CoordenadasPagina })));

const carregando = <main className="pagina"><div className="aviso">Carregando…</div></main>;

export function App() {
  const { token, trocaSenha, ehAdministrador } = useAuth();
  if (!token) return <LoginPagina />;
  if (trocaSenha) return <TrocarSenhaPagina />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/mapa" element={<MapaPagina />} />
        <Route path="/entregadores" element={<EntregadoresPagina />} />
        <Route path="/motoristas/:codigo" element={<MotoristaPagina />} />
        <Route path="/ocorrencias" element={<OcorrenciasPagina />} />
        <Route path="/alertas" element={<AlertasPagina />} />
        <Route path="/indicadores" element={<Suspense fallback={carregando}><IndicadoresPagina /></Suspense>} />
        <Route path="/fechamento" element={<Suspense fallback={carregando}><FechamentoPagina /></Suspense>} />
        <Route path="/cadastro/motoristas" element={<CadastroMotoristasPagina />} />
        <Route path="/cadastro/coordenadas" element={<Suspense fallback={carregando}><CoordenadasPagina /></Suspense>} />
        {/* A API também recusa (403) quem não é administrador. */}
        {ehAdministrador && <Route path="/usuarios" element={<UsuariosPagina />} />}
        <Route path="*" element={<Navigate to="/mapa" replace />} />
      </Route>
    </Routes>
  );
}
