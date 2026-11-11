/**
 * Produtividade do entregador (base do pagamento por produção), em três níveis:
 * - Sintético: por motorista, viagens com saída do depósito no período;
 * - Por carga: km previsto (rota ideal rateada pelos pontos de entrega), entregas no 1º, 2º e 3º+ dia da viagem, peso,
 *   itens, quantidades e tempo médio no cliente;
 * - Por entrega: horário marcado × horário efetivo (geocerca, GPS ou só a marcação) e o dia da viagem.
 * O horário efetivo normaliza quem marca a entrega depois; "sem comprovação" = sem geocerca nem GPS no cliente.
 * Cargas "em aberto" ainda podem mudar; fecham (congelam) dias depois da prestação de contas. Exportação CSV.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  OrigemProdutividade, ProdutividadeCarga, ProdutividadeCargas, ProdutividadeEntrega, ProdutividadeEntregas, ProdutividadeMotorista,
  ProdutividadeSintetico, ProdutividadeTotal,
} from '../api/tiposAnalise';
import { useAuth } from '../auth/AuthContext';
import { FiltroPeriodo, periodoPadrao } from '../componentes/FiltroPeriodo';
import { useConsulta } from '../hooks/useConsulta';
import { baixarCsv, numeroCsv } from '../util/csv';
import { formatarDataHora, formatarDuracao } from '../util/formatacao';
import { rotuloMotivo } from '../util/rotulos';

const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const km = (v: number | null) => (v === null ? '—' : `${decimal.format(v)} km`);
const kg = (v: number) => `${inteiro.format(v)} kg`;
const data = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');
const minutosCsv = (s: number | null) => numeroCsv(s === null ? null : Math.round(s / 6) / 10);

type Nivel = 'motoristas' | 'cargas' | 'entregas';
type CargaSel = Pick<ProdutividadeCarga, 'filial' | 'carga_codigo' | 'seqcar'>;

// ---------------------------------------------------------------------------------------------------------------
// Tabela ordenável genérica

/** Linhas exibidas (o CSV traz todas). */
const MAX_LINHAS = 1000;

interface Coluna<T> {
  chave: string;
  rotulo: string;
  dica?: string;
  valor: (l: T) => string | number | null;
  exibir?: (l: T) => ReactNode;
  /** Primeiro clique ordena do maior para o menor (números). */
  desc?: boolean;
}

function comparar<T>(a: T, b: T, c: Coluna<T>, desc: boolean): number {
  const va = c.valor(a);
  const vb = c.valor(b);
  if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
  const r = typeof va === 'string' ? va.localeCompare(String(vb), 'pt-BR') : va - Number(vb);
  return desc ? -r : r;
}

function TabelaOrdenavel<T>({ colunas, linhas, chave, aoClicar, rodape, inicial }: {
  colunas: Coluna<T>[];
  linhas: T[];
  chave: (l: T) => string;
  aoClicar?: (l: T) => void;
  rodape?: ReactNode;
  inicial?: { coluna: string; desc: boolean };
}) {
  const [ordem, setOrdem] = useState(inicial ?? { coluna: colunas[0].chave, desc: false });
  const coluna = colunas.find((c) => c.chave === ordem.coluna) ?? colunas[0];
  const ordenadas = useMemo(() => [...linhas].sort((a, b) => comparar(a, b, coluna, ordem.desc)), [linhas, coluna, ordem.desc]);
  return (
    <div className="tabela-rolagem">
      {ordenadas.length > MAX_LINHAS && (
        <div className="aviso">Exibindo {MAX_LINHAS} de {ordenadas.length} linhas (na ordem escolhida). Exporte o CSV para a lista completa.</div>
      )}
      <table className={`tabela tabela-numeros${aoClicar ? ' tabela-clicavel' : ''}`}>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} title={c.dica} aria-sort={ordem.coluna === c.chave ? (ordem.desc ? 'descending' : 'ascending') : undefined}>
                <button type="button" className="ordenar"
                  onClick={() => setOrdem((o) => ({ coluna: c.chave, desc: o.coluna === c.chave ? !o.desc : !!c.desc }))}>
                  {c.rotulo}{ordem.coluna === c.chave ? (ordem.desc ? ' ▼' : ' ▲') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenadas.slice(0, MAX_LINHAS).map((l) => (
            <tr key={chave(l)} onClick={aoClicar ? () => aoClicar(l) : undefined}>
              {colunas.map((c) => <td key={c.chave}>{c.exibir ? c.exibir(l) : (c.valor(l) ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
        {rodape && <tfoot>{rodape}</tfoot>}
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Colunas comuns (motorista e carga)

const diasEntregas = <T extends ProdutividadeTotal | ProdutividadeCarga>(): Coluna<T>[] => [
  { chave: 'entregas', rotulo: 'Entregas', dica: 'Clientes entregues ou com entrega parcial', valor: (l) => l.entregas, desc: true },
  { chave: 'dia1', rotulo: '1º dia', dica: 'Entregas no dia da saída do depósito', valor: (l) => l.entregas_dia1, desc: true },
  { chave: 'dia2', rotulo: '2º dia', valor: (l) => l.entregas_dia2, desc: true },
  { chave: 'dia3', rotulo: '3º+ dia', valor: (l) => l.entregas_dia3_mais, desc: true },
  { chave: 'semdia', rotulo: 'Sem dia', dica: 'Entregas de cargas sem uso do aplicativo: sem horário, fora do pagamento por dia', valor: (l) => l.entregas_sem_dia, desc: true },
  { chave: 'nao', rotulo: 'Não entregues', valor: (l) => l.nao_entregues, desc: true },
  {
    chave: 'peso', rotulo: 'Peso entregue', dica: 'Σ quantidade entregue × peso bruto (B1_PESBRU), menos devoluções',
    valor: (l) => l.peso_entregue, desc: true,
    exibir: (l) => <>{kg(l.peso_entregue)}{l.peso_incompleto && <span className="etiqueta amarela" title="Há nota sem itens ou item sem peso bruto"> !</span>}
      <div className="secundario">de {kg(l.peso)}</div></>,
  },
  { chave: 'itens', rotulo: 'Itens', dica: 'Linhas de itens das notas', valor: (l) => l.itens, desc: true, exibir: (l) => inteiro.format(l.itens) },
  {
    chave: 'qtd', rotulo: 'Quantidade', dica: 'Unidades entregues (Σ D2_QUANT − devoluções) de total',
    valor: (l) => l.quantidade_entregue, desc: true,
    exibir: (l) => <>{inteiro.format(l.quantidade_entregue)}<div className="secundario">de {inteiro.format(l.quantidade)}</div></>,
  },
  {
    chave: 'tempo', rotulo: 'Tempo médio', dica: 'Permanência média no cliente (chegada → saída, geocerca ou GPS)',
    valor: (l) => l.tempo_medio_s, exibir: (l) => formatarDuracao(l.tempo_medio_s),
  },
  {
    chave: 'comprovacao', rotulo: 'Sem comprovação', dica: 'Entregas sem geocerca nem GPS no cliente: horário só pela marcação',
    valor: (l) => l.sem_comprovacao, desc: true,
    exibir: (l) => (l.sem_comprovacao ? <span className="etiqueta amarela">{l.sem_comprovacao}</span> : '0'),
  },
  {
    chave: 'depois', rotulo: 'Marcadas depois', dica: 'Marcadas mais de 30 min após sair do cliente (horário corrigido)',
    valor: (l) => l.marcadas_depois, desc: true,
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Exportação CSV

const CAB_METRICAS = ['Pontos', 'Entregas', 'Entregas 1º dia', 'Entregas 2º dia', 'Entregas 3º+ dia', 'Entregas sem dia', 'Parciais',
  'Não entregues', 'NF', 'NF entregues', 'Itens', 'Quantidade', 'Quantidade entregue', 'Peso (kg)', 'Peso entregue (kg)',
  'Valor (R$)', 'Valor entregue (R$)', 'Tempo médio cliente (min)', 'Geocerca', 'GPS', 'Sem comprovação', 'Marcadas depois',
  'Peso incompleto'];
const metricasCsv = (l: ProdutividadeTotal | ProdutividadeCarga) => [l.pontos, l.entregas, l.entregas_dia1, l.entregas_dia2,
  l.entregas_dia3_mais, l.entregas_sem_dia, l.parciais, l.nao_entregues, l.notas, l.notas_entregues, l.itens, numeroCsv(l.quantidade),
  numeroCsv(l.quantidade_entregue), numeroCsv(l.peso), numeroCsv(l.peso_entregue), numeroCsv(l.valor),
  numeroCsv(l.valor_entregue), minutosCsv(l.tempo_medio_s), l.fonte_geocerca, l.fonte_gps, l.sem_comprovacao,
  l.marcadas_depois, l.peso_incompleto ? 'Sim' : 'Não'];

function exportarMotoristas(d: ProdutividadeSintetico): void {
  baixarCsv(`produtividade-sintetico-${d.periodo.de}-${d.periodo.ate}.csv`,
    ['Motorista', 'Nome', 'Viagens', 'Cargas', 'Cargas sem aplicativo', 'Km previsto', 'Cargas sem km', 'Cargas em aberto', ...CAB_METRICAS],
    d.motoristas.map((m) => [m.motorista, m.nome, m.viagens, m.cargas, m.cargas_sem_aplicativo, numeroCsv(m.km_previsto), m.cargas_sem_km, m.abertas,
      ...metricasCsv(m)]));
}

function exportarCargas(d: ProdutividadeCargas): void {
  baixarCsv(`produtividade-cargas-${d.periodo.de}-${d.periodo.ate}.csv`,
    ['Filial', 'Carga', 'Seq.', 'Data carga', 'Origem', 'Motorista', 'Nome', 'Caminhão', 'Placa', 'Rota', 'Saída depósito',
      'Fonte da saída', 'Retorno', 'Dias de viagem', 'Km previsto (rateado)', 'Km previsto viagem', 'Cargas na viagem',
      'Peso da carga (DAK)', 'Prestação de contas', 'Situação', ...CAB_METRICAS],
    d.cargas.map((c) => [c.filial, c.carga_codigo, c.seqcar, c.data_carga, ORIGEM[c.origem], c.motorista, c.motorista_nome, c.caminhao,
      c.caminhao_placa, c.rota_descricao, c.viagem_saida_em, FONTE_SAIDA[c.viagem_saida_fonte],
      c.viagem_retorno_em ?? '', c.dias_viagem, numeroCsv(c.km_previsto), numeroCsv(c.viagem_km_previsto), c.viagem_cargas,
      numeroCsv(c.peso_carga), c.prestacao_contas ?? '', c.fechada ? 'Fechada' : 'Em aberto', ...metricasCsv(c)]));
}

const FONTE: Record<ProdutividadeEntrega['fonte'], string> = { GEOCERCA: 'Geocerca', GPS: 'GPS', MARCACAO: 'Marcação', ERP: 'ERP (sem aplicativo)' };
const ORIGEM: Record<OrigemProdutividade, string> = { APLICATIVO: 'Aplicativo', ERP: 'Sem aplicativo (ERP)' };
const FONTE_SAIDA: Record<ProdutividadeCarga['viagem_saida_fonte'], string> = {
  DEPOSITO: 'Geocerca do depósito', PRIMEIRA_ENTREGA: 'Primeira entrega', CARGA: 'Data da carga (sem aplicativo)',
};
const RESULTADO: Record<ProdutividadeEntrega['resultado'], { rotulo: string; classe: string }> = {
  ENTREGUE: { rotulo: 'Entregue', classe: 'verde' },
  PARCIAL: { rotulo: 'Parcial', classe: 'amarela' },
  NAO_ENTREGUE: { rotulo: 'Não entregue', classe: 'vermelha' },
};

function exportarEntregas(lista: ProdutividadeEntrega[], nome: string): void {
  baixarCsv(nome,
    ['Filial', 'Carga', 'Seq.', 'Origem', 'Motorista', 'Nome', 'Cliente', 'Loja', 'Nome cliente', 'Município', 'Resultado', 'Motivo',
      'Saída da viagem', 'Marcada em', 'Efetiva em', 'Fonte', 'Sem comprovação', 'Dia da viagem', 'Chegada', 'Saída',
      'Permanência (min)', 'Atraso marcação (min)', 'NF', 'NF entregues', 'Itens', 'Quantidade', 'Quantidade entregue',
      'Peso (kg)', 'Peso entregue (kg)', 'Valor (R$)', 'Valor entregue (R$)', 'Peso incompleto'],
    lista.map((e) => [e.filial, e.carga_codigo, e.seqcar, ORIGEM[e.origem], e.motorista, e.motorista_nome, e.cliente_codigo, e.cliente_loja,
      e.cliente_nome, e.municipio, RESULTADO[e.resultado].rotulo, e.motivo ? rotuloMotivo(e.motivo) : '', e.viagem_saida_em,
      e.marcada_em ?? '', e.efetiva_em ?? '', FONTE[e.fonte], e.sem_comprovacao ? 'Sim' : 'Não', e.dia_viagem ?? '', e.chegada_em ?? '',
      e.saida_em ?? '', minutosCsv(e.permanencia_s), minutosCsv(e.atraso_marcacao_s), e.notas, e.notas_entregues, e.itens,
      numeroCsv(e.quantidade), numeroCsv(e.quantidade_entregue), numeroCsv(e.peso), numeroCsv(e.peso_entregue),
      numeroCsv(e.valor), numeroCsv(e.valor_entregue), e.peso_incompleto ? 'Sim' : 'Não']));
}

// ---------------------------------------------------------------------------------------------------------------
// Níveis

function Resumo({ t }: { t: ProdutividadeTotal }) {
  return (
    <section className="cartoes-numeros indicadores-resumo">
      <div className="numero"><span className="rotulo">Km previsto</span><strong>{km(t.km_previsto)}</strong>
        <span className="secundario">{t.viagens} viagens · {t.cargas} cargas{t.cargas_sem_km ? ` · ${t.cargas_sem_km} sem km` : ''}</span></div>
      {t.cargas_sem_aplicativo > 0 && (
        <div className="numero"><span className="rotulo">Sem aplicativo</span><strong>{t.cargas_sem_aplicativo} cargas</strong>
          <span className="secundario">{t.entregas_sem_dia} entregas sem dia · resultado pelas devoluções do ERP</span></div>
      )}
      <div className="numero"><span className="rotulo">Entregas</span><strong>{inteiro.format(t.entregas)}</strong>
        <span className="secundario">de {inteiro.format(t.pontos)} pontos · {t.nao_entregues} não entregues</span></div>
      <div className="numero"><span className="rotulo">1º dia / 2º dia / 3º+</span>
        <strong>{t.entregas_dia1} / {t.entregas_dia2} / {t.entregas_dia3_mais}</strong>
        <span className="secundario">dia 1 = saída do depósito</span></div>
      <div className="numero"><span className="rotulo">Peso entregue</span><strong>{kg(t.peso_entregue)}</strong>
        <span className="secundario">{inteiro.format(t.itens)} itens · {inteiro.format(t.quantidade_entregue)} un.</span></div>
      <div className="numero"><span className="rotulo">Tempo médio no cliente</span><strong>{formatarDuracao(t.tempo_medio_s)}</strong>
        <span className="secundario">{t.fonte_geocerca} geocerca · {t.fonte_gps} GPS</span></div>
      <div className="numero"><span className="rotulo">Sem comprovação</span><strong>{t.sem_comprovacao}</strong>
        <span className="secundario">{t.marcadas_depois} marcadas depois (corrigidas)</span></div>
    </section>
  );
}

function NivelMotoristas({ caminho, aoSelecionar }: { caminho: string; aoSelecionar: (m: ProdutividadeMotorista) => void }) {
  const { dados, erro, carregando } = useConsulta<ProdutividadeSintetico>(caminho, 600000);
  const colunas: Coluna<ProdutividadeMotorista>[] = [
    { chave: 'nome', rotulo: 'Motorista', valor: (m) => m.nome ?? m.motorista,
      exibir: (m) => <>{m.nome ?? '—'}<div className="secundario">{m.motorista}</div></> },
    { chave: 'viagens', rotulo: 'Viagens', valor: (m) => m.viagens, desc: true,
      exibir: (m) => <>{m.viagens}<div className="secundario">{m.cargas} cargas{m.cargas_sem_aplicativo ? ` · ${m.cargas_sem_aplicativo} sem app` : ''}</div></> },
    { chave: 'km', rotulo: 'Km previsto', dica: 'Rota ideal (depósito → clientes → depósito), rateada por carga', valor: (m) => m.km_previsto, desc: true,
      exibir: (m) => <>{km(m.km_previsto)}{m.cargas_sem_km > 0 && <div className="secundario">{m.cargas_sem_km} carga(s) sem km</div>}</> },
    { chave: 'pontos', rotulo: 'Pontos', dica: 'Clientes previstos nas cargas', valor: (m) => m.pontos, desc: true },
    ...diasEntregas<ProdutividadeMotorista>(),
  ];
  return (
    <>
      {erro && <div className="aviso erro">{erro}</div>}
      {carregando && !dados && <div className="aviso">Carregando…</div>}
      {dados && <Resumo t={dados.total} />}
      {dados && dados.motoristas.length === 0 && <div className="aviso">Nenhuma viagem com saída no período.</div>}
      {dados && dados.motoristas.length > 0 && (
        <>
          <div className="acoes-tabela">
            <span className="secundario">Clique no motorista para ver as cargas.</span>
            <button type="button" className="botao secundario-botao" onClick={() => exportarMotoristas(dados)}>Exportar CSV</button>
          </div>
          <TabelaOrdenavel colunas={colunas} linhas={dados.motoristas} chave={(m) => m.motorista} aoClicar={aoSelecionar} />
        </>
      )}
    </>
  );
}

function NivelCargas({ caminho, aoSelecionar }: { caminho: string; aoSelecionar: (c: ProdutividadeCarga) => void }) {
  const { dados, erro, carregando } = useConsulta<ProdutividadeCargas>(caminho, 600000);
  const colunas: Coluna<ProdutividadeCarga>[] = [
    { chave: 'carga', rotulo: 'Carga', valor: (c) => `${c.viagem_saida_em}|${c.carga_codigo}`,
      exibir: (c) => <><strong>{c.carga_codigo}/{c.seqcar}</strong> <span className="secundario">fil. {c.filial}</span>
        <div className="secundario">{data(c.data_carga)}{c.rota_descricao ? ` · ${c.rota_descricao}` : ''}</div>
        {c.origem === 'ERP' && <span className="etiqueta amarela" title="Carga sem uso do aplicativo: dados do ERP, resultado pelas devoluções, sem dia da viagem">sem aplicativo</span>}{' '}
        {!c.fechada && <span className="etiqueta cinza" title="Ainda pode mudar até alguns dias após a prestação de contas">em aberto</span>}</> },
    { chave: 'motorista', rotulo: 'Motorista', valor: (c) => c.motorista_nome ?? c.motorista,
      exibir: (c) => <>{c.motorista_nome ?? c.motorista}<div className="secundario">{c.caminhao_placa ?? c.caminhao ?? ''}</div></> },
    { chave: 'saida', rotulo: 'Saída / retorno', dica: 'Saída do depósito (dia 1 da viagem) e retorno', valor: (c) => c.viagem_saida_em,
      exibir: (c) => <>{formatarDataHora(c.viagem_saida_em)}
        {c.viagem_saida_fonte === 'PRIMEIRA_ENTREGA' && <span className="etiqueta amarela" title="Sem registro de saída do depósito: considerada a primeira entrega"> 1ª entrega</span>}
        {c.viagem_saida_fonte === 'CARGA' && <span className="etiqueta cinza" title="Carga sem aplicativo: considerada a data da carga"> data da carga</span>}
        <div className="secundario">{c.viagem_retorno_em ? `retorno ${formatarDataHora(c.viagem_retorno_em)}` : 'sem retorno'}
          {c.dias_viagem ? ` · ${c.dias_viagem} dia(s)` : ''}</div></> },
    { chave: 'km', rotulo: 'Km previsto', dica: 'Km da viagem rateado pelos pontos de entrega de cada carga', valor: (c) => c.km_previsto, desc: true,
      exibir: (c) => <>{c.km_pendente ? <span className="etiqueta amarela" title={c.rota_erro ?? 'Rota prevista ainda não calculada'}>pendente</span> : km(c.km_previsto)}
        {c.viagem_cargas > 1 && <div className="secundario">viagem: {km(c.viagem_km_previsto)} · {c.viagem_cargas} cargas</div>}
        {!!c.clientes_sem_coordenada && <div className="secundario">{c.clientes_sem_coordenada} cliente(s) sem coordenada</div>}</> },
    { chave: 'pontos', rotulo: 'Pontos', valor: (c) => c.pontos, desc: true },
    ...diasEntregas<ProdutividadeCarga>(),
  ];
  return (
    <>
      {erro && <div className="aviso erro">{erro}</div>}
      {carregando && !dados && <div className="aviso">Carregando…</div>}
      {dados && dados.cargas.length === 0 && <div className="aviso">Nenhuma carga com saída no período.</div>}
      {dados && dados.cargas.length > 0 && (
        <>
          <div className="acoes-tabela">
            <span className="secundario">{dados.cargas.length} cargas. Clique na carga para ver as entregas.</span>
            <button type="button" className="botao secundario-botao" onClick={() => exportarCargas(dados)}>Exportar CSV</button>
          </div>
          <TabelaOrdenavel colunas={colunas} linhas={dados.cargas} chave={(c) => `${c.filial}|${c.carga_codigo}|${c.seqcar}`}
            aoClicar={aoSelecionar} inicial={{ coluna: 'saida', desc: false }} />
        </>
      )}
    </>
  );
}

function NivelEntregas({ caminho, titulo }: { caminho: string; titulo: string }) {
  const { dados, erro, carregando } = useConsulta<ProdutividadeEntregas>(caminho, 600000);
  const colunas: Coluna<ProdutividadeEntrega>[] = [
    { chave: 'cliente', rotulo: 'Cliente', valor: (e) => e.cliente_nome ?? e.cliente_codigo,
      exibir: (e) => <>{e.cliente_nome ?? '—'}<div className="secundario">{e.cliente_codigo}/{e.cliente_loja}
        {e.municipio ? ` · ${e.municipio}` : ''} · carga {e.carga_codigo}/{e.seqcar}</div></> },
    { chave: 'resultado', rotulo: 'Resultado', valor: (e) => e.resultado,
      exibir: (e) => <><span className={`etiqueta ${RESULTADO[e.resultado].classe}`}>{RESULTADO[e.resultado].rotulo}</span>
        {e.motivo && <div className="secundario">{rotuloMotivo(e.motivo)}</div>}</> },
    { chave: 'dia', rotulo: 'Dia', dica: 'Dia da viagem pelo horário efetivo (1 = dia da saída do depósito); sem dia = carga sem aplicativo', valor: (e) => e.dia_viagem,
      exibir: (e) => (e.dia_viagem === null ? <span className="etiqueta cinza">sem dia</span> : `${e.dia_viagem}º`) },
    { chave: 'efetiva', rotulo: 'Horário efetivo', dica: 'Chegada ao cliente pela geocerca ou GPS; sem evidência, a marcação', valor: (e) => e.efetiva_em,
      exibir: (e) => (e.fonte === 'ERP' ? <span className="etiqueta cinza" title="Carga sem uso do aplicativo">sem aplicativo</span> : <>{formatarDataHora(e.efetiva_em)}{' '}
        <span className={`etiqueta ${e.sem_comprovacao ? 'amarela' : 'cinza'}`}>{e.sem_comprovacao ? 'sem comprovação' : FONTE[e.fonte]}</span></>) },
    { chave: 'marcada', rotulo: 'Marcada em', valor: (e) => e.marcada_em,
      exibir: (e) => <>{formatarDataHora(e.marcada_em)}
        {e.marcada_depois && <div className="secundario">marcada {formatarDuracao(e.atraso_marcacao_s)} depois</div>}</> },
    { chave: 'permanencia', rotulo: 'Permanência', valor: (e) => e.permanencia_s, exibir: (e) => formatarDuracao(e.permanencia_s) },
    { chave: 'notas', rotulo: 'NF', valor: (e) => e.notas, desc: true,
      exibir: (e) => (e.notas_entregues === e.notas ? e.notas : `${e.notas_entregues} de ${e.notas}`) },
    { chave: 'itens', rotulo: 'Itens', valor: (e) => e.itens, desc: true },
    { chave: 'qtd', rotulo: 'Quantidade', valor: (e) => e.quantidade_entregue, desc: true,
      exibir: (e) => <>{inteiro.format(e.quantidade_entregue)}{e.quantidade_entregue !== e.quantidade && <div className="secundario">de {inteiro.format(e.quantidade)}</div>}</> },
    { chave: 'peso', rotulo: 'Peso entregue', valor: (e) => e.peso_entregue, desc: true,
      exibir: (e) => <>{kg(e.peso_entregue)}{e.peso_incompleto && <span className="etiqueta amarela" title="Nota sem itens ou item sem peso bruto"> !</span>}</> },
    { chave: 'valor', rotulo: 'Valor entregue', valor: (e) => e.valor_entregue, desc: true, exibir: (e) => moeda.format(e.valor_entregue) },
  ];
  return (
    <>
      {erro && <div className="aviso erro">{erro}</div>}
      {carregando && !dados && <div className="aviso">Carregando…</div>}
      {dados && dados.entregas.length === 0 && <div className="aviso">Nenhuma entrega.</div>}
      {dados && dados.entregas.length > 0 && (
        <>
          <div className="acoes-tabela">
            <span className="secundario">{titulo} · {dados.entregas.length} clientes concluídos</span>
            <button type="button" className="botao secundario-botao"
              onClick={() => exportarEntregas(dados.entregas, `produtividade-entregas-${dados.periodo.de}-${dados.periodo.ate}.csv`)}>
              Exportar CSV
            </button>
          </div>
          <TabelaOrdenavel colunas={colunas} linhas={dados.entregas}
            chave={(e) => `${e.filial}|${e.carga_codigo}|${e.seqcar}|${e.cliente_codigo}|${e.cliente_loja}`}
            inicial={{ coluna: 'efetiva', desc: false }} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export function ProdutividadePagina() {
  const { escopo } = useAuth();
  const [periodo, setPeriodo] = useState(periodoPadrao);
  const [motorista, setMotorista] = useState<{ codigo: string; nome: string } | null>(null);
  const [carga, setCarga] = useState<CargaSel | null>(null);
  const [nivel, setNivel] = useState<Nivel>('motoristas');
  // Ao mudar o período, a carga selecionada pode não estar mais nele.
  useEffect(() => setCarga(null), [periodo.de, periodo.ate]);

  const base = `de=${periodo.de}&ate=${periodo.ate}${motorista ? `&motorista=${motorista.codigo}` : ''}&${escopo}`;
  const caminhoEntregas = carga
    ? `/gestao/produtividade/entregas?${base}&filial=${encodeURIComponent(carga.filial)}&carga=${encodeURIComponent(carga.carga_codigo)}&seqcar=${encodeURIComponent(carga.seqcar)}`
    : `/gestao/produtividade/entregas?${base}`;

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>Produtividade do entregador</h1>
      </div>
      <p className="secundario">
        Viagens com saída do depósito no período. <strong>Dia 1</strong> = dia da saída do depósito. O <strong>horário
        efetivo</strong> da entrega vem da geocerca ou do GPS no cliente (corrige quem marca depois); sem nenhuma evidência,
        vale a marcação, sinalizada como <em>sem comprovação</em>. <strong>Km previsto</strong> = rota ideal depósito →
        clientes → depósito, calculada uma vez por viagem e rateada pelos pontos de entrega de cada carga.
      </p>

      <div className="filtros">
        <FiltroPeriodo valor={periodo} aoMudar={setPeriodo} />
        {motorista && (
          <span className="chip-filtro">
            Motorista: <strong>{motorista.nome}</strong>
            <button type="button" className="botao-link" onClick={() => { setMotorista(null); setCarga(null); }} aria-label="Remover filtro de motorista">×</button>
          </span>
        )}
      </div>

      <div className="abas" role="tablist">
        <button type="button" role="tab" aria-selected={nivel === 'motoristas'} className={nivel === 'motoristas' ? 'ativo' : ''}
          onClick={() => setNivel('motoristas')}>Sintético (por motorista)</button>
        <button type="button" role="tab" aria-selected={nivel === 'cargas'} className={nivel === 'cargas' ? 'ativo' : ''}
          onClick={() => { setCarga(null); setNivel('cargas'); }}>Por carga</button>
        <button type="button" role="tab" aria-selected={nivel === 'entregas'} className={nivel === 'entregas' ? 'ativo' : ''}
          onClick={() => setNivel('entregas')}>Por entrega</button>
      </div>

      {nivel === 'motoristas' && (
        <NivelMotoristas caminho={`/gestao/produtividade?${base}`}
          aoSelecionar={(m) => { setMotorista({ codigo: m.motorista, nome: m.nome ?? m.motorista }); setNivel('cargas'); }} />
      )}
      {nivel === 'cargas' && (
        <NivelCargas caminho={`/gestao/produtividade/cargas?${base}`}
          aoSelecionar={(c) => { setCarga(c); setNivel('entregas'); }} />
      )}
      {nivel === 'entregas' && (
        <>
          {carga && (
            <div className="acoes-tabela">
              <span>Carga <strong>{carga.carga_codigo}/{carga.seqcar}</strong> (filial {carga.filial})</span>
              <button type="button" className="botao-link" onClick={() => setCarga(null)}>Ver todas as entregas do período</button>
            </div>
          )}
          <NivelEntregas caminho={caminhoEntregas}
            titulo={carga ? `Carga ${carga.carga_codigo}/${carga.seqcar}` : 'Todas as entregas do período'} />
        </>
      )}
    </main>
  );
}
