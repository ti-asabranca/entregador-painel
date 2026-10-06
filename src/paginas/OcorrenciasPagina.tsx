/**
 * Funcionalidade 3: notas não entregues e itens devolvidos das cargas em aberto (o motorista ainda não voltou),
 * com o motivo, para a gerência agir antes da prestação de contas. Filtros e exportação para CSV.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { chaveOcorrencia, useAlertas } from '../alertas/AlertasOcorrencias';
import type { Ocorrencia, TipoOcorrencia } from '../api/tipos';
import { formatarDataHora, formatarHora } from '../util/formatacao';
import { TIPO_OCORRENCIA, rotuloMotivo } from '../util/rotulos';

/** Célula CSV segura: aspas escapadas e neutralização de fórmulas (=, +, -, @) ao abrir no Excel. */
function celula(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function exportarCsv(lista: Ocorrencia[]): void {
  const cabecalho = ['Tipo', 'Data/hora', 'Motorista', 'Carga', 'Cliente', 'Município', 'NF', 'Pedido', 'Produto',
    'Qtd. devolvida', 'Qtd. nota', 'Motivo', 'Descrição'];
  const linhas = lista.map((o) => [
    TIPO_OCORRENCIA[o.tipo], formatarDataHora(o.ocorrido_em), `${o.motorista ?? ''} ${o.motorista_nome ?? ''}`.trim(),
    `${o.carga_codigo}/${o.seqcar}`, `${o.cliente_codigo}/${o.cliente_loja} ${o.cliente_nome ?? ''}`.trim(), o.municipio,
    `${o.nf_doc}-${o.nf_serie}`, o.pedido, o.produto ? `${o.produto} ${o.produto_descricao ?? ''}`.trim() : '',
    o.quantidade, o.quantidade_nota, rotuloMotivo(o.motivo), o.descricao,
  ].map(celula).join(';'));
  const blob = new Blob([`﻿${[cabecalho.map(celula).join(';'), ...linhas].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ocorrencias-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function OcorrenciasPagina() {
  // Mesma consulta do alerta de novas ocorrências (sem requisição duplicada).
  const { dados, erro, carregando, novas, marcarVistas } = useAlertas();
  // As novas ficam destacadas enquanto a tela está aberta; ao sair, contam como vistas.
  useEffect(() => marcarVistas, [marcarVistas]);
  const [tipo, setTipo] = useState<TipoOcorrencia | ''>('');
  const [motivo, setMotivo] = useState('');
  const [motorista, setMotorista] = useState('');
  const [busca, setBusca] = useState('');

  const todas = useMemo(() => dados?.ocorrencias ?? [], [dados]);
  const motivos = useMemo(() => [...new Set(todas.map((o) => o.motivo).filter(Boolean))] as string[], [todas]);
  const motoristas = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of todas) if (o.motorista) m.set(o.motorista, o.motorista_nome ?? o.motorista);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [todas]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return todas.filter((o) => (!tipo || o.tipo === tipo) && (!motivo || o.motivo === motivo)
      && (!motorista || o.motorista === motorista)
      && (!termo || [o.cliente_nome, o.cliente_codigo, o.nf_doc, o.pedido, o.produto, o.produto_descricao, o.carga_codigo]
        .some((v) => v?.toLowerCase().includes(termo))));
  }, [todas, tipo, motivo, motorista, busca]);

  const notas = lista.filter((o) => o.tipo === 'NOTA_NAO_ENTREGUE').length;

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>Ocorrências das entregas em andamento</h1>
        <div className="resumo">
          <span><strong>{notas}</strong> notas não entregues</span>
          <span><strong>{lista.length - notas}</strong> itens devolvidos</span>
          {dados && <span className="secundario">Atualizado às {formatarHora(dados.atualizado_em)}{carregando ? '…' : ''}</span>}
          <button type="button" className="botao secundario-botao" onClick={() => exportarCsv(lista)} disabled={!lista.length}>
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="filtros">
        <input type="search" placeholder="Cliente, NF, pedido, produto ou carga" value={busca}
          onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoOcorrencia | '')} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_OCORRENCIA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo">
          <option value="">Todos os motivos</option>
          {motivos.map((m) => <option key={m} value={m}>{rotuloMotivo(m)}</option>)}
        </select>
        <select value={motorista} onChange={(e) => setMotorista(e.target.value)} aria-label="Motorista">
          <option value="">Todos os motoristas</option>
          {motoristas.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}
      {dados && lista.length === 0 && <div className="aviso">Nenhuma ocorrência nas cargas em andamento.</div>}

      {lista.length > 0 && (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Quando</th><th>Tipo</th><th>Motivo</th><th>Cliente</th><th>NF / Pedido</th>
                <th>Item</th><th>Motorista / Carga</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((o, i) => (
                <tr key={`${chaveOcorrencia(o)}|${i}`} className={novas.has(chaveOcorrencia(o)) ? 'linha-nova' : undefined}>
                  <td>
                    {formatarDataHora(o.ocorrido_em)}
                    {novas.has(chaveOcorrencia(o)) && <div><span className="etiqueta nova">Nova</span></div>}
                  </td>
                  <td>
                    <span className={`etiqueta ${o.tipo === 'NOTA_NAO_ENTREGUE' ? 'vermelha' : 'amarela'}`}>
                      {TIPO_OCORRENCIA[o.tipo]}
                    </span>
                    {o.resultado === 'PARCIAL' && <div className="secundario">cliente com entrega parcial</div>}
                  </td>
                  <td>
                    <strong>{rotuloMotivo(o.motivo)}</strong>
                    {o.descricao && <div className="secundario">{o.descricao}</div>}
                  </td>
                  <td>
                    {o.cliente_nome ?? '—'}
                    <div className="secundario">{o.cliente_codigo}/{o.cliente_loja}{o.municipio ? ` · ${o.municipio}` : ''}</div>
                  </td>
                  <td>{o.nf_doc}-{o.nf_serie}<div className="secundario">Pedido {o.pedido ?? '—'}</div></td>
                  <td>
                    {o.item ? (
                      <>
                        {o.produto_descricao ?? o.produto}
                        <div className="secundario">
                          {o.quantidade} de {o.quantidade_nota ?? '?'} {o.unidade ?? ''} · cód. {o.produto}
                        </div>
                      </>
                    ) : <span className="secundario">Nota inteira</span>}
                  </td>
                  <td>
                    {o.motorista ? <Link to={`/motoristas/${o.motorista}`}>{o.motorista_nome ?? o.motorista}</Link> : '—'}
                    <div className="secundario">Carga {o.carga_codigo}/{o.seqcar}{o.caminhao ? ` · ${o.caminhao}` : ''}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
