/**
 * Linha do tempo do motorista num dia (depósito, chegada/saída nos clientes, conclusões, pausas e GPS) e replay do
 * percurso: controle deslizante/play que move o caminhão pelos pontos gravados, com o trecho já percorrido destacado.
 */
import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import type { EventoLinhaDoTempo, LinhaDoTempo as Dados } from '../api/tiposAnalise';
import { useAuth } from '../auth/AuthContext';
import { useConsulta } from '../hooks/useConsulta';
import { formatarDuracao, formatarHora } from '../util/formatacao';
import { rotuloMotivo } from '../util/rotulos';
import { MapaBase } from './MapaBase';

const hojeIso = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

const ROTULOS: Record<string, string> = {
  DEPOSITO_SAIDA: 'Saiu do depósito',
  DEPOSITO_CHEGADA: 'Chegou ao depósito',
  PARADA_NAO_PLANEJADA: 'Parada não planejada',
  GPS_SITUACAO: 'GPS',
  CHEGADA_CLIENTE: 'Chegou ao cliente',
  SAIDA_CLIENTE: 'Saiu do cliente',
  CONCLUSAO_ENTREGUE: 'Entrega concluída',
  CONCLUSAO_PARCIAL: 'Entrega parcial',
  CONCLUSAO_NAO_ENTREGUE: 'Não entregue',
  PAUSA_INICIO: 'Início de pausa',
  PAUSA_FIM: 'Fim de pausa',
};

/** Classe visual por tipo: ocorrência (vermelho), pausa/parada (atenção), demais neutros. */
function classeEvento(tipo: string): string {
  if (tipo === 'CONCLUSAO_NAO_ENTREGUE') return 'evento critico';
  if (tipo === 'CONCLUSAO_PARCIAL' || tipo === 'PARADA_NAO_PLANEJADA' || tipo === 'GPS_SITUACAO') return 'evento atencao';
  if (tipo === 'CONCLUSAO_ENTREGUE') return 'evento sucesso';
  return 'evento';
}

function textoEvento(e: EventoLinhaDoTempo): string {
  const cliente = e.cliente_nome ?? (e.cliente_codigo ? `${e.cliente_codigo}/${e.cliente_loja}` : null);
  const partes: string[] = [];
  if (cliente) partes.push(cliente);
  if (e.motivo) partes.push(rotuloMotivo(e.motivo));
  if (e.tipo === 'GPS_SITUACAO' && e.detalhe) partes.push(e.detalhe.toLowerCase().replace(/_/g, ' '));
  if (e.inicio) {
    const dur = (new Date(e.em).getTime() - new Date(e.inicio).getTime()) / 1000;
    if (dur > 0) partes.push(`duração ${formatarDuracao(dur)}`);
  }
  return partes.join(' · ');
}

export function LinhaDoTempo({ codigo }: { codigo: string }) {
  const { escopo } = useAuth();
  const [dia, setDia] = useState(hojeIso);
  const { dados, erro, carregando } = useConsulta<Dados>(
    `/gestao/motoristas/${encodeURIComponent(codigo)}/linha-do-tempo?dia=${dia}&${escopo}`,
    dia === hojeIso() ? 120000 : 3600000,
  );
  const percurso = dados?.percurso ?? [];
  const [posicao, setPosicao] = useState(0);
  const [tocando, setTocando] = useState(false);

  // Novo dia/novos dados: replay volta ao fim (situação mais recente).
  useEffect(() => {
    setPosicao(Math.max(0, percurso.length - 1));
    setTocando(false);
  }, [percurso.length, dia]);

  useEffect(() => {
    if (!tocando) return;
    // ~30 s para o dia inteiro, independentemente do número de pontos.
    const passo = Math.max(1, Math.round(percurso.length / 300));
    const id = setInterval(() => setPosicao((p) => Math.min(percurso.length - 1, p + passo)), 100);
    return () => clearInterval(id);
  }, [tocando, percurso.length]);

  useEffect(() => {
    if (tocando && posicao >= percurso.length - 1) setTocando(false);
  }, [tocando, posicao, percurso.length]);

  const linha = useMemo(() => percurso.map((p) => [p[1], p[2]] as [number, number]), [percurso]);
  const atual = percurso[posicao];
  const horaAtual = atual ? new Date(atual[0]).getTime() : null;
  // Eventos até o instante do replay ficam marcados como "já ocorridos".
  const eventos = dados?.eventos ?? [];

  return (
    <section className="linha-do-tempo">
      <div className="linha-do-tempo-cabecalho">
        <h3>Linha do tempo</h3>
        <label>
          Dia <input type="date" value={dia} max={hojeIso()} onChange={(e) => e.target.value && setDia(e.target.value)} />
        </label>
        {carregando && <span className="secundario">Carregando…</span>}
      </div>
      {erro && <div className="aviso erro">{erro}</div>}

      {percurso.length > 1 ? (
        <>
          <MapaBase pontos={linha} chaveEnquadramento={`${codigo}|${dia}|${linha.length > 0}`} className="mapa-detalhe">
            <Polyline positions={linha} pathOptions={{ color: '#9aa5b1', weight: 4, opacity: 0.6 }} />
            <Polyline positions={linha.slice(0, posicao + 1)} pathOptions={{ color: '#2a78d6', weight: 4 }} />
            {atual && (
              <CircleMarker center={[atual[1], atual[2]]} radius={8}
                pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#2a78d6', fillOpacity: 1 }}>
                <Tooltip permanent direction="top" offset={[0, -8]}>
                  {formatarHora(atual[0])}{atual[3] !== null ? ` · ${Math.round(atual[3] * 3.6)} km/h` : ''}
                </Tooltip>
              </CircleMarker>
            )}
          </MapaBase>
          <div className="replay">
            <button type="button" className="botao secundario-botao"
              onClick={() => {
                if (posicao >= percurso.length - 1) setPosicao(0);
                setTocando((t) => !t);
              }}>
              {tocando ? 'Pausar' : 'Reproduzir'}
            </button>
            <input type="range" min={0} max={percurso.length - 1} value={posicao} aria-label="Instante do percurso"
              onChange={(e) => { setTocando(false); setPosicao(Number(e.target.value)); }} />
            <span className="replay-hora">{formatarHora(atual?.[0])}</span>
          </div>
        </>
      ) : (
        dados && <div className="aviso">Sem percurso gravado neste dia (o rastreamento depende do aplicativo do motorista).</div>
      )}

      {dados && eventos.length === 0 && <div className="aviso">Nenhum evento registrado neste dia.</div>}
      {eventos.length > 0 && (
        <ol className="eventos">
          {eventos.map((e, i) => {
            const passou = horaAtual === null || new Date(e.em).getTime() <= horaAtual;
            return (
              <li key={`${e.em}|${e.tipo}|${i}`} className={`${classeEvento(e.tipo)}${passou ? '' : ' futuro'}`}>
                <span className="evento-hora">{formatarHora(e.em)}</span>
                <span className="evento-tipo">{ROTULOS[e.tipo] ?? e.tipo}</span>
                <span className="evento-texto secundario">{textoEvento(e)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
