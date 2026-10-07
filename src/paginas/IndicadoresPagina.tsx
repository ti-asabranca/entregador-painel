/**
 * Indicadores do período: resumo, evolução diária, desempenho por motorista (ordenável), clientes que mais demoram
 * e motivos de não entrega/devolução. Filtros: período, motorista e filiais (barra do topo). Exportação CSV.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { IndicadorMotorista, Indicadores } from '../api/tiposAnalise';
import { useAuth } from '../auth/AuthContext';
import { FiltroPeriodo, periodoPadrao } from '../componentes/FiltroPeriodo';
import { BarrasEmpilhadas, BarrasHorizontais, COR_SERIE_2, Linha } from '../componentes/Graficos';
import { useConsulta } from '../hooks/useConsulta';
import { baixarCsv, numeroCsv } from '../util/csv';
import { formatarDuracao } from '../util/formatacao';
import { rotuloMotivo } from '../util/rotulos';

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const pct = (v: number | null) => (v === null ? '—' : `${numero.format(v)}%`);

type Coluna = keyof Pick<IndicadorMotorista, 'nome' | 'clientes_concluidos' | 'taxa_sucesso' | 'clientes_nao_entregues'
  | 'notas_entregues' | 'itens_entregues' | 'itens_devolvidos' | 'tempo_medio_cliente_s' | 'minutos_por_item' | 'km'>;

const COLUNAS: [Coluna, string, string?][] = [
  ['nome', 'Motorista'],
  ['clientes_concluidos', 'Clientes', 'Clientes concluídos (entregues, parciais e não entregues)'],
  ['taxa_sucesso', 'Sucesso', 'Clientes entregues integralmente ÷ concluídos'],
  ['clientes_nao_entregues', 'Não entregues'],
  ['notas_entregues', 'NF entregues'],
  ['itens_entregues', 'Itens'],
  ['itens_devolvidos', 'Itens devolvidos'],
  ['tempo_medio_cliente_s', 'Tempo médio/cliente', 'Permanência média no cliente (chegada → saída, pelo rastreamento)'],
  ['minutos_por_item', 'Min/item', 'Tempo total nos clientes ÷ itens entregues (aproximado)'],
  ['km', 'Km rodados', 'Distância pelo percurso gravado'],
];

function exportar(d: Indicadores): void {
  baixarCsv(`indicadores-${d.periodo.de}-${d.periodo.ate}.csv`,
    ['Motorista', 'Nome', 'Clientes concluídos', 'Entregues', 'Parciais', 'Não entregues', 'Taxa sucesso (%)',
      'NF entregues', 'Itens entregues', 'Itens devolvidos', 'Visitas', 'Tempo médio cliente (min)', 'Min/item', 'Km'],
    d.motoristas.map((m) => [m.motorista, m.nome, m.clientes_concluidos, m.clientes_entregues, m.clientes_parciais,
      m.clientes_nao_entregues, numeroCsv(m.taxa_sucesso), m.notas_entregues, m.itens_entregues, m.itens_devolvidos,
      m.visitas, numeroCsv(m.tempo_medio_cliente_s === null ? null : Math.round(m.tempo_medio_cliente_s / 6) / 10),
      numeroCsv(m.minutos_por_item), numeroCsv(m.km)]));
}

export function IndicadoresPagina() {
  const { escopo } = useAuth();
  const [periodo, setPeriodo] = useState(periodoPadrao);
  const [motorista, setMotorista] = useState('');
  const [ordem, setOrdem] = useState<{ coluna: Coluna; desc: boolean }>({ coluna: 'clientes_concluidos', desc: true });
  const caminho = `/gestao/indicadores?de=${periodo.de}&ate=${periodo.ate}${motorista ? `&motorista=${motorista}` : ''}&${escopo}`;
  const { dados, erro, carregando } = useConsulta<Indicadores>(caminho, 300000);

  // Lista do seletor: motoristas da última consulta sem filtro de motorista (não some ao filtrar).
  const [listaMotoristas, setListaMotoristas] = useState<[string, string][]>([]);
  useEffect(() => {
    if (!dados || motorista) return;
    setListaMotoristas(dados.motoristas.map((m) => [m.motorista, m.nome ?? m.motorista] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1])));
  }, [dados, motorista]);

  const motoristas = useMemo(() => {
    const lista = [...(dados?.motoristas ?? [])];
    const { coluna, desc } = ordem;
    return lista.sort((a, b) => {
      const va = a[coluna];
      const vb = b[coluna];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const r = typeof va === 'string' ? va.localeCompare(String(vb)) : Number(va) - Number(vb);
      return desc ? -r : r;
    });
  }, [dados, ordem]);

  const evolucao = useMemo(() => (dados?.evolucao ?? []).map((e) => ({
    rotulo: e.dia, v1: e.entregues, v2: Math.max(0, e.concluidos - e.entregues),
  })), [dados]);
  const tempoDia = useMemo(() => (dados?.evolucao ?? []).map((e) => ({
    rotulo: e.dia, valor: e.media_cliente_s === null ? null : Math.round(e.media_cliente_s / 60),
  })), [dados]);
  const motivos = useMemo(() => (dados?.motivos ?? []).map((m) => ({
    rotulo: `${rotuloMotivo(m.motivo)}${m.tipo === 'DEVOLUCAO' ? ' (item)' : ' (nota)'}`, valor: m.quantidade,
  })).sort((a, b) => b.valor - a.valor), [dados]);

  const r = dados?.resumo;
  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>Indicadores</h1>
        <div className="resumo">
          {carregando && <span className="secundario">Atualizando…</span>}
          <button type="button" className="botao secundario-botao" disabled={!dados?.motoristas.length}
            onClick={() => dados && exportar(dados)}>Exportar CSV</button>
        </div>
      </div>

      <div className="filtros">
        <FiltroPeriodo valor={periodo} aoMudar={setPeriodo} />
        <select value={motorista} onChange={(e) => setMotorista(e.target.value)} aria-label="Motorista">
          <option value="">Todos os motoristas</option>
          {listaMotoristas.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}

      {r && (
        <section className="cartoes-numeros indicadores-resumo">
          <div className="numero"><span className="rotulo">Clientes concluídos</span><strong>{r.clientes_concluidos}</strong>
            <span className="secundario">{r.motoristas} motoristas</span></div>
          <div className="numero"><span className="rotulo">Taxa de sucesso</span><strong>{pct(r.taxa_sucesso)}</strong>
            <span className="secundario">{r.clientes_parciais} parciais · {r.clientes_nao_entregues} não entregues</span></div>
          <div className="numero"><span className="rotulo">NF entregues</span><strong>{r.notas_entregues}</strong>
            <span className="secundario">{r.itens_entregues} itens · {r.itens_devolvidos} devolvidos</span></div>
          <div className="numero"><span className="rotulo">Tempo médio no cliente</span>
            <strong>{formatarDuracao(r.tempo_medio_cliente_s)}</strong>
            <span className="secundario">{r.visitas} visitas rastreadas</span></div>
          <div className="numero"><span className="rotulo">Km rodados</span><strong>{numero.format(r.km)}</strong>
            <span className="secundario">pelo percurso gravado</span></div>
        </section>
      )}

      {dados && (
        <div className="graficos">
          <BarrasEmpilhadas titulo="Clientes concluídos por dia" dados={evolucao}
            serie1="Entregues" serie2="Com ocorrência (parcial ou não entregue)" />
          <Linha titulo="Tempo médio no cliente por dia" unidade="min" dados={tempoDia} />
          <BarrasHorizontais titulo="Motivos de não entrega e devolução" dados={motivos} cor={COR_SERIE_2} />
        </div>
      )}

      {dados && (
        <section>
          <h2>Desempenho por motorista</h2>
          {motoristas.length === 0 ? <div className="aviso">Nenhuma conclusão no período.</div> : (
            <div className="tabela-rolagem">
              <table className="tabela tabela-numeros">
                <thead>
                  <tr>
                    {COLUNAS.map(([c, rotulo, dica]) => (
                      <th key={c} title={dica} aria-sort={ordem.coluna === c ? (ordem.desc ? 'descending' : 'ascending') : undefined}>
                        <button type="button" className="ordenar"
                          onClick={() => setOrdem((o) => ({ coluna: c, desc: o.coluna === c ? !o.desc : c !== 'nome' }))}>
                          {rotulo}{ordem.coluna === c ? (ordem.desc ? ' ▼' : ' ▲') : ''}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {motoristas.map((m) => (
                    <tr key={m.motorista}>
                      <td><Link to={`/motoristas/${m.motorista}`}>{m.nome ?? m.motorista}</Link>
                        <div className="secundario">{m.motorista}</div></td>
                      <td>{m.clientes_concluidos}</td>
                      <td>{pct(m.taxa_sucesso)}</td>
                      <td>{m.clientes_nao_entregues}{m.clientes_parciais ? <span className="secundario"> +{m.clientes_parciais} parc.</span> : null}</td>
                      <td>{m.notas_entregues}</td>
                      <td>{m.itens_entregues}</td>
                      <td>{m.itens_devolvidos}</td>
                      <td>{formatarDuracao(m.tempo_medio_cliente_s)}{m.visitas ? <span className="secundario"> ({m.visitas})</span> : null}</td>
                      <td>{m.minutos_por_item === null ? '—' : numero.format(m.minutos_por_item)}</td>
                      <td>{m.km === null ? '—' : numero.format(m.km)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {dados && (
        <section>
          <h2>Clientes que mais demoram para receber</h2>
          {dados.clientes_demorados.length === 0 ? (
            <div className="aviso">
              Sem visitas rastreadas suficientes no período (mínimo de 2 por cliente). O tempo no cliente vem da
              chegada/saída detectadas pelo rastreamento do aplicativo.
            </div>
          ) : (
            <div className="tabela-rolagem">
              <table className="tabela tabela-numeros">
                <thead>
                  <tr><th>Cliente</th><th>Município</th><th>Visitas</th><th>Média</th><th>Mediana</th>
                    <th title="Chegada até a conclusão no aplicativo">Até concluir</th></tr>
                </thead>
                <tbody>
                  {dados.clientes_demorados.map((c) => (
                    <tr key={`${c.codigo}|${c.loja}`}>
                      <td>{c.nome ?? '—'}<div className="secundario">{c.codigo}/{c.loja}</div></td>
                      <td>{c.municipio ?? '—'}</td>
                      <td>{c.visitas}</td>
                      <td><strong>{formatarDuracao(c.media_cliente_s)}</strong></td>
                      <td>{formatarDuracao(c.mediana_cliente_s)}</td>
                      <td>{formatarDuracao(c.media_ate_concluir_s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
