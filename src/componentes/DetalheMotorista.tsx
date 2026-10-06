/**
 * Detalhe de um motorista (funcionalidade 2): caminhão, cargas, peso de saída e restante, situação, rota que está
 * seguindo, melhor rota (menor distância, calculada pela API sem alterar a rota do motorista) e clientes na
 * ordem da melhor rota, com cor por situação. Usado no painel lateral do mapa e na página do motorista.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Marker, Polyline, Tooltip } from 'react-leaflet';
import type { DetalheMotorista as Detalhe } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { useConsulta } from '../hooks/useConsulta';
import {
  formatarDecorrido, formatarDistancia, formatarDuracao, formatarHora, formatarPeso, percentualEntregue,
} from '../util/formatacao';
import { decodificarPolyline } from '../util/polyline';
import { SITUACAO_CLIENTE, rotuloMotivo } from '../util/rotulos';
import { MapaBase } from './MapaBase';
import { iconeCliente, iconeDeposito, iconeMotorista } from './marcadores';
import { MarcaCliente, SeloSituacao } from './Selo';

const INTERVALO_MS = 60000;

export function DetalheMotorista({ codigo, compacto = false }: { codigo: string; compacto?: boolean }) {
  const { empresa } = useAuth();
  const { dados: d, erro, carregando, atualizar } = useConsulta<Detalhe>(
    `/gestao/motoristas/${encodeURIComponent(codigo)}?empresa=${empresa}`,
    INTERVALO_MS,
  );

  const geometrias = useMemo(() => ({
    melhor: d?.melhor_rota?.geometria ? decodificarPolyline(d.melhor_rota.geometria) : null,
    vigente: d?.rota_vigente?.geometria ? decodificarPolyline(d.rota_vigente.geometria) : null,
  }), [d?.melhor_rota?.geometria, d?.rota_vigente?.geometria]);

  if (!d) {
    return <div className="aviso">{erro ?? (carregando ? 'Carregando…' : 'Sem dados.')}</div>;
  }

  const pontosMapa: [number, number][] = [
    ...(d.posicao ? [[d.posicao.latitude, d.posicao.longitude] as [number, number]] : []),
    ...d.clientes.filter((c) => c.latitude !== null && c.longitude !== null)
      .map((c) => [c.latitude!, c.longitude!] as [number, number]),
  ];
  const pct = percentualEntregue(d.peso_total, d.peso_restante);

  return (
    <div className={`detalhe${compacto ? ' compacto' : ''}`}>
      <header className="detalhe-cabecalho">
        <div>
          <h2>{d.nome}</h2>
          <div className="secundario">
            Código {d.codigo} · {d.caminhoes.length ? `Veículo ${d.caminhoes.join(', ')}` : 'Veículo não informado'}
          </div>
        </div>
        <SeloSituacao situacao={d.situacao} />
      </header>

      {erro && <div className="aviso erro">{erro} (exibindo os últimos dados)</div>}

      <section className="detalhe-situacao">
        {d.pausa && (
          <p>
            Em pausa: <strong>{rotuloMotivo(d.pausa.motivo)}</strong> desde {formatarHora(d.pausa.desde)}
            {d.pausa.descricao ? ` — ${d.pausa.descricao}` : ''}
          </p>
        )}
        {d.visita && (
          <p>
            No cliente <strong>{d.visita.cliente_nome ?? d.visita.cliente_codigo}</strong> desde{' '}
            {formatarHora(d.visita.desde)} ({formatarDecorrido(d.visita.desde)})
          </p>
        )}
        <p className="secundario">
          Última posição: {d.posicao
            ? `${formatarDecorrido(d.posicao.em)}${d.posicao.velocidade_kmh !== null ? ` · ${d.posicao.velocidade_kmh} km/h` : ''}`
            : 'sem rastreamento'}
        </p>
      </section>

      <section className="cartoes-numeros">
        <div className="numero">
          <span className="rotulo">Peso de saída</span>
          <strong>{formatarPeso(d.peso_total)}</strong>
        </div>
        <div className="numero">
          <span className="rotulo">Resta entregar</span>
          <strong>{formatarPeso(d.peso_restante)}</strong>
          {d.peso_restante_incompleto && (
            <span className="alerta-pequeno" title="Há notas pendentes sem itens ou sem B1_PESBRU cadastrado">
              parcial
            </span>
          )}
        </div>
        <div className="numero">
          <span className="rotulo">Clientes</span>
          <strong>{d.clientes_total - d.clientes_pendentes} de {d.clientes_total}</strong>
          <span className="secundario">concluídos</span>
        </div>
        <div className="numero">
          <span className="rotulo">Melhor rota (restante)</span>
          <strong>{formatarDistancia(d.melhor_rota?.distancia_m)}</strong>
          <span className="secundario">{formatarDuracao(d.melhor_rota?.duracao_s)}</span>
        </div>
      </section>
      {pct !== null && (
        <div className="barra" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
          aria-label="Peso entregue">
          <div style={{ width: `${pct}%` }} />
          <span>{pct}% do peso entregue</span>
        </div>
      )}

      <section>
        <h3>Rotas</h3>
        <ul className="legenda-rotas">
          <li><span className="linha melhor" /> Melhor rota (menor distância, da posição atual)
            {d.melhor_rota_aviso && <em className="secundario"> — {d.melhor_rota_aviso}</em>}</li>
          <li><span className="linha vigente" /> Rota que o motorista está seguindo
            {d.rota_vigente
              ? ` (${d.rota_vigente.origem === 'APP' ? 'calculada no app' : 'definida pela gestão'}, `
                + `${formatarDistancia(d.rota_vigente.distancia_m)})`
              : ' — não calculada'}</li>
          <li><span className="linha percurso" /> Percurso realizado
            {d.percurso_desde ? ` desde ${formatarHora(d.percurso_desde)}` : ' — sem pontos'}</li>
        </ul>
        <MapaBase pontos={pontosMapa} chaveEnquadramento={d.codigo} className="mapa-detalhe">
          {d.percurso.length > 1 && <Polyline positions={d.percurso} pathOptions={{ color: '#757575', weight: 4, opacity: 0.7 }} />}
          {geometrias.vigente && (
            <Polyline positions={geometrias.vigente} pathOptions={{ color: '#1565c0', weight: 3, dashArray: '6 8' }} />
          )}
          {geometrias.melhor && <Polyline positions={geometrias.melhor} pathOptions={{ color: '#2e7d32', weight: 5, opacity: 0.85 }} />}
          {d.deposito && (
            <Marker position={[d.deposito.latitude, d.deposito.longitude]} icon={iconeDeposito}>
              <Tooltip>{d.deposito.nome ?? 'Depósito'}</Tooltip>
            </Marker>
          )}
          {d.clientes.filter((c) => c.latitude !== null && c.longitude !== null).map((c) => (
            <Marker key={`${c.codigo}|${c.loja}`} position={[c.latitude!, c.longitude!]} icon={iconeCliente(c.situacao, c.ordem)}>
              <Tooltip>{c.nome} — {SITUACAO_CLIENTE[c.situacao].rotulo}</Tooltip>
            </Marker>
          ))}
          {d.posicao && (
            <Marker position={[d.posicao.latitude, d.posicao.longitude]} icon={iconeMotorista(d.situacao, true)} zIndexOffset={1000}>
              <Tooltip>{d.nome}</Tooltip>
            </Marker>
          )}
        </MapaBase>
      </section>

      <section>
        <h3>Clientes na ordem da melhor rota</h3>
        <ol className="lista-clientes">
          {d.clientes.map((c) => (
            <li key={`${c.codigo}|${c.loja}`} className={`cliente ${c.situacao.toLowerCase()}`}>
              <MarcaCliente situacao={c.situacao} ordem={c.ordem} />
              <div className="cliente-texto">
                <strong>{c.nome ?? `${c.codigo}/${c.loja}`}</strong>
                <span className="secundario">
                  {[c.bairro, c.municipio].filter(Boolean).join(' · ') || 'Endereço não informado'}
                  {c.latitude === null && ' · sem coordenadas'}
                </span>
                {c.situacao !== 'PENDENTE' && c.situacao !== 'ENTREGUE' && (
                  <span className="motivo">{rotuloMotivo(c.motivo)}{c.descricao ? ` — ${c.descricao}` : ''}</span>
                )}
              </div>
              <div className="cliente-numeros">
                <span>{c.notas_entregues}/{c.notas} NF</span>
                {c.situacao === 'PENDENTE' ? (
                  <>
                    <span>{formatarPeso(c.peso_pendente)}{c.peso_incompleto ? '*' : ''}</span>
                    {c.distancia_acumulada_m !== null && <span className="secundario">{formatarDistancia(c.distancia_acumulada_m)}</span>}
                  </>
                ) : (
                  <span className="secundario">{SITUACAO_CLIENTE[c.situacao].rotulo} {formatarHora(c.concluido_em)}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
        {d.clientes.some((c) => c.peso_incompleto && c.situacao === 'PENDENTE') && (
          <p className="secundario">* Peso parcial: há itens sem B1_PESBRU ou notas sem itens sincronizados.</p>
        )}
      </section>

      <footer className="detalhe-rodape">
        <span className="secundario">Cargas: {d.cargas.map((c) => `${c.codigo}/${c.seqcar}`).join(', ')}</span>
        <span>
          <button type="button" className="botao-link" onClick={atualizar} disabled={carregando}>
            {carregando ? 'Atualizando…' : 'Atualizar'}
          </button>
          {compacto && <Link to={`/motoristas/${d.codigo}`}> · Abrir em tela cheia</Link>}
        </span>
      </footer>
    </div>
  );
}
