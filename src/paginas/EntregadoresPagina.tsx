/**
 * Funcionalidade 2 (visão geral): todos os motoristas com viagem em andamento — situação, caminhão, peso de saída
 * e restante, progresso dos clientes. Clicar abre o detalhe com rotas e clientes na ordem da melhor rota.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Painel, Situacao } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { ListaEntregas } from '../componentes/ListaEntregas';
import { SeloSituacao } from '../componentes/Selo';
import { useConsulta } from '../hooks/useConsulta';
import { formatarDecorrido, formatarHora, formatarPeso, percentualEntregue } from '../util/formatacao';
import { ORDEM_SITUACOES, SITUACAO, rotuloMotivo, rotuloRota, textoBuscaVeiculoRota, veiculosDoMotorista } from '../util/rotulos';

const INTERVALO_MS = 30000;
const CHAVE_VISAO = 'gestao.visao_entregadores';

type Visao = 'lista' | 'cartoes';

function lerVisao(): Visao {
  try {
    return localStorage.getItem(CHAVE_VISAO) === 'cartoes' ? 'cartoes' : 'lista';
  } catch {
    return 'lista';
  }
}

export function EntregadoresPagina() {
  const { escopo } = useAuth();
  const { dados, erro, carregando } = useConsulta<Painel>(`/gestao/painel?${escopo}`, INTERVALO_MS);
  const [filtro, setFiltro] = useState<Situacao | 'TODOS'>('TODOS');
  const [busca, setBusca] = useState('');
  const [visao, setVisao] = useState<Visao>(lerVisao);

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    try {
      localStorage.setItem(CHAVE_VISAO, v);
    } catch {
      // preferência só nesta aba
    }
  };

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (dados?.motoristas ?? [])
      .filter((m) => filtro === 'TODOS' || m.situacao === filtro)
      .filter((m) => !termo || m.nome.toLowerCase().includes(termo) || m.codigo.includes(termo)
        || textoBuscaVeiculoRota(m).includes(termo));
  }, [dados, filtro, busca]);

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>Entregas em andamento</h1>
        {dados && (
          <div className="resumo">
            <span><strong>{dados.resumo.motoristas}</strong> motoristas</span>
            <span><strong>{dados.resumo.clientes_pendentes}</strong> clientes pendentes</span>
            <span><strong>{formatarPeso(dados.resumo.peso_restante)}</strong> a entregar</span>
            <span className="secundario">Atualizado às {formatarHora(dados.atualizado_em)}{carregando ? '…' : ''}</span>
          </div>
        )}
      </div>

      <div className="filtros">
        <input type="search" placeholder="Buscar motorista, código, placa ou rota" value={busca}
          onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        <div className="alternar-visao" role="group" aria-label="Forma de exibição">
          <button type="button" className={visao === 'lista' ? 'ativo' : ''} onClick={() => trocarVisao('lista')}>Lista</button>
          <button type="button" className={visao === 'cartoes' ? 'ativo' : ''} onClick={() => trocarVisao('cartoes')}>Cartões</button>
        </div>
        <div className="chips" role="group" aria-label="Filtrar por situação">
          <button type="button" className={filtro === 'TODOS' ? 'ativo' : ''} onClick={() => setFiltro('TODOS')}>Todos</button>
          {ORDEM_SITUACOES.map((s) => (
            <button key={s} type="button" className={filtro === s ? 'ativo' : ''} onClick={() => setFiltro(s)}>
              {SITUACAO[s].rotulo} ({dados?.resumo.por_situacao[s] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}
      {dados && lista.length === 0 && <div className="aviso">Nenhum motorista com viagem em andamento neste filtro.</div>}

      {visao === 'lista' && lista.length > 0 && <ListaEntregas motoristas={lista} />}

      {visao === 'cartoes' && <div className="grade-motoristas">
        {lista.map((m) => {
          const pct = percentualEntregue(m.peso_total, m.peso_restante);
          return (
            <Link key={m.codigo} to={`/motoristas/${m.codigo}`} className="cartao-motorista">
              <div className="cartao-topo">
                <div>
                  <strong>{m.nome}</strong>
                  <div className="secundario">{veiculosDoMotorista(m)} · {m.cargas.length} carga(s)</div>
                  {m.cargas.some((c) => rotuloRota(c)) && (
                    <div className="secundario">Rota: {[...new Set(m.cargas.map(rotuloRota).filter(Boolean))].join(', ')}</div>
                  )}
                </div>
                <SeloSituacao situacao={m.situacao} />
              </div>
              <div className="cartao-linha">
                <span>Saída <strong>{formatarPeso(m.peso_total)}</strong></span>
                <span>Resta <strong>{formatarPeso(m.peso_restante)}</strong>{m.peso_restante_incompleto ? '*' : ''}</span>
              </div>
              {pct !== null && <div className="barra fina"><div style={{ width: `${pct}%` }} /></div>}
              <div className="cartao-linha">
                <span>{m.clientes_entregues} entregues · {m.clientes_pendentes} pendentes</span>
                {(m.clientes_nao_entregues + m.clientes_parciais) > 0 && (
                  <span className="erro-texto">{m.clientes_nao_entregues + m.clientes_parciais} com ocorrência</span>
                )}
              </div>
              <div className="secundario">
                {m.pausa && `Pausa: ${rotuloMotivo(m.pausa.motivo)} desde ${formatarHora(m.pausa.desde)} · `}
                {m.visita && `No cliente ${m.visita.cliente_nome ?? m.visita.cliente_codigo} · `}
                {m.posicao ? `Posição ${formatarDecorrido(m.posicao.em)}` : 'Sem rastreamento'}
              </div>
            </Link>
          );
        })}
      </div>}
    </main>
  );
}
