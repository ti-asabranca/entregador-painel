/**
 * Fechamento do período: notas encerradas para reenvio e itens devolvidos (com valor e peso estimados), totais por
 * motivo e exportação CSV para o faturamento/logística reversa.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Fechamento } from '../api/tiposAnalise';
import { useAuth } from '../auth/AuthContext';
import { FiltroPeriodo, periodoPadrao } from '../componentes/FiltroPeriodo';
import { useConsulta } from '../hooks/useConsulta';
import { baixarCsv, numeroCsv } from '../util/csv';
import { formatarDataHora, formatarPeso } from '../util/formatacao';
import { rotuloMotivo } from '../util/rotulos';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const valor = (v: number | null) => (v === null ? '—' : moeda.format(v));

export function FechamentoPagina() {
  const { escopo } = useAuth();
  const [periodo, setPeriodo] = useState(periodoPadrao);
  const [aba, setAba] = useState<'reenvios' | 'devolucoes'>('reenvios');
  const [busca, setBusca] = useState('');
  const { dados, erro, carregando } = useConsulta<Fechamento>(
    `/gestao/fechamento?de=${periodo.de}&ate=${periodo.ate}&${escopo}`, 300000,
  );

  const termo = busca.trim().toLowerCase();
  const reenvios = useMemo(() => (dados?.reenvios ?? []).filter((r) => !termo
    || [r.cliente_nome, r.cliente_codigo, r.nf_doc, r.pedido, r.carga_codigo, r.motorista_nome]
      .some((v) => v?.toLowerCase().includes(termo))), [dados, termo]);
  const devolucoes = useMemo(() => (dados?.devolucoes ?? []).filter((d) => !termo
    || [d.cliente_nome, d.cliente_codigo, d.nf_doc, d.produto, d.produto_descricao, d.motorista_nome]
      .some((v) => v?.toLowerCase().includes(termo))), [dados, termo]);
  const totalDevolvido = devolucoes.reduce((t, d) => t + (d.valor ?? 0), 0);
  const pesoDevolvido = devolucoes.reduce((t, d) => t + (d.peso ?? 0), 0);

  function exportar() {
    if (!dados) return;
    const sufixo = `${dados.periodo.de}-${dados.periodo.ate}`;
    if (aba === 'reenvios') {
      baixarCsv(`reenvios-${sufixo}.csv`,
        ['Data/hora', 'Filial', 'Carga', 'NF', 'Série', 'Pedido', 'Cliente', 'Loja', 'Nome', 'Município', 'Motorista', 'Observação'],
        reenvios.map((r) => [formatarDataHora(r.ocorrido_em), r.filial, `${r.carga_codigo}/${r.seqcar}`, r.nf_doc, r.nf_serie,
          r.pedido, r.cliente_codigo, r.cliente_loja, r.cliente_nome, r.municipio,
          `${r.motorista ?? ''} ${r.motorista_nome ?? ''}`.trim(), r.descricao]));
    } else {
      baixarCsv(`devolucoes-${sufixo}.csv`,
        ['Data/hora', 'Filial', 'NF', 'Série', 'Item', 'Produto', 'Descrição', 'Qtd. devolvida', 'Qtd. nota', 'Unidade',
          'Valor estimado', 'Peso (kg)', 'Motivo', 'Observação', 'Cliente', 'Loja', 'Nome', 'Motorista'],
        devolucoes.map((d) => [formatarDataHora(d.devolvido_em), d.filial, d.nf_doc, d.nf_serie, d.item, d.produto,
          d.produto_descricao, numeroCsv(d.quantidade), numeroCsv(d.quantidade_nota), d.unidade, numeroCsv(d.valor),
          numeroCsv(d.peso), rotuloMotivo(d.motivo), d.descricao, d.cliente_codigo, d.cliente_loja, d.cliente_nome,
          `${d.motorista ?? ''} ${d.motorista_nome ?? ''}`.trim()]));
    }
  }

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>Fechamento: reenvios e devoluções</h1>
        <div className="resumo">
          {carregando && <span className="secundario">Atualizando…</span>}
          <button type="button" className="botao secundario-botao" onClick={exportar}
            disabled={aba === 'reenvios' ? !reenvios.length : !devolucoes.length}>Exportar CSV</button>
        </div>
      </div>

      <div className="filtros">
        <FiltroPeriodo valor={periodo} aoMudar={setPeriodo} />
        <input type="search" placeholder="Cliente, NF, pedido, produto ou motorista" value={busca}
          onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
      </div>

      {erro && <div className="aviso erro">{erro}</div>}

      {dados && (
        <section className="cartoes-numeros indicadores-resumo">
          <div className="numero"><span className="rotulo">Notas para reenvio</span><strong>{reenvios.length}</strong>
            <span className="secundario">encerradas pelo motorista</span></div>
          <div className="numero"><span className="rotulo">Itens devolvidos</span><strong>{devolucoes.length}</strong></div>
          <div className="numero" title="Proporcional ao valor total do item na nota"><span className="rotulo">Valor devolvido (estimado)</span>
            <strong>{moeda.format(totalDevolvido)}</strong></div>
          <div className="numero"><span className="rotulo">Peso devolvido</span><strong>{formatarPeso(pesoDevolvido)}</strong></div>
        </section>
      )}

      {dados && dados.devolucoes_por_motivo.length > 0 && (
        <section>
          <h2>Devoluções por motivo</h2>
          <div className="tabela-rolagem">
            <table className="tabela tabela-numeros">
              <thead><tr><th>Motivo</th><th>Itens</th><th>Valor estimado</th><th>Peso</th></tr></thead>
              <tbody>
                {[...dados.devolucoes_por_motivo].sort((a, b) => b.valor - a.valor).map((m) => (
                  <tr key={m.motivo}>
                    <td>{rotuloMotivo(m.motivo)}</td>
                    <td>{m.itens}</td>
                    <td>{moeda.format(m.valor)}{m.sem_valor > 0 && <span className="secundario" title="Itens sem valor no ERP"> ({m.sem_valor} sem valor)</span>}</td>
                    <td>{formatarPeso(m.peso)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {dados && (
        <>
          <div className="abas" role="tablist">
            <button type="button" role="tab" aria-selected={aba === 'reenvios'} className={aba === 'reenvios' ? 'ativo' : ''}
              onClick={() => setAba('reenvios')}>Reenvios ({reenvios.length})</button>
            <button type="button" role="tab" aria-selected={aba === 'devolucoes'} className={aba === 'devolucoes' ? 'ativo' : ''}
              onClick={() => setAba('devolucoes')}>Devoluções ({devolucoes.length})</button>
          </div>

          {aba === 'reenvios' && (reenvios.length === 0 ? <div className="aviso">Nenhuma nota para reenvio no período.</div> : (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead><tr><th>Quando</th><th>Cliente</th><th>NF / Pedido</th><th>Carga</th><th>Motorista</th><th>Observação</th></tr></thead>
                <tbody>
                  {reenvios.map((r, i) => (
                    <tr key={`${r.filial}|${r.nf_doc}|${r.nf_serie}|${i}`}>
                      <td>{formatarDataHora(r.ocorrido_em)}</td>
                      <td>{r.cliente_nome ?? '—'}<div className="secundario">{r.cliente_codigo}/{r.cliente_loja}{r.municipio ? ` · ${r.municipio}` : ''}</div></td>
                      <td>{r.nf_doc}-{r.nf_serie}<div className="secundario">Pedido {r.pedido ?? '—'}</div></td>
                      <td>{r.carga_codigo}/{r.seqcar}<div className="secundario">Filial {r.filial}</div></td>
                      <td>{r.motorista ? <Link to={`/motoristas/${r.motorista}`}>{r.motorista_nome ?? r.motorista}</Link> : '—'}</td>
                      <td>{r.descricao ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {aba === 'devolucoes' && (devolucoes.length === 0 ? <div className="aviso">Nenhum item devolvido no período.</div> : (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead><tr><th>Quando</th><th>Produto</th><th>Quantidade</th><th>Valor / Peso</th><th>Motivo</th><th>Cliente / NF</th><th>Motorista</th></tr></thead>
                <tbody>
                  {devolucoes.map((d, i) => (
                    <tr key={`${d.filial}|${d.nf_doc}|${d.item}|${i}`}>
                      <td>{formatarDataHora(d.devolvido_em)}</td>
                      <td>{d.produto_descricao ?? d.produto ?? '—'}<div className="secundario">cód. {d.produto ?? '—'} · item {d.item}</div></td>
                      <td>{d.quantidade} de {d.quantidade_nota ?? '?'} {d.unidade ?? ''}</td>
                      <td>{valor(d.valor)}<div className="secundario">{formatarPeso(d.peso)}</div></td>
                      <td><strong>{rotuloMotivo(d.motivo)}</strong>{d.descricao && <div className="secundario">{d.descricao}</div>}</td>
                      <td>{d.cliente_nome ?? '—'}<div className="secundario">NF {d.nf_doc}-{d.nf_serie}</div></td>
                      <td>{d.motorista ? <Link to={`/motoristas/${d.motorista}`}>{d.motorista_nome ?? d.motorista}</Link> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
