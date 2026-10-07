import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AlertasProvider, useAlertas } from '../alertas/AlertasOcorrencias';
import { useAuth } from '../auth/AuthContext';
import { FiltroFiliais } from './FiltroFiliais';

const NOMES_EMPRESAS: Record<string, string> = { '01': 'Asa Branca', '08': 'Rota Distribuidora' };

/** Menu "Cadastros" (fecha ao navegar ou clicar fora). */
function MenuCadastros({ ehAdministrador }: { ehAdministrador: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (menu.current?.open && !menu.current.contains(e.target as Node)) menu.current.open = false;
    };
    document.addEventListener('click', fora);
    return () => document.removeEventListener('click', fora);
  }, []);
  const ativo = ['/cadastro', '/usuarios'].some((p) => pathname.startsWith(p));
  return (
    <details ref={menu} className={`menu-suspenso${ativo ? ' ativo' : ''}`}>
      <summary>Cadastros</summary>
      <div className="menu-suspenso-itens">
        <NavLink to="/cadastro/motoristas">Motoristas</NavLink>
        <NavLink to="/cadastro/coordenadas">Coordenadas dos clientes</NavLink>
        {ehAdministrador && <NavLink to="/usuarios">Usuários</NavLink>}
      </div>
    </details>
  );
}

function BarraTopo() {
  const { gestor, empresa, definirEmpresa, sair, ehAdministrador } = useAuth();
  const { novas, notificacoesAtivas, ativarNotificacoes, alertas, alertasNovos } = useAlertas();
  const totalAlertas = alertas?.alertas.length ?? 0;
  const suportaNotificacao = typeof Notification !== 'undefined';
  return (
    <header className="barra-topo">
      <div className="marca">Acompanhamento de Entregas</div>
      <nav>
        <NavLink to="/mapa">Mapa</NavLink>
        <NavLink to="/entregadores">Entregadores</NavLink>
        <NavLink to="/alertas">
          Alertas
          {totalAlertas > 0 && (
            <span className={`contador-alerta${alertasNovos.size > 0 ? '' : ' discreto'}`}
              aria-label={`${totalAlertas} alertas${alertasNovos.size ? `, ${alertasNovos.size} novos` : ''}`}>{totalAlertas}</span>
          )}
        </NavLink>
        <NavLink to="/ocorrencias">
          Ocorrências
          {novas.size > 0 && <span className="contador-alerta" aria-label={`${novas.size} novas`}>{novas.size}</span>}
        </NavLink>
        <NavLink to="/indicadores">Indicadores</NavLink>
        <NavLink to="/fechamento">Fechamento</NavLink>
        <MenuCadastros ehAdministrador={ehAdministrador} />
      </nav>
      <div className="usuario">
        {suportaNotificacao && !notificacoesAtivas && (
          <button type="button" className="botao-link claro" onClick={ativarNotificacoes}
            title="Receber aviso do navegador quando surgir uma ocorrência, mesmo com o painel em segundo plano">
            Ativar notificações
          </button>
        )}
        <FiltroFiliais />
        {gestor && gestor.empresas.length > 1 ? (
          <select value={empresa} onChange={(e) => definirEmpresa(e.target.value)} aria-label="Empresa">
            {gestor.empresas.map((e) => <option key={e} value={e}>{e} - {NOMES_EMPRESAS[e] ?? `Empresa ${e}`}</option>)}
          </select>
        ) : (
          <span>{empresa} - {NOMES_EMPRESAS[empresa] ?? `Empresa ${empresa}`}</span>
        )}
        <span className="secundario">{gestor?.nome}</span>
        <button type="button" className="botao-link claro" onClick={() => void sair()}>Sair</button>
      </div>
    </header>
  );
}

export function Layout() {
  return (
    <AlertasProvider>
      <div className="aplicacao">
        <BarraTopo />
        <Outlet />
      </div>
    </AlertasProvider>
  );
}
