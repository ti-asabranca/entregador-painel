/**
 * Funcionalidade 1: mapa com todos os motoristas em viagem, na cor da situação (pausa, andando, entregando,
 * parado, sem sinal). Clicar no caminhão abre o detalhe (funcionalidade 2) no painel lateral.
 *
 * Camadas opcionais: clientes pendentes (cinza; os do motorista selecionado em destaque), percursos de hoje
 * (cinza; o do selecionado em destaque) e ocorrências do período (vermelho; concentração = mapa de calor).
 */
import { useMemo, useState } from 'react';
import { CircleMarker, Marker, Polyline, Tooltip } from 'react-leaflet';
import type { Painel } from '../api/tipos';
import type { CamadasMapa } from '../api/tiposAnalise';
import { useAuth } from '../auth/AuthContext';
import { DetalheMotorista } from '../componentes/DetalheMotorista';
import { COR_SERIE_1 } from '../componentes/Graficos';
import { MapaBase } from '../componentes/MapaBase';
import { iconeMotorista } from '../componentes/marcadores';
import { useConsulta } from '../hooks/useConsulta';
import { formatarDecorrido, formatarHora } from '../util/formatacao';
import { ORDEM_SITUACOES, SITUACAO } from '../util/rotulos';

const INTERVALO_MS = 30000;
const COR_NEUTRA = '#8a96a3';
const COR_OCORRENCIA = '#c62828';
const hojeIso = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const diasAtras = (n: number) => new Date(Date.now() - 3 * 3600e3 - n * 864e5).toISOString().slice(0, 10);

type Camada = 'clientes' | 'percursos' | 'ocorrencias';
const ROTULO_CAMADA: Record<Camada, string> = {
  clientes: 'Clientes pendentes',
  percursos: 'Percursos de hoje',
  ocorrencias: 'Ocorrências',
};

export function MapaPagina() {
  const { empresa, escopo } = useAuth();
  const { dados, erro } = useConsulta<Painel>(`/gestao/painel?${escopo}`, INTERVALO_MS);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [camadas, setCamadas] = useState<Set<Camada>>(new Set());
  const [diasOcorrencias, setDiasOcorrencias] = useState(7);
  const precisaCamadas = camadas.has('percursos') || camadas.has('ocorrencias');
  const { dados: extras, erro: erroExtras } = useConsulta<CamadasMapa>(
    precisaCamadas ? `/gestao/mapa/camadas?de=${diasAtras(diasOcorrencias - 1)}&ate=${hojeIso()}&${escopo}` : null,
    120000,
  );

  const alternar = (c: Camada) => setCamadas((atual) => {
    const n = new Set(atual);
    if (n.has(c)) n.delete(c);
    else n.add(c);
    return n;
  });

  const comPosicao = useMemo(() => (dados?.motoristas ?? []).filter((m) => m.posicao), [dados]);
  const pontos = useMemo(
    () => comPosicao.map((m) => [m.posicao!.latitude, m.posicao!.longitude] as [number, number]),
    [comPosicao],
  );
  const semPosicao = (dados?.motoristas.length ?? 0) - comPosicao.length;

  const clientesPendentes = useMemo(() => (dados?.motoristas ?? []).flatMap((m) => m.clientes
    .filter((c) => c.situacao === 'PENDENTE' && c.latitude != null && c.longitude != null)
    .map((c) => ({ ...c, motorista: m.codigo, motorista_nome: m.nome }))), [dados]);
  // Selecionado por último (desenhado por cima).
  const clientesOrdenados = useMemo(
    () => [...clientesPendentes].sort((a, b) => Number(a.motorista === selecionado) - Number(b.motorista === selecionado)),
    [clientesPendentes, selecionado],
  );
  const percursos = useMemo(
    () => [...(extras?.percursos ?? [])].sort((a, b) => Number(a.motorista === selecionado) - Number(b.motorista === selecionado)),
    [extras, selecionado],
  );
  const nomes = useMemo(() => new Map((dados?.motoristas ?? []).map((m) => [m.codigo, m.nome])), [dados]);

  return (
    <main className="pagina-mapa">
      <div className="mapa-area">
        <MapaBase pontos={pontos} chaveEnquadramento={`${empresa}|${comPosicao.length > 0}`} canvas>
          {camadas.has('ocorrencias') && extras?.ocorrencias.map(([lat, lon, resultado], i) => (
            // Círculos translúcidos sobrepostos: onde há concentração, a cor fica mais intensa.
            <CircleMarker key={`o${i}`} center={[lat, lon]} radius={10}
              pathOptions={{ stroke: false, fillColor: COR_OCORRENCIA, fillOpacity: 0.25 }}>
              <Tooltip>{resultado === 'PARCIAL' ? 'Entrega parcial' : 'Não entregue'}</Tooltip>
            </CircleMarker>
          ))}
          {camadas.has('percursos') && percursos.map((p) => {
            const destaque = p.motorista === selecionado;
            return (
              <Polyline key={`p${p.motorista}`} positions={p.linha}
                pathOptions={{ color: destaque ? COR_SERIE_1 : COR_NEUTRA, weight: destaque ? 4 : 2, opacity: destaque ? 0.95 : 0.5 }}
                eventHandlers={{ click: () => setSelecionado(p.motorista) }}>
                <Tooltip sticky>{nomes.get(p.motorista) ?? p.motorista}</Tooltip>
              </Polyline>
            );
          })}
          {camadas.has('clientes') && clientesOrdenados.map((c) => {
            const destaque = c.motorista === selecionado;
            return (
              <CircleMarker key={`c${c.motorista}|${c.codigo}|${c.loja}`} center={[c.latitude!, c.longitude!]}
                radius={destaque ? 6 : 4}
                pathOptions={{ color: '#ffffff', weight: destaque ? 2 : 1, fillColor: destaque ? COR_SERIE_1 : COR_NEUTRA, fillOpacity: destaque ? 1 : 0.7 }}
                eventHandlers={{ click: () => setSelecionado(c.motorista) }}>
                <Tooltip>
                  <strong>{c.nome ?? `${c.codigo}/${c.loja}`}</strong><br />
                  {c.municipio ?? ''}{c.ordem !== null ? ` · ${c.ordem}º na rota` : ''}<br />
                  {c.motorista_nome}
                </Tooltip>
              </CircleMarker>
            );
          })}
          {comPosicao.map((m) => (
            <Marker
              key={m.codigo}
              position={[m.posicao!.latitude, m.posicao!.longitude]}
              icon={iconeMotorista(m.situacao, m.codigo === selecionado)}
              zIndexOffset={m.codigo === selecionado ? 1000 : 0}
              eventHandlers={{ click: () => setSelecionado(m.codigo) }}
              keyboard
              title={m.nome}
            >
              <Tooltip direction="top" offset={[0, -16]}>
                <strong>{m.nome}</strong><br />
                {SITUACAO[m.situacao].rotulo} · {m.clientes_total - m.clientes_pendentes}/{m.clientes_total} clientes<br />
                {formatarDecorrido(m.posicao!.em)}
                {m.previsao_termino_em && <><br />Término previsto {formatarHora(m.previsao_termino_em)}</>}
              </Tooltip>
            </Marker>
          ))}
        </MapaBase>
        <div className="camadas-mapa" role="group" aria-label="Camadas do mapa">
          {(Object.keys(ROTULO_CAMADA) as Camada[]).map((c) => (
            <label key={c}>
              <input type="checkbox" checked={camadas.has(c)} onChange={() => alternar(c)} />
              <i className={`camada-${c}`} aria-hidden="true" />
              {ROTULO_CAMADA[c]}
              {c === 'clientes' && camadas.has(c) && <span className="secundario"> ({clientesPendentes.length})</span>}
              {c === 'percursos' && camadas.has(c) && extras && <span className="secundario"> ({extras.percursos.length})</span>}
            </label>
          ))}
          {camadas.has('ocorrencias') && (
            <select value={diasOcorrencias} onChange={(e) => setDiasOcorrencias(Number(e.target.value))} aria-label="Período das ocorrências">
              <option value={1}>hoje</option>
              <option value={7}>últimos 7 dias</option>
              <option value={30}>últimos 30 dias</option>
            </select>
          )}
          {camadas.has('ocorrencias') && extras && <span className="secundario">{extras.ocorrencias.length} ocorrências</span>}
          {selecionado && (camadas.has('clientes') || camadas.has('percursos')) && (
            <span className="secundario">Em destaque: {nomes.get(selecionado) ?? selecionado}</span>
          )}
          {erroExtras && <span className="erro-texto">{erroExtras}</span>}
        </div>
        <div className="legenda-mapa" aria-label="Legenda">
          {ORDEM_SITUACOES.map((s) => (
            <span key={s} title={SITUACAO[s].descricao}>
              <i style={{ backgroundColor: SITUACAO[s].cor }} />
              {SITUACAO[s].rotulo} ({dados?.resumo.por_situacao[s] ?? 0})
            </span>
          ))}
          {semPosicao > 0 && <span className="secundario">{semPosicao} sem posição (não aparecem no mapa)</span>}
          {erro && <span className="erro-texto">{erro}</span>}
        </div>
      </div>
      {selecionado && (
        <aside className="painel-lateral" aria-label="Detalhe do motorista">
          <button type="button" className="fechar" onClick={() => setSelecionado(null)} aria-label="Fechar">×</button>
          <DetalheMotorista key={selecionado} codigo={selecionado} compacto />
        </aside>
      )}
    </main>
  );
}
