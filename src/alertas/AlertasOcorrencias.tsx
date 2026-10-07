/**
 * Alerta de novas ocorrências (não entregas e devoluções), em qualquer tela do painel.
 *
 * - Uma única consulta a /gestao/ocorrencias (a cada INTERVALO_MS), compartilhada com a tela de Ocorrências.
 * - Ocorrência nova = chave ainda não vista neste navegador (por usuário e empresa, em localStorage).
 *   Na primeira carga as existentes são marcadas como vistas (sem enxurrada de alertas).
 * - Nova ocorrência: aviso na tela (clicável), contador no menu e, se permitido, notificação do navegador.
 * - Abrir a tela de Ocorrências marca tudo como visto (as novas ficam destacadas até a próxima visita).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Ocorrencia, RespostaOcorrencias } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { useConsulta } from '../hooks/useConsulta';
import { TIPO_OCORRENCIA, rotuloMotivo } from '../util/rotulos';

const INTERVALO_MS = 60000;
const MAX_VISTAS = 5000;
const DURACAO_AVISO_MS = 15000;

/** Chave estável de uma ocorrência (nota ou item de uma carga). */
export function chaveOcorrencia(o: Ocorrencia): string {
  return [o.tipo, o.filial, o.carga_codigo, o.seqcar, o.nf_doc, o.nf_serie, o.item ?? ''].join('|');
}

/** Texto curto do alerta. */
export function resumoOcorrencia(o: Ocorrencia): string {
  const cliente = o.cliente_nome ?? `${o.cliente_codigo}/${o.cliente_loja}`;
  return `${TIPO_OCORRENCIA[o.tipo]}: ${cliente} — ${rotuloMotivo(o.motivo)}${o.motorista_nome ? ` (${o.motorista_nome})` : ''}`;
}

interface Contexto {
  dados: RespostaOcorrencias | null;
  erro: string | null;
  carregando: boolean;
  /** Chaves que chegaram desde a última visita à tela de Ocorrências. */
  novas: Set<string>;
  marcarVistas: () => void;
  notificacoesAtivas: boolean;
  ativarNotificacoes: () => void;
}

const AlertasContext = createContext<Contexto | null>(null);

function lerVistas(chave: string): Set<string> | null {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? new Set(JSON.parse(bruto) as string[]) : null;
  } catch {
    return null;
  }
}

function gravarVistas(chave: string, vistas: Set<string>): void {
  try {
    localStorage.setItem(chave, JSON.stringify([...vistas].slice(-MAX_VISTAS)));
  } catch {
    // sem armazenamento: as vistas valem até recarregar
  }
}

interface Aviso {
  id: number;
  texto: string;
}

export function AlertasProvider({ children }: { children: ReactNode }) {
  const { gestor, empresa, escopo } = useAuth();
  const navegar = useNavigate();
  const { dados, erro, carregando } = useConsulta<RespostaOcorrencias>(
    empresa ? `/gestao/ocorrencias?${escopo}` : null,
    INTERVALO_MS,
  );
  // Por usuário e escopo (empresa + filtro de filiais): ampliar o filtro não dispara alerta das antigas.
  const chaveArmazenamento = `gestao.ocorrencias_vistas|${gestor?.login}|${escopo}`;
  const vistas = useRef<Set<string> | null>(null);
  const [novas, setNovas] = useState<Set<string>>(new Set());
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted',
  );

  // Troca de usuário/empresa: recarrega as vistas daquele contexto.
  useEffect(() => {
    vistas.current = lerVistas(chaveArmazenamento);
    setNovas(new Set());
  }, [chaveArmazenamento]);

  useEffect(() => {
    if (!dados) return;
    const lista = dados.ocorrencias;
    const chaves = lista.map(chaveOcorrencia);
    if (!vistas.current) {
      // Primeira vez neste navegador: o que já existe não é alerta.
      vistas.current = new Set(chaves);
      gravarVistas(chaveArmazenamento, vistas.current);
      return;
    }
    const chegaram = lista.filter((o) => !vistas.current!.has(chaveOcorrencia(o)));
    if (chegaram.length === 0) return;
    for (const o of chegaram) vistas.current.add(chaveOcorrencia(o));
    gravarVistas(chaveArmazenamento, vistas.current);
    setNovas((atual) => new Set([...atual, ...chegaram.map(chaveOcorrencia)]));

    const texto = chegaram.length === 1
      ? resumoOcorrencia(chegaram[0])
      : `${chegaram.length} novas ocorrências — ${resumoOcorrencia(chegaram[0])} e outras`;
    const id = Date.now();
    setAvisos((a) => [...a.slice(-2), { id, texto }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), DURACAO_AVISO_MS);
    if (notificacoesAtivas && document.visibilityState !== 'visible') {
      try {
        const n = new Notification('Nova ocorrência nas entregas', { body: texto, tag: 'ocorrencias', icon: '/caminhao.svg' });
        n.onclick = () => {
          window.focus();
          navegar('/ocorrencias');
          n.close();
        };
      } catch {
        // navegador sem suporte a notificações nesta página
      }
    }
  }, [dados, chaveArmazenamento, notificacoesAtivas, navegar]);

  const marcarVistas = useCallback(() => setNovas(new Set()), []);

  const ativarNotificacoes = useCallback(() => {
    if (typeof Notification === 'undefined') return;
    void Notification.requestPermission().then((p) => setNotificacoesAtivas(p === 'granted'));
  }, []);

  const valor = useMemo<Contexto>(() => ({
    dados, erro, carregando, novas, marcarVistas, notificacoesAtivas, ativarNotificacoes,
  }), [dados, erro, carregando, novas, marcarVistas, notificacoesAtivas, ativarNotificacoes]);

  return (
    <AlertasContext.Provider value={valor}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className="aviso-ocorrencia">
            <button type="button" className="aviso-texto" onClick={() => { navegar('/ocorrencias'); setAvisos([]); }}>
              <strong>Nova ocorrência</strong>
              <span>{a.texto}</span>
            </button>
            <button type="button" className="fechar" aria-label="Fechar aviso"
              onClick={() => setAvisos((x) => x.filter((y) => y.id !== a.id))}>×</button>
          </div>
        ))}
      </div>
    </AlertasContext.Provider>
  );
}

export function useAlertas(): Contexto {
  const c = useContext(AlertasContext);
  if (!c) throw new Error('useAlertas fora do AlertasProvider');
  return c;
}
