/**
 * Estrutura do painel: barra do topo + página. A barra mostra só o uso do dia a dia (Mapa, Entregadores, Alertas,
 * Ocorrências); análises e cadastros ficam no menu "Gestão"; empresa, notificações e saída no menu do usuário.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AlertasProvider, useAlertas } from '../alertas/AlertasOcorrencias';
import { useAuth } from '../auth/AuthContext';
import { FiltroFiliais } from './FiltroFiliais';

const NOMES_EMPRESAS: Record<string, string> = { '01': 'Asa Branca', '08': 'Rota Distribuidora' };
const nomeEmpresa = (e: string) => NOMES_EMPRESAS[e] ?? `Empresa ${e}`;

/** Logo: caminhão com marcador de entrega. */
function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#ffffff" />
      <path fill="#0d47a1" d="M5 11h12v10H5zM17 14h5l4 4.5V21h-9z" />
      <circle cx="9.5" cy="22.5" r="2.4" fill="#0d47a1" stroke="#fff" strokeWidth="1.2" />
      <circle cx="21.5" cy="22.5" r="2.4" fill="#0d47a1" stroke="#fff" strokeWidth="1.2" />
      <path fill="#ffca28" d="M24 3.5a3.6 3.6 0 0 0-3.6 3.6c0 2.7 3.6 6.2 3.6 6.2s3.6-3.5 3.6-6.2A3.6 3.6 0 0 0 24 3.5z" />
      <circle cx="24" cy="7.1" r="1.3" fill="#0d47a1" />
    </svg>
  );
}

/** Menu suspenso (details/summary): fecha ao navegar ou clicar fora. */
function MenuSuspenso({ rotulo, titulo, ativo = false, alinhar = 'esquerda', className = '', children }: {
  rotulo: ReactNode;
  titulo?: string;
  ativo?: boolean;
  alinhar?: 'esquerda' | 'direita';
  className?: string;
  children: ReactNode;
}) {
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
  return (
    <details ref={menu} className={`menu-suspenso${ativo ? ' ativo' : ''} ${className}`}>
      <summary title={titulo}>{rotulo}</summary>
      <div className={`menu-suspenso-itens ${alinhar}`}>{children}</div>
    </details>
  );
}

const iniciais = (nome: string | undefined) =>
  (nome ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

function BarraTopo() {
  const { gestor, empresa, definirEmpresa, sair, ehAdministrador } = useAuth();
  const { novas, notificacoesAtivas, ativarNotificacoes, alertas, alertasNovos } = useAlertas();
  const { pathname } = useLocation();
  const totalAlertas = alertas?.alertas.length ?? 0;
  const suportaNotificacao = typeof Notification !== 'undefined';
  const gestaoAtiva = ['/indicadores', '/fechamento', '/cadastro', '/usuarios'].some((p) => pathname.startsWith(p));

  return (
    <header className="barra-topo">
      <Link to="/mapa" className="marca" title="Acompanhamento de Entregas" aria-label="Acompanhamento de Entregas — início">
        <Logo />
      </Link>

      <nav aria-label="Principal">
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
        <MenuSuspenso rotulo="Gestão" ativo={gestaoAtiva}>
          <span className="menu-grupo">Análises</span>
          <NavLink to="/indicadores">Indicadores</NavLink>
          <NavLink to="/fechamento">Fechamento (reenvios e devoluções)</NavLink>
          <span className="menu-grupo">Cadastros</span>
          <NavLink to="/cadastro/motoristas">Motoristas</NavLink>
          <NavLink to="/cadastro/coordenadas">Coordenadas dos clientes</NavLink>
          {ehAdministrador && <NavLink to="/usuarios">Usuários</NavLink>}
        </MenuSuspenso>
      </nav>

      <div className="usuario">
        <FiltroFiliais />
        <MenuSuspenso alinhar="direita" className="menu-usuario" titulo={`${gestor?.nome ?? ''} — ${empresa} ${nomeEmpresa(empresa)}`}
          rotulo={(
            <>
              <span className="avatar" aria-hidden="true">{iniciais(gestor?.nome)}</span>
              <span className="usuario-empresa">{nomeEmpresa(empresa)}</span>
              {suportaNotificacao && !notificacoesAtivas && <span className="ponto-aviso" aria-label="Notificações desativadas" />}
            </>
          )}>
          <div className="menu-usuario-cabecalho">
            <strong>{gestor?.nome}</strong>
            <span className="secundario">{gestor?.login}{ehAdministrador ? ' · Administrador' : ''}</span>
          </div>
          {gestor && gestor.empresas.length > 1 ? (
            <label className="menu-campo">
              Empresa
              <select value={empresa} onChange={(e) => definirEmpresa(e.target.value)}>
                {gestor.empresas.map((e) => <option key={e} value={e}>{e} - {nomeEmpresa(e)}</option>)}
              </select>
            </label>
          ) : (
            <span className="menu-campo">Empresa {empresa} - {nomeEmpresa(empresa)}</span>
          )}
          {suportaNotificacao && (notificacoesAtivas ? (
            <span className="menu-campo secundario">Notificações do navegador ativas</span>
          ) : (
            <button type="button" className="menu-item" onClick={ativarNotificacoes}
              title="Receber aviso do navegador de alertas e ocorrências, mesmo com o painel em segundo plano">
              Ativar notificações
            </button>
          ))}
          <button type="button" className="menu-item sair" onClick={() => void sair()}>Sair</button>
        </MenuSuspenso>
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
