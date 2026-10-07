/**
 * Lista das entregas em andamento (uma linha por motorista), no formato usado pela gerência:
 * situação + motorista, caminhão, alertas (sem conexão há mais de 20 min, pausa, cliente) e contadores · carga e
 * rota · situação da entrega (um ícone por cliente, colorido pela situação, na ordem da ROTA IDEAL da viagem —
 * cliente atendido depois de pendentes anteriores indica desvio —, com barra de progresso e percentual).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CargaResumo, ClienteLista, MotoristaPainel, SituacaoCliente } from '../api/tipos';
import { formatarDataHora, formatarDecorrido, formatarDistancia, formatarHora } from '../util/formatacao';
import { SITUACAO, SITUACAO_CLIENTE, rotuloMotivo, rotuloRota, veiculosDoMotorista } from '../util/rotulos';
import { useAuth } from '../auth/AuthContext';
import { retirarCarga } from './CargasRetiradas';
import { ResumoPopup, type AlvoResumo } from './ResumoPopup';
import { SeloSituacao } from './Selo';

const ORDEM_ROTA = {
  IDEAL: 'Ordem da rota ideal da viagem (do depósito por todos os clientes)',
  MELHOR: 'Ordem da melhor rota',
  VIGENTE: 'Ordem da rota do motorista (rota ideal em cálculo)',
  ERP: 'Ordem do ERP (sem rota calculada)',
} as const;

/** Sem conexão por mais que isso: mostra o alerta de última conexão. */
const ALERTA_CONEXAO_MIN = 20;

/** Silhueta de pessoa na cor da situação do cliente. */
function IconePessoa({ cor, titulo, tamanho = 20 }: { cor: string; titulo: string; tamanho?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} role="img" aria-label={titulo}>
      <title>{titulo}</title>
      <circle cx="12" cy="7" r="4" fill={cor} />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z" fill={cor} />
    </svg>
  );
}

function IconeCaminhao({ cor }: { cor: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" role="img" aria-label="Posição do caminhão">
      <title>Caminhão (próximo cliente na sequência à direita)</title>
      <path fill={cor} d="M2 6h12v9H2zM14 9h4l3.5 3.5V15H14zM6 18.5a1.8 1.8 0 1 0 0-.01zM17 18.5a1.8 1.8 0 1 0 0-.01z" />
    </svg>
  );
}

/** Contador com a pessoa colorida (legenda das situações). */
function Contador({ situacao, valor }: { situacao: SituacaoCliente; valor: number }) {
  const s = SITUACAO_CLIENTE[situacao];
  return (
    <span className="contador" title={s.rotulo}>
      <IconePessoa cor={s.cor} titulo={s.rotulo} tamanho={16} />
      <span>{valor}</span>
    </span>
  );
}

function tituloCliente(c: ClienteLista, ideal: boolean): string {
  const ordem = c.ordem !== null ? `${c.ordem}º${ideal ? ' na rota ideal' : ''} · ` : '';
  return `${ordem}${c.nome ?? `${c.codigo}/${c.loja}`}${c.municipio ? ` (${c.municipio})` : ''} — ${SITUACAO_CLIENTE[c.situacao].rotulo}`;
}

/** "há 35 min" quando a última conexão passou do limite (ou nunca houve); null quando está em dia. */
function alertaConexao(ultima: string | null): string | null {
  if (!ultima) return 'Sem conexão registrada';
  const min = (Date.now() - new Date(ultima).getTime()) / 60000;
  return min > ALERTA_CONEXAO_MIN ? `Sem conexão ${formatarDecorrido(ultima)} (${formatarDataHora(ultima)})` : null;
}

/** Carga retirada agora (para oferecer "Desfazer"). */
export interface CargaRetiradaAgora {
  carga: CargaResumo;
  motorista: string;
}

function LinhaMotorista({ m: bruto, aoAlterar, aoRetirar, abrirResumo }: {
  m: MotoristaPainel;
  aoAlterar: () => void;
  aoRetirar: (r: CargaRetiradaAgora) => void;
  abrirResumo: (a: AlvoResumo) => void;
}) {
  const navegar = useNavigate();
  const { token, escopo } = useAuth();
  // Tolera a API anterior (sem a lista de clientes) enquanto o servidor não for atualizado.
  const m: MotoristaPainel = {
    ...bruto,
    clientes: bruto.clientes ?? [],
    notas_total: bruto.notas_total ?? 0,
    notas_entregues: bruto.notas_entregues ?? 0,
    ordem_rota: bruto.ordem_rota ?? 'ERP',
  };
  const ideal = m.ordem_rota === 'IDEAL';
  const concluidos = m.clientes_total - m.clientes_pendentes;
  const pct = m.clientes_total ? Math.round((concluidos / m.clientes_total) * 100) : 0;
  const pesoEntregue = m.peso_total === null ? null : Math.max(0, m.peso_total - m.peso_restante);
  // Caminhão: no cliente em atendimento; senão, antes do próximo cliente pendente.
  const noCliente = m.visita
    ? m.clientes.findIndex((c) => c.codigo === m.visita!.cliente_codigo && c.loja === m.visita!.cliente_loja)
    : -1;
  const posCaminhao = noCliente >= 0 ? noCliente : m.clientes.findIndex((c) => c.situacao === 'PENDENTE');
  const conexao = alertaConexao(m.ultima_conexao);
  const abrir = () => navegar(`/motoristas/${m.codigo}`);

  return (
    <tr className="linha-entrega" onClick={abrir}>
      <td className="col-dados">
        <div className="dados-topo">
          <Link to={`/motoristas/${m.codigo}`} onClick={(e) => e.stopPropagation()} className="nome-motorista">
            {m.nome}
          </Link>
          <span className="secundario">{m.codigo}</span>
        </div>
        <div className="secundario veiculo" title={veiculosDoMotorista(m)}>{veiculosDoMotorista(m)}</div>
        {conexao && <div className="dados-alerta"><span className="alerta-conexao">{conexao}</span></div>}
        <div className="contadores">
          <Contador situacao="NAO_ENTREGUE" valor={m.clientes_nao_entregues} />
          <Contador situacao="PARCIAL" valor={m.clientes_parciais} />
          <Contador situacao="PENDENTE" valor={m.clientes_pendentes} />
          <Contador situacao="ENTREGUE" valor={m.clientes_entregues} />
          <span className="contador" title="Notas fiscais entregues / total">
            <span className="rotulo-mini">NF</span> {m.notas_entregues}/{m.notas_total}
          </span>
          <span className="contador" title={`Peso entregue / peso de saída${m.peso_restante_incompleto ? ' (parcial: há itens sem B1_PESBRU)' : ''}`}>
            <span className="rotulo-mini">kg</span>
            {pesoEntregue === null ? '—' : `${Math.round(pesoEntregue)}/${Math.round(m.peso_total ?? 0)}`}
            {m.peso_restante_incompleto ? '*' : ''}
          </span>
        </div>
        <div className="dados-rodape">
          <SeloSituacao situacao={m.situacao} />
          {m.pausa && <span className="secundario">{rotuloMotivo(m.pausa.motivo)} desde {formatarHora(m.pausa.desde)}</span>}
          {m.visita && <span className="secundario">No cliente {m.visita.cliente_nome ?? m.visita.cliente_codigo}</span>}
        </div>
      </td>
      <td className="col-carga">
        {m.cargas.map((c) => (
          <div key={`${c.filial}|${c.codigo}|${c.seqcar}`} className="linha-carga" title={rotuloRota(c) ?? undefined}>
            <strong>Nº {c.codigo}/{c.seqcar}</strong>
            <span className="secundario"> · {c.data.split('-').reverse().slice(0, 2).join('/')}</span>
            {rotuloRota(c) && <span className="rota-carga"> · {rotuloRota(c)}</span>}
            <button type="button" className="retirar-carga" title="Retirar esta carga da viagem (não aparece mais no aplicativo)"
              aria-label={`Retirar a carga ${c.codigo}/${c.seqcar} da viagem`}
              onClick={(e) => {
                e.stopPropagation();
                void retirarCarga(c, m.nome, token, escopo).then((ok) => {
                  if (!ok) return;
                  aoRetirar({ carga: c, motorista: m.nome });
                  aoAlterar();
                });
              }}>✕</button>
          </div>
        ))}
        <div className="secundario linha-rotas" title="Melhor rota: menor distância (OSRM) da posição atual pelos clientes pendentes">
          Melhor rota {formatarDistancia(m.melhor_rota_m)}
          {m.rota_vigente && <> · Motorista {formatarDistancia(m.rota_vigente.distancia_m)}</>}
          {m.previsao_termino_em && (
            <span title="Previsão: melhor rota restante + tempo médio por cliente pendente">
              {' '}· Término previsto {formatarHora(m.previsao_termino_em)}
            </span>
          )}
        </div>
      </td>
      <td className="col-situacao">
        <div className="progresso-fundo" style={{ width: `${pct}%` }} aria-hidden="true" />
        <div className="icones-clientes" title={ORDEM_ROTA[m.ordem_rota]}>
          {m.clientes.map((c, i) => (
            <span key={`${c.codigo}|${c.loja}`} className="icone-pessoa">
              {i === posCaminhao && m.situacao !== 'SEM_SINAL' && (
                <button type="button" className="icone-botao" aria-label={`Resumo do caminhão de ${m.nome}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirResumo({ tipo: 'caminhao', motorista: m.codigo, motoristaNome: m.nome, x: e.clientX, y: e.clientY });
                  }}>
                  <IconeCaminhao cor={SITUACAO[m.situacao].cor} />
                </button>
              )}
              <button type="button" className="icone-botao" aria-label={`Resumo: ${tituloCliente(c, ideal)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  abrirResumo({ tipo: 'cliente', motorista: m.codigo, cliente: c.codigo, loja: c.loja, x: e.clientX, y: e.clientY });
                }}>
                <IconePessoa cor={SITUACAO_CLIENTE[c.situacao].cor} titulo={tituloCliente(c, ideal)} />
              </button>
            </span>
          ))}
          {m.clientes.length === 0 && <span className="secundario">Sem clientes</span>}
        </div>
        <span className={`percentual${pct === 100 ? ' completo' : ''}`}>{pct}%</span>
        {ideal && (m.fora_sequencia ?? 0) > 0 ? (
          <span className="ordem-aviso desvio" title="Clientes pendentes que ficaram para trás na rota ideal (o motorista não está seguindo a sequência)">
            ⚠ {m.fora_sequencia} fora da sequência
          </span>
        ) : !ideal && m.clientes_pendentes > 0 && (
          <span className="ordem-aviso" title={ORDEM_ROTA[m.ordem_rota]}>
            {m.ordem_rota === 'VIGENTE' ? 'rota do motorista' : m.ordem_rota === 'ERP' ? 'ordem do ERP' : ''}
          </span>
        )}
      </td>
    </tr>
  );
}

export function ListaEntregas({ motoristas, aoAlterar, aoRetirar }: {
  motoristas: MotoristaPainel[];
  aoAlterar: () => void;
  aoRetirar: (r: CargaRetiradaAgora) => void;
}) {
  const [resumo, setResumo] = useState<AlvoResumo | null>(null);
  return (
    <div className="tabela-rolagem">
      <table className="tabela tabela-entregas">
        <thead>
          <tr>
            <th>Dados gerais</th>
            <th>Carga</th>
            <th>Situação da entrega (ordem da rota ideal)</th>
          </tr>
        </thead>
        <tbody>
          {motoristas.map((m) => (
            <LinhaMotorista key={m.codigo} m={m} aoAlterar={aoAlterar} aoRetirar={aoRetirar} abrirResumo={setResumo} />
          ))}
        </tbody>
      </table>
      {resumo && <ResumoPopup alvo={resumo} aoFechar={() => setResumo(null)} />}
      <div className="legenda-lista secundario">
        {(['ENTREGUE', 'PARCIAL', 'NAO_ENTREGUE', 'PENDENTE'] as SituacaoCliente[]).map((s) => (
          <span key={s}><IconePessoa cor={SITUACAO_CLIENTE[s].cor} titulo={SITUACAO_CLIENTE[s].rotulo} /> {SITUACAO_CLIENTE[s].rotulo}</span>
        ))}
        <span>Ícones na ordem da rota ideal: cinza antes de verde/vermelho = cliente pulado. Clique no cliente ou no caminhão para ver o resumo.</span>
        <span>Percentual = clientes concluídos (entregues, parciais ou não entregues) sobre o total.</span>
        <span>* Peso parcial: há itens sem B1_PESBRU.</span>
      </div>
    </div>
  );
}
