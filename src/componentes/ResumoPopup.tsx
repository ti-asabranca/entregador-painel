/**
 * Popup com o resumo de um cliente ou do caminhão (lista de entregas). Busca os dados só ao abrir (não pesa na
 * atualização do painel). Fecha com Esc, no "×" ou clicando fora.
 * - Cliente: nome, endereço, notas e peso; pendente: previsão de chegada pela melhor rota; atendido: chegada, início
 *   e término da entrega, saída e tempo no cliente.
 * - Caminhão: saída do último cliente e previsão até o próximo.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ErroApi, requisitar } from '../api/cliente';
import type { SituacaoCliente } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { formatarDecorrido, formatarDistancia, formatarDuracao, formatarHora, formatarPeso } from '../util/formatacao';
import { SITUACAO_CLIENTE, rotuloMotivo } from '../util/rotulos';

interface Previsao {
  ordem: number;
  distancia_m: number | null;
  duracao_s: number | null;
  chegada_prevista_em: string | null;
  partida: string;
  sem_coordenadas: boolean;
}

interface ResumoCliente {
  codigo: string;
  loja: string;
  nome: string | null;
  razao_social: string | null;
  endereco: string | null;
  situacao: SituacaoCliente;
  motivo: string | null;
  descricao: string | null;
  notas: number;
  notas_entregues: number;
  peso_total: number | null;
  peso_pendente: number | null;
  peso_incompleto: boolean;
  chegou_em: string | null;
  iniciou_em: string | null;
  terminou_em: string | null;
  saiu_em: string | null;
  no_cliente_agora: boolean;
  tempo_no_cliente_s: number | null;
  previsao: Previsao | null;
  previsao_aviso: string | null;
}

interface ResumoCaminhao {
  posicao_em: string | null;
  velocidade_kmh: number | null;
  no_cliente: { codigo: string; loja: string; nome: string | null; desde: string | null } | null;
  ultimo_cliente: { codigo: string; loja: string; nome: string | null; saiu_em: string | null } | null;
  ultima_conclusao_em: string | null;
  proximo: (Previsao & { nome: string | null; cliente_codigo: string }) | null;
  aviso: string | null;
}

export type AlvoResumo =
  | { tipo: 'cliente'; motorista: string; cliente: string; loja: string; x: number; y: number }
  | { tipo: 'caminhao'; motorista: string; motoristaNome: string; x: number; y: number };

/** "em ~25 min (12,3 km), por volta de 14:35" a partir da previsão da melhor rota. */
function textoPrevisao(p: Previsao): string {
  if (p.sem_coordenadas) return 'cliente sem coordenadas — sem previsão';
  const restante = p.chegada_prevista_em ? (new Date(p.chegada_prevista_em).getTime() - Date.now()) / 1000 : p.duracao_s;
  const tempo = restante === null ? '—' : restante <= 60 ? 'a qualquer momento' : `em ~${formatarDuracao(restante)}`;
  return `${tempo} (${formatarDistancia(p.distancia_m)})${p.chegada_prevista_em && (restante ?? 0) > 60
    ? `, por volta de ${formatarHora(p.chegada_prevista_em)}` : ''}`;
}

const notaPartida = (p: Previsao) => (p.partida === 'DEPOSITO' ? ' Calculada a partir do depósito (sem posição recente do caminhão).' : '');

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="resumo-linha"><span>{rotulo}</span><strong>{valor}</strong></div>
  );
}

function ConteudoCliente({ r }: { r: ResumoCliente }) {
  const s = SITUACAO_CLIENTE[r.situacao];
  const atendido = r.situacao !== 'PENDENTE';
  return (
    <>
      <h3>{r.nome ?? `${r.codigo}/${r.loja}`}</h3>
      <div className="secundario">{r.codigo}/{r.loja}{r.razao_social && r.razao_social !== r.nome ? ` · ${r.razao_social}` : ''}</div>
      {r.endereco && <div className="resumo-endereco">{r.endereco}</div>}
      <div className="resumo-tags">
        <span className="selo" style={{ backgroundColor: s.cor }}>{s.rotulo}</span>
        {r.no_cliente_agora && <span className="selo" style={{ backgroundColor: '#1565c0' }}>Caminhão no cliente</span>}
      </div>
      {r.motivo && <div className="resumo-motivo">{rotuloMotivo(r.motivo)}{r.descricao ? ` — ${r.descricao}` : ''}</div>}
      <Linha rotulo="Notas" valor={`${r.notas_entregues} de ${r.notas} entregue(s)`} />
      <Linha rotulo="Peso" valor={`${formatarPeso(r.peso_total)}${r.peso_incompleto ? '*' : ''}${
        !atendido && r.peso_pendente !== null && r.peso_pendente !== r.peso_total ? ` (falta ${formatarPeso(r.peso_pendente)})` : ''}`} />

      {!atendido && !r.no_cliente_agora && (
        <div className="resumo-bloco">
          <Linha rotulo="Chegada prevista" valor={r.previsao ? textoPrevisao(r.previsao) : '—'} />
          {r.previsao && <div className="secundario">{r.previsao.ordem}º na melhor rota.{notaPartida(r.previsao)}</div>}
          {!r.previsao && r.previsao_aviso && <div className="secundario">{r.previsao_aviso}</div>}
        </div>
      )}

      {(atendido || r.no_cliente_agora) && (
        <div className="resumo-bloco">
          <Linha rotulo="Chegou ao cliente" valor={r.chegou_em ? formatarHora(r.chegou_em) : '—'} />
          <Linha rotulo="Começou a entrega" valor={r.iniciou_em ? formatarHora(r.iniciou_em) : '—'} />
          <Linha rotulo="Terminou a entrega" valor={r.terminou_em ? formatarHora(r.terminou_em) : '—'} />
          <Linha rotulo="Saiu do cliente" valor={r.saiu_em ? formatarHora(r.saiu_em) : r.no_cliente_agora ? 'ainda no cliente' : '—'} />
          <Linha rotulo="Tempo no cliente" valor={r.tempo_no_cliente_s !== null ? formatarDuracao(r.tempo_no_cliente_s) : '—'} />
          {!r.chegou_em && (
            <div className="secundario">Chegada/saída não registradas (app sem rastreamento ou cliente sem coordenadas).</div>
          )}
        </div>
      )}
      {r.peso_incompleto && <div className="secundario">* Peso parcial: há itens sem B1_PESBRU.</div>}
    </>
  );
}

function ConteudoCaminhao({ r, nome }: { r: ResumoCaminhao; nome: string }) {
  return (
    <>
      <h3>{nome}</h3>
      <div className="secundario">
        {r.posicao_em
          ? `Posição ${formatarDecorrido(r.posicao_em)}${r.velocidade_kmh !== null ? ` · ${r.velocidade_kmh} km/h` : ''}`
          : 'Sem rastreamento'}
      </div>
      <div className="resumo-bloco">
        {r.no_cliente ? (
          <Linha rotulo="No cliente" valor={`${r.no_cliente.nome ?? r.no_cliente.codigo} desde ${formatarHora(r.no_cliente.desde)} (${formatarDecorrido(r.no_cliente.desde)})`} />
        ) : r.ultimo_cliente ? (
          <Linha rotulo="Saiu do último cliente" valor={`${formatarDecorrido(r.ultimo_cliente.saiu_em)} — ${r.ultimo_cliente.nome ?? r.ultimo_cliente.codigo} às ${formatarHora(r.ultimo_cliente.saiu_em)}`} />
        ) : (
          <Linha rotulo="Última entrega concluída" valor={r.ultima_conclusao_em
            ? `${formatarDecorrido(r.ultima_conclusao_em)} (${formatarHora(r.ultima_conclusao_em)})` : 'nenhuma ainda'} />
        )}
      </div>
      <div className="resumo-bloco">
        <Linha rotulo="Próximo cliente" valor={r.proximo ? (r.proximo.nome ?? r.proximo.cliente_codigo) : '—'} />
        {r.proximo && <Linha rotulo="Chega" valor={textoPrevisao(r.proximo)} />}
        {r.proximo && <div className="secundario">Pela melhor rota.{notaPartida(r.proximo)}</div>}
        {!r.proximo && r.aviso && <div className="secundario">{r.aviso}</div>}
      </div>
    </>
  );
}

export function ResumoPopup({ alvo, aoFechar }: { alvo: AlvoResumo; aoFechar: () => void }) {
  const { token, escopo } = useAuth();
  const [dados, setDados] = useState<ResumoCliente | ResumoCaminhao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: alvo.x, top: alvo.y });

  useEffect(() => {
    const controle = new AbortController();
    const caminho = alvo.tipo === 'cliente'
      ? `/gestao/motoristas/${alvo.motorista}/clientes/${encodeURIComponent(alvo.cliente)}/${encodeURIComponent(alvo.loja)}?${escopo}`
      : `/gestao/motoristas/${alvo.motorista}/caminhao?${escopo}`;
    setDados(null);
    setErro(null);
    requisitar<ResumoCliente | ResumoCaminhao>(caminho, { token, sinal: controle.signal })
      .then(setDados)
      .catch((e) => { if (!controle.signal.aborted) setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar o resumo.'); });
    return () => controle.abort();
  }, [alvo, token, escopo]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar(); };
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) aoFechar(); };
    document.addEventListener('keydown', tecla);
    document.addEventListener('mousedown', fora);
    return () => {
      document.removeEventListener('keydown', tecla);
      document.removeEventListener('mousedown', fora);
    };
  }, [aoFechar]);

  // Mantém o popup dentro da janela (abre ao lado do ícone clicado).
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, alvo.x + 12), window.innerWidth - width - 8);
    const top = alvo.y + 16 + height > window.innerHeight ? Math.max(8, alvo.y - height - 12) : alvo.y + 16;
    setPos({ left, top });
  }, [alvo, dados, erro]);

  return (
    <div ref={caixa} className="resumo-popup" role="dialog" aria-label="Resumo" style={{ left: pos.left, top: pos.top }}
      onClick={(e) => e.stopPropagation()}>
      <button type="button" className="fechar" onClick={aoFechar} aria-label="Fechar">×</button>
      {erro && <div className="aviso erro">{erro}</div>}
      {!erro && !dados && <div className="secundario">Carregando…</div>}
      {dados && alvo.tipo === 'cliente' && <ConteudoCliente r={dados as ResumoCliente} />}
      {dados && alvo.tipo === 'caminhao' && <ConteudoCaminhao r={dados as ResumoCaminhao} nome={alvo.motoristaNome} />}
    </div>
  );
}
