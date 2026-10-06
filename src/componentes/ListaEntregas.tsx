/**
 * Lista das entregas em andamento (uma linha por motorista), no formato usado pela gerência:
 * dados gerais (motorista, caminhão, última conexão, contadores e pesos) · carga · situação da entrega
 * (um ícone por cliente, colorido pela situação, na ordem da melhor rota, com barra de progresso e percentual).
 */
import { Link, useNavigate } from 'react-router-dom';
import type { ClienteLista, MotoristaPainel, SituacaoCliente } from '../api/tipos';
import { formatarDataHora, formatarDistancia, formatarHora } from '../util/formatacao';
import { SITUACAO, SITUACAO_CLIENTE, rotuloMotivo } from '../util/rotulos';
import { SeloSituacao } from './Selo';

const ORDEM_ROTA = {
  MELHOR: 'Ordem da melhor rota',
  VIGENTE: 'Ordem da rota do motorista (melhor rota em cálculo)',
  ERP: 'Ordem do ERP (sem rota calculada)',
} as const;

/** Silhueta de pessoa na cor da situação do cliente. */
function IconePessoa({ cor, titulo }: { cor: string; titulo: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" role="img" aria-label={titulo}>
      <title>{titulo}</title>
      <circle cx="12" cy="7" r="4" fill={cor} />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z" fill={cor} />
    </svg>
  );
}

function IconeCaminhao({ cor }: { cor: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" role="img" aria-label="Posição do caminhão">
      <title>Caminhão (próximo cliente à direita)</title>
      <path fill={cor} d="M2 6h12v9H2zM14 9h4l3.5 3.5V15H14zM6 18.5a1.8 1.8 0 1 0 0-.01zM17 18.5a1.8 1.8 0 1 0 0-.01z" />
    </svg>
  );
}

/** Contador com a pessoa colorida (legenda das situações). */
function Contador({ situacao, valor }: { situacao: SituacaoCliente; valor: number }) {
  const s = SITUACAO_CLIENTE[situacao];
  return (
    <span className="contador" title={s.rotulo}>
      <IconePessoa cor={s.cor} titulo={s.rotulo} />
      <span>{valor}</span>
    </span>
  );
}

function tituloCliente(c: ClienteLista): string {
  const ordem = c.ordem !== null ? `${c.ordem}º · ` : '';
  return `${ordem}${c.nome ?? `${c.codigo}/${c.loja}`}${c.municipio ? ` (${c.municipio})` : ''} — ${SITUACAO_CLIENTE[c.situacao].rotulo}`;
}

function LinhaMotorista({ m: bruto }: { m: MotoristaPainel }) {
  const navegar = useNavigate();
  // Tolera a API anterior (sem a lista de clientes) enquanto o servidor não for atualizado.
  const m: MotoristaPainel = {
    ...bruto,
    clientes: bruto.clientes ?? [],
    notas_total: bruto.notas_total ?? 0,
    notas_entregues: bruto.notas_entregues ?? 0,
    ordem_rota: bruto.ordem_rota ?? 'ERP',
  };
  const concluidos = m.clientes_total - m.clientes_pendentes;
  const pct = m.clientes_total ? Math.round((concluidos / m.clientes_total) * 100) : 0;
  const pesoEntregue = m.peso_total === null ? null : Math.max(0, m.peso_total - m.peso_restante);
  // Caminhão antes do primeiro pendente (ou no cliente em atendimento).
  const posCaminhao = m.clientes.findIndex((c) => c.situacao === 'PENDENTE');
  const abrir = () => navegar(`/motoristas/${m.codigo}`);

  return (
    <tr className="linha-entrega" onClick={abrir}>
      <td className="col-dados">
        <div className="dados-topo">
          <Link to={`/motoristas/${m.codigo}`} onClick={(e) => e.stopPropagation()} className="nome-motorista">
            {m.nome}
          </Link>
          <span className="secundario"> · {m.codigo}</span>
        </div>
        <div className="secundario">{m.caminhoes.join(', ') || 'Veículo não informado'}</div>
        <div className="secundario">Última conexão: {formatarDataHora(m.ultima_conexao)}</div>
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
          <div key={`${c.filial}|${c.codigo}|${c.seqcar}`}>
            <strong>Nº {c.codigo}/{c.seqcar}</strong>
            <span className="secundario"> · {c.data.split('-').reverse().join('/')}{c.hora ? ` ${c.hora}` : ''}</span>
          </div>
        ))}
        <div className="secundario">Início das entregas: {m.inicio_entregas ? formatarDataHora(m.inicio_entregas) : '—'}</div>
        <div className="secundario" title="Menor distância (OSRM) da posição atual pelos clientes pendentes">
          Melhor rota: {formatarDistancia(m.melhor_rota_m)}
          {m.rota_vigente && ` · rota do motorista: ${formatarDistancia(m.rota_vigente.distancia_m)}`}
        </div>
      </td>
      <td className="col-situacao">
        <div className="progresso-fundo" style={{ width: `${pct}%` }} aria-hidden="true" />
        <div className="icones-clientes" title={ORDEM_ROTA[m.ordem_rota]}>
          {m.clientes.map((c, i) => (
            <span key={`${c.codigo}|${c.loja}`} className="icone-pessoa">
              {i === posCaminhao && m.situacao !== 'SEM_SINAL' && <IconeCaminhao cor={SITUACAO[m.situacao].cor} />}
              <IconePessoa cor={SITUACAO_CLIENTE[c.situacao].cor} titulo={tituloCliente(c)} />
            </span>
          ))}
          {m.clientes.length === 0 && <span className="secundario">Sem clientes</span>}
        </div>
        <span className={`percentual${pct === 100 ? ' completo' : ''}`}>{pct}%</span>
        {m.ordem_rota !== 'MELHOR' && m.clientes_pendentes > 0 && (
          <span className="ordem-aviso" title={ORDEM_ROTA[m.ordem_rota]}>
            {m.ordem_rota === 'VIGENTE' ? 'rota do motorista' : 'ordem do ERP'}
          </span>
        )}
      </td>
    </tr>
  );
}

export function ListaEntregas({ motoristas }: { motoristas: MotoristaPainel[] }) {
  return (
    <div className="tabela-rolagem">
      <table className="tabela tabela-entregas">
        <thead>
          <tr>
            <th>Dados gerais</th>
            <th>Carga</th>
            <th>Situação da entrega (ordem da melhor rota)</th>
          </tr>
        </thead>
        <tbody>
          {motoristas.map((m) => <LinhaMotorista key={m.codigo} m={m} />)}
        </tbody>
      </table>
      <div className="legenda-lista secundario">
        {(['ENTREGUE', 'PARCIAL', 'NAO_ENTREGUE', 'PENDENTE'] as SituacaoCliente[]).map((s) => (
          <span key={s}><IconePessoa cor={SITUACAO_CLIENTE[s].cor} titulo={SITUACAO_CLIENTE[s].rotulo} /> {SITUACAO_CLIENTE[s].rotulo}</span>
        ))}
        <span>Percentual = clientes concluídos (entregues, parciais ou não entregues) sobre o total.</span>
        <span>* Peso parcial: há itens sem B1_PESBRU.</span>
      </div>
    </div>
  );
}
