/**
 * Coordenadas de todos os clientes: a vigente (corrigida pela gerência ou, sem ela, A1_IONLAT/A1_IONLONG do ERP), a
 * sugerida (mediana das posições de conclusão das entregas) e a situação (sem coordenada, suspeita ou OK).
 * A gerência pode aceitar a sugerida, digitar/colar a coordenada, marcar no mapa ou buscar pelo endereço. A correção
 * fica no banco do entregador e tem prioridade sobre a do ERP no aplicativo, nas rotas e no painel; "Voltar ao ERP"
 * remove a correção. O cadastro do ERP não é alterado (CSV disponível para quem quiser corrigir também lá).
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Marker as MarcadorLeaflet } from 'leaflet';
import { Marker, Polyline, Tooltip, useMapEvents } from 'react-leaflet';
import { ErroApi, requisitar } from '../api/cliente';
import type { ClienteCoordenada, Coordenadas, EnderecoEncontrado, OrigemCoordenada } from '../api/tiposAnalise';
import { useAuth } from '../auth/AuthContext';
import { MapaBase } from '../componentes/MapaBase';
import { iconePonto } from '../componentes/marcadores';
import { useConsulta } from '../hooks/useConsulta';
import { baixarCsv, numeroCsv } from '../util/csv';
import { formatarDataHora, formatarDistancia, lerCoordenada } from '../util/formatacao';

/** Linhas exibidas na tabela (a busca e os filtros reduzem a lista). */
const MAX_LINHAS = 500;

const COR = { erp: '#c62828', corrigida: '#1565c0', sugerida: '#2e7d32', nova: '#f9a825' };
const ICONE = { erp: iconePonto(COR.erp), corrigida: iconePonto(COR.corrigida), sugerida: iconePonto(COR.sugerida), nova: iconePonto(COR.nova) };

const SITUACAO: Record<ClienteCoordenada['situacao'], { rotulo: string; classe: string }> = {
  SEM_COORDENADA: { rotulo: 'Sem coordenada', classe: 'vermelha' },
  SUSPEITA: { rotulo: 'Suspeita', classe: 'amarela' },
  OK: { rotulo: 'OK', classe: 'verde' },
};
const ORIGEM: Record<OrigemCoordenada, string> = { SUGERIDA: 'sugerida aceita', MANUAL: 'digitada/mapa', ENDERECO: 'busca por endereço' };

type Ponto = [number, number];
const chave = (c: ClienteCoordenada) => `${c.codigo}|${c.loja}`;
const par = (lat: number | null, lon: number | null): Ponto | null => (lat === null || lon === null ? null : [lat, lon]);
const coord = (p: Ponto | null) => (p ? `${p[0].toFixed(6)}, ${p[1].toFixed(6)}` : '—');
const linkMapa = ([lat, lon]: Ponto) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
const temSugestao = (c: ClienteCoordenada) => c.latitude_sugerida !== null && c.longitude_sugerida !== null;
/** Sugerida diferente da vigente (aceitar faz sentido). */
const sugestaoNova = (c: ClienteCoordenada) => temSugestao(c)
  && (c.fonte !== 'ENTREGADOR' || c.latitude !== c.latitude_sugerida || c.longitude !== c.longitude_sugerida);

type Coluna = 'cliente' | 'situacao' | 'vigente' | 'sugerida' | 'distancia' | 'amostras';
const COLUNAS: [Coluna, string][] = [
  ['cliente', 'Cliente'], ['situacao', 'Situação'], ['vigente', 'Vigente'], ['sugerida', 'Sugerida'],
  ['distancia', 'Distância'], ['amostras', 'Amostras'],
];
const ORDEM_SITUACAO = { SEM_COORDENADA: 0, SUSPEITA: 1, OK: 2 };
const ORDEM_FONTE = { ENTREGADOR: 0, ERP: 1 };

/** Valor de ordenação da coluna; null fica sempre no fim (nos dois sentidos). */
function valorOrdem(c: ClienteCoordenada, coluna: Coluna): string | number | null {
  switch (coluna) {
    case 'cliente': return (c.nome ?? c.razao_social ?? c.codigo).toLowerCase();
    case 'situacao': return ORDEM_SITUACAO[c.situacao];
    // Corrigidas primeiro, depois ERP; dentro da fonte, pela latitude.
    case 'vigente': return c.fonte === null || c.latitude === null ? null : ORDEM_FONTE[c.fonte] * 1000 + c.latitude;
    case 'sugerida': return c.latitude_sugerida;
    case 'distancia': return c.distancia_m;
    case 'amostras': return c.amostras;
  }
}

function comparar(a: ClienteCoordenada, b: ClienteCoordenada, coluna: Coluna, desc: boolean): number {
  const va = valorOrdem(a, coluna);
  const vb = valorOrdem(b, coluna);
  if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
  const r = typeof va === 'string' ? va.localeCompare(vb as string, 'pt-BR') : va - (vb as number);
  return desc ? -r : r;
}

function exportar(lista: ClienteCoordenada[]): void {
  baixarCsv(`coordenadas-clientes-${new Date().toISOString().slice(0, 10)}.csv`,
    ['A1_COD', 'A1_LOJA', 'Nome', 'Endereço', 'Situação', 'Fonte', 'Lat. vigente', 'Lon. vigente', 'Lat. ERP', 'Lon. ERP',
      'Lat. sugerida', 'Lon. sugerida', 'Distância (m)', 'Amostras', 'Corrigida por', 'Corrigida em'],
    lista.map((c) => [c.codigo, c.loja, c.nome ?? c.razao_social, c.endereco, SITUACAO[c.situacao].rotulo,
      c.fonte === 'ENTREGADOR' ? 'Corrigida' : c.fonte ?? '', numeroCsv(c.latitude), numeroCsv(c.longitude),
      numeroCsv(c.latitude_erp), numeroCsv(c.longitude_erp), numeroCsv(c.latitude_sugerida), numeroCsv(c.longitude_sugerida),
      numeroCsv(c.distancia_m), c.amostras, c.corrigida_por ?? '', c.corrigida_em ?? '']));
}

/** Clique no mapa marca a nova coordenada. */
function MarcarNoMapa({ aoMarcar }: { aoMarcar: (p: Ponto) => void }) {
  useMapEvents({ click: (e) => aoMarcar([Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6]) });
  return null;
}

/** Painel lateral: mapa comparativo e edição da coordenada de entrega do cliente. */
function EditorCoordenada({ cliente, aoFechar, aoAlterar }: {
  cliente: ClienteCoordenada;
  aoFechar: () => void;
  aoAlterar: () => void;
}) {
  const { token, escopo } = useAuth();
  const [nova, setNova] = useState<Ponto | null>(null);
  const [origem, setOrigem] = useState<OrigemCoordenada>('MANUAL');
  const [texto, setTexto] = useState('');
  const [endereco, setEndereco] = useState('');
  const [resultados, setResultados] = useState<EnderecoEncontrado[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ erro: boolean; texto: string } | null>(null);
  // Reenquadra o mapa só ao trocar de cliente ou escolher um endereço (não a cada clique/arraste).
  const [enquadramento, setEnquadramento] = useState(0);

  // Ao trocar de cliente, limpa a edição e propõe o endereço do cadastro para a busca.
  useEffect(() => {
    setNova(null);
    setTexto('');
    setResultados(null);
    setMensagem(null);
    setEndereco([cliente.endereco, cliente.uf].filter(Boolean).join(' - '));
  }, [cliente.codigo, cliente.loja, cliente.endereco, cliente.uf]);

  const erp = par(cliente.latitude_erp, cliente.longitude_erp);
  const corrigida = cliente.fonte === 'ENTREGADOR' ? par(cliente.latitude, cliente.longitude) : null;
  const sugerida = par(cliente.latitude_sugerida, cliente.longitude_sugerida);
  const pontos = [erp, corrigida, sugerida, nova].filter((p): p is Ponto => p !== null);

  function marcar(p: Ponto, o: OrigemCoordenada) {
    setNova(p);
    setOrigem(o);
    setTexto(`${p[0]}, ${p[1]}`);
    setMensagem(null);
    if (o === 'ENDERECO') setEnquadramento((n) => n + 1);
  }

  async function salvar(p: Ponto, o: OrigemCoordenada) {
    setOcupado(true);
    setMensagem(null);
    try {
      await requisitar(`/gestao/coordenadas/${encodeURIComponent(cliente.codigo)}/${encodeURIComponent(cliente.loja)}?${escopo}`, {
        metodo: 'PUT', token, corpo: { latitude: p[0], longitude: p[1], origem: o },
      });
      setNova(null);
      setMensagem({ erro: false, texto: 'Coordenada salva. Passa a valer no aplicativo e nas próximas rotas.' });
      aoAlterar();
    } catch (err) {
      setMensagem({ erro: true, texto: err instanceof ErroApi ? err.message : 'Não foi possível salvar a coordenada.' });
    } finally {
      setOcupado(false);
    }
  }

  async function voltarAoErp() {
    if (!window.confirm('Remover a coordenada corrigida? O cliente volta a usar A1_IONLAT/A1_IONLONG do ERP.')) return;
    setOcupado(true);
    setMensagem(null);
    try {
      await requisitar(`/gestao/coordenadas/${encodeURIComponent(cliente.codigo)}/${encodeURIComponent(cliente.loja)}?${escopo}`, {
        metodo: 'DELETE', token,
      });
      setMensagem({ erro: false, texto: 'Correção removida: vale a coordenada do ERP.' });
      aoAlterar();
    } catch (err) {
      setMensagem({ erro: true, texto: err instanceof ErroApi ? err.message : 'Não foi possível remover a correção.' });
    } finally {
      setOcupado(false);
    }
  }

  async function buscarEndereco(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setMensagem(null);
    try {
      const r = await requisitar<{ resultados: EnderecoEncontrado[] }>(
        `/gestao/geocodificar?q=${encodeURIComponent(endereco)}&${escopo}`, { token },
      );
      setResultados(r.resultados);
      if (r.resultados.length === 1) marcar([r.resultados[0].latitude, r.resultados[0].longitude], 'ENDERECO');
    } catch (err) {
      setResultados(null);
      setMensagem({ erro: true, texto: err instanceof ErroApi ? err.message : 'Não foi possível buscar o endereço.' });
    } finally {
      setOcupado(false);
    }
  }

  function aplicarTexto(valor: string) {
    setTexto(valor);
    const p = lerCoordenada(valor);
    setNova(p);
    setOrigem('MANUAL');
  }

  return (
    <aside className="coordenadas-mapa" aria-label="Coordenada do cliente selecionado">
      <button type="button" className="fechar" onClick={aoFechar} aria-label="Fechar">×</button>
      <strong>{cliente.nome ?? cliente.razao_social ?? cliente.codigo}</strong>
      <div className="secundario">{cliente.codigo}/{cliente.loja}{cliente.endereco ? ` · ${cliente.endereco}` : ''}</div>

      <MapaBase pontos={pontos} chaveEnquadramento={`${chave(cliente)}|${enquadramento}`} className="mapa-detalhe">
        <MarcarNoMapa aoMarcar={(p) => marcar(p, 'MANUAL')} />
        {erp && <Marker position={erp} icon={ICONE.erp}><Tooltip direction="top">ERP (A1_IONLAT/A1_IONLONG)</Tooltip></Marker>}
        {corrigida && <Marker position={corrigida} icon={ICONE.corrigida}><Tooltip direction="top">Corrigida (vigente)</Tooltip></Marker>}
        {sugerida && (
          <Marker position={sugerida} icon={ICONE.sugerida}>
            <Tooltip direction="top">Sugerida ({cliente.amostras} entregas)</Tooltip>
          </Marker>
        )}
        {nova && (
          <Marker position={nova} icon={ICONE.nova} draggable eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = (e.target as MarcadorLeaflet).getLatLng();
              marcar([Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6], 'MANUAL');
            },
          }}>
            <Tooltip permanent direction="top">Nova</Tooltip>
          </Marker>
        )}
        {(corrigida ?? erp) && sugerida && (
          <Polyline positions={[(corrigida ?? erp) as Ponto, sugerida]} pathOptions={{ color: '#616161', dashArray: '4 6', weight: 2 }} />
        )}
      </MapaBase>
      <div className="legenda-coordenadas secundario">
        <span><i style={{ background: COR.erp }} /> ERP</span>
        <span><i style={{ background: COR.corrigida }} /> Corrigida</span>
        <span><i style={{ background: COR.sugerida }} /> Sugerida</span>
        <span><i style={{ background: COR.nova }} /> Nova (clique no mapa ou arraste)</span>
      </div>

      <dl className="coordenadas-detalhe">
        <dt>Vigente</dt>
        <dd>
          {coord(par(cliente.latitude, cliente.longitude))}{' '}
          {cliente.fonte === 'ENTREGADOR' && <span className="etiqueta cinza">corrigida</span>}
          {cliente.fonte === 'ERP' && <span className="etiqueta cinza">ERP</span>}
        </dd>
        {corrigida && (
          <>
            <dt>Corrigida por</dt>
            <dd>{cliente.corrigida_por} em {formatarDataHora(cliente.corrigida_em)}
              {cliente.corrigida_origem ? ` (${ORIGEM[cliente.corrigida_origem]})` : ''}</dd>
          </>
        )}
        <dt>ERP</dt><dd>{coord(erp)}</dd>
        <dt>Sugerida</dt>
        <dd>
          {coord(sugerida)}{sugerida && ` · ${cliente.amostras} entregas · ${formatarDistancia(cliente.distancia_m)} da vigente`}
          {sugerida && <> · <a href={linkMapa(sugerida)} target="_blank" rel="noreferrer noopener">Abrir no mapa</a></>}
        </dd>
      </dl>

      <div className="acoes-botoes">
        {sugestaoNova(cliente) && sugerida && (
          <button type="button" className="botao" disabled={ocupado} onClick={() => void salvar(sugerida, 'SUGERIDA')}>
            Aceitar sugerida
          </button>
        )}
        {cliente.fonte === 'ENTREGADOR' && (
          <button type="button" className="botao secundario-botao" disabled={ocupado} onClick={() => void voltarAoErp()}>
            Voltar ao ERP
          </button>
        )}
      </div>

      <form className="coordenadas-form" onSubmit={(e) => void buscarEndereco(e)}>
        <label htmlFor="busca-endereco">Buscar pelo endereço</label>
        <div className="linha-campo">
          <input id="busca-endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)}
            placeholder="Rua, número, bairro, cidade - UF" maxLength={200} />
          <button type="submit" className="botao secundario-botao" disabled={ocupado || endereco.trim().length < 3}>Buscar</button>
        </div>
      </form>
      {resultados && resultados.length === 0 && <div className="aviso">Endereço não encontrado. Tente com menos detalhes (rua, cidade - UF).</div>}
      {resultados && resultados.length > 0 && (
        <ul className="resultados-endereco">
          {resultados.map((r) => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button type="button" className="botao-link" onClick={() => marcar([r.latitude, r.longitude], 'ENDERECO')}>
                {r.descricao}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="coordenadas-form">
        <label htmlFor="nova-coordenada">Digitar a coordenada (latitude, longitude)</label>
        <div className="linha-campo">
          <input id="nova-coordenada" value={texto} onChange={(e) => aplicarTexto(e.target.value)}
            placeholder="-10.947200, -37.073100" inputMode="decimal" />
          <button type="button" className="botao" disabled={ocupado || !nova} onClick={() => nova && void salvar(nova, origem)}>
            Salvar
          </button>
        </div>
        {texto && !nova && <span className="erro-campo">Coordenada inválida. Use "latitude, longitude" (ex.: -10.9472, -37.0731).</span>}
      </div>

      {mensagem && <div className={mensagem.erro ? 'aviso erro' : 'aviso'}>{mensagem.texto}</div>}
      <p className="secundario">
        Endereços: © colaboradores do OpenStreetMap. Confira a posição no mapa antes de salvar — ela é usada pelo motorista
        para navegar até o cliente.
      </p>
    </aside>
  );
}

export function CoordenadasPagina() {
  const { escopo } = useAuth();
  const [dias, setDias] = useState(30);
  const [limite, setLimite] = useState(500);
  const [situacao, setSituacao] = useState<'' | ClienteCoordenada['situacao']>('');
  const [fonte, setFonte] = useState<'' | 'ENTREGADOR' | 'ERP' | 'SUGESTAO'>('');
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<{ coluna: Coluna; desc: boolean }>({ coluna: 'situacao', desc: false });
  const { dados, erro, carregando, atualizar } = useConsulta<Coordenadas>(
    `/gestao/coordenadas?dias=${dias}&limite_m=${limite}&${escopo}`, 600000,
  );

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (dados?.clientes ?? []).filter((c) => (!situacao || c.situacao === situacao)
      && (!fonte || (fonte === 'SUGESTAO' ? sugestaoNova(c) : c.fonte === fonte))
      && (!termo || [c.nome, c.razao_social, `${c.codigo}/${c.loja}`, c.endereco].some((v) => v?.toLowerCase().includes(termo))))
      .sort((a, b) => comparar(a, b, ordem.coluna, ordem.desc)
        || comparar(a, b, 'cliente', false));
  }, [dados, situacao, fonte, busca, ordem]);
  const contagem = useMemo(() => {
    const todos = dados?.clientes ?? [];
    return {
      total: todos.length,
      sem: todos.filter((c) => c.situacao === 'SEM_COORDENADA').length,
      suspeitas: todos.filter((c) => c.situacao === 'SUSPEITA').length,
      corrigidas: todos.filter((c) => c.fonte === 'ENTREGADOR').length,
    };
  }, [dados]);
  const cliente = dados?.clientes.find((c) => chave(c) === selecionado) ?? null;

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>Coordenadas dos clientes</h1>
        <div className="resumo">
          <span><strong>{contagem.total}</strong> clientes</span>
          <span><strong>{contagem.sem}</strong> sem coordenada</span>
          <span><strong>{contagem.suspeitas}</strong> suspeitas</span>
          <span><strong>{contagem.corrigidas}</strong> corrigidas</span>
          {carregando && <span className="secundario">Atualizando…</span>}
          <button type="button" className="botao secundario-botao" onClick={() => exportar(lista)} disabled={!lista.length}>
            Exportar CSV
          </button>
        </div>
      </div>
      <p className="secundario">
        A coordenada corrigida aqui fica no banco do entregador e tem prioridade sobre A1_IONLAT/A1_IONLONG (cadastro do
        vendedor) no aplicativo, nas rotas e no painel. A sugerida é a mediana das posições em que o motorista concluiu a
        entrega no período. Selecione o cliente para aceitar a sugerida, buscar pelo endereço, digitar ou marcar no mapa.
      </p>

      <div className="filtros">
        <input type="search" placeholder="Cliente, código ou endereço" value={busca}
          onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        <select value={situacao} onChange={(e) => setSituacao(e.target.value as typeof situacao)} aria-label="Situação">
          <option value="">Todas as situações</option>
          <option value="SEM_COORDENADA">Sem coordenada</option>
          <option value="SUSPEITA">Suspeita (longe das entregas)</option>
          <option value="OK">OK</option>
        </select>
        <select value={fonte} onChange={(e) => setFonte(e.target.value as typeof fonte)} aria-label="Fonte da coordenada">
          <option value="">Todas as fontes</option>
          <option value="ENTREGADOR">Corrigida pela gerência</option>
          <option value="ERP">Do ERP (sem correção)</option>
          <option value="SUGESTAO">Com sugestão a aceitar</option>
        </select>
        <label>Entregas dos últimos{' '}
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {[7, 30, 60, 90, 180].map((d) => <option key={d} value={d}>{d} dias</option>)}
          </select>
        </label>
        <label>Distância mínima{' '}
          <select value={limite} onChange={(e) => setLimite(Number(e.target.value))}>
            {[200, 300, 500, 1000, 2000].map((m) => <option key={m} value={m}>{formatarDistancia(m)}</option>)}
          </select>
        </label>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}
      {dados && lista.length === 0 && <div className="aviso">Nenhum cliente encontrado com esses filtros.</div>}
      {lista.length > MAX_LINHAS && (
        <div className="aviso">Exibindo {MAX_LINHAS} de {lista.length} clientes. Use a busca ou os filtros para encontrar os demais.</div>
      )}

      <div className={cliente ? 'coordenadas-layout com-mapa' : 'coordenadas-layout'}>
        {lista.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  {COLUNAS.map(([c, rotulo]) => (
                    <th key={c} aria-sort={ordem.coluna === c ? (ordem.desc ? 'descending' : 'ascending') : undefined}>
                      <button type="button" className="ordenar"
                        onClick={() => setOrdem((o) => ({ coluna: c, desc: o.coluna === c ? !o.desc : c === 'distancia' || c === 'amostras' }))}>
                        {rotulo}{ordem.coluna === c ? (ordem.desc ? ' ▼' : ' ▲') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.slice(0, MAX_LINHAS).map((c) => (
                  <tr key={chave(c)} className={selecionado === chave(c) ? 'linha-selecionada' : undefined}
                    onClick={() => setSelecionado(chave(c))}>
                    <td>{c.nome ?? c.razao_social ?? '—'}
                      <div className="secundario">{c.codigo}/{c.loja}{c.endereco ? ` · ${c.endereco}` : ''}</div></td>
                    <td><span className={`etiqueta ${SITUACAO[c.situacao].classe}`}>{SITUACAO[c.situacao].rotulo}</span></td>
                    <td>
                      {coord(par(c.latitude, c.longitude))}
                      {c.fonte && (
                        <div><span className="etiqueta cinza">{c.fonte === 'ENTREGADOR' ? 'Corrigida' : 'ERP'}</span></div>
                      )}
                    </td>
                    <td>{coord(par(c.latitude_sugerida, c.longitude_sugerida))}</td>
                    <td>{formatarDistancia(c.distancia_m)}</td>
                    <td>{c.amostras}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {cliente && <EditorCoordenada cliente={cliente} aoFechar={() => setSelecionado(null)} aoAlterar={atualizar} />}
      </div>
    </main>
  );
}
