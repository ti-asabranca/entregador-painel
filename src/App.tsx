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
        {/* A API também recusa (403) quem não é administrador. */}
        {ehAdministrador && <Route path="/usuarios" element={<UsuariosPagina />} />}
        <Route path="*" element={<Navigate to="/mapa" replace />} />
      </Route>
    </Routes>
  );
}
