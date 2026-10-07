/**
 * Qualidade das coordenadas dos clientes: sem coordenada ou com coordenada suspeita (local real das entregas, pela
 * mediana das posições de conclusão, longe do cadastro). Exporta CSV com a sugestão para correção no ERP
 * (A1_IONLAT/A1_IONLONG). O painel não altera o cadastro: a correção é feita no ERP após conferência.
 */
import { useMemo, useState } from 'react';
import { Marker, Polyline, Tooltip } from 'react-leaflet';
import type { ClienteCoordenada, Coordenadas } from '../api/tiposAnalise';
import { useAuth } from '../auth/AuthContext';
import { MapaBase } from '../componentes/MapaBase';
import { iconeCliente } from '../componentes/marcadores';
import { useConsulta } from '../hooks/useConsulta';
import { baixarCsv, numeroCsv } from '../util/csv';
import { formatarDistancia } from '../util/formatacao';

const coord = (lat: number | null, lon: number | null) =>
  lat === null || lon === null ? '—' : `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
const linkMapa = (lat: number, lon: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;

function exportar(lista: ClienteCoordenada[]): void {
  baixarCsv(`coordenadas-clientes-${new Date().toISOString().slice(0, 10)}.csv`,
    ['A1_COD', 'A1_LOJA', 'Nome', 'Endereço', 'Situação', 'Lat. cadastro', 'Lon. cadastro', 'Lat. sugerida',
      'Lon. sugerida', 'Distância (m)', 'Amostras'],
    lista.map((c) => [c.codigo, c.loja, c.nome ?? c.razao_social, c.endereco,
      c.situacao === 'SEM_COORDENADA' ? 'Sem coordenada' : 'Suspeita', numeroCsv(c.latitude), numeroCsv(c.longitude),
      numeroCsv(c.latitude_sugerida), numeroCsv(c.longitude_sugerida), numeroCsv(c.distancia_m), c.amostras]));
}

export function CoordenadasPagina() {
  const { escopo } = useAuth();
  const [dias, setDias] = useState(30);
  const [limite, setLimite] = useState(500);
  const [situacao, setSituacao] = useState<'' | ClienteCoordenada['situacao']>('');
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<ClienteCoordenada | null>(null);
  const { dados, erro, carregando } = useConsulta<Coordenadas>(
    `/gestao/coordenadas?dias=${dias}&limite_m=${limite}&${escopo}`, 600000,
  );

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (dados?.clientes ?? []).filter((c) => (!situacao || c.situacao === situacao)
      && (!termo || [c.nome, c.razao_social, c.codigo, c.endereco].some((v) => v?.toLowerCase().includes(termo))));
  }, [dados, situacao, busca]);
  const semCoordenada = lista.filter((c) => c.situacao === 'SEM_COORDENADA').length;
  const comSugestao = lista.filter((c) => c.latitude_sugerida !== null).length;

  const pontosSel: [number, number][] = selecionado ? [
    ...(selecionado.latitude !== null && selecionado.longitude !== null ? [[selecionado.latitude, selecionado.longitude] as [number, number]] : []),
    ...(selecionado.latitude_sugerida !== null && selecionado.longitude_sugerida !== null
      ? [[selecionado.latitude_sugerida, selecionado.longitude_sugerida] as [number, number]] : []),
  ] : [];

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>Coordenadas dos clientes</h1>
        <div className="resumo">
          <span><strong>{semCoordenada}</strong> sem coordenada</span>
          <span><strong>{lista.length - semCoordenada}</strong> suspeitas</span>
          <span><strong>{comSugestao}</strong> com sugestão</span>
          {carregando && <span className="secundario">Atualizando…</span>}
          <button type="button" className="botao secundario-botao" onClick={() => exportar(lista)} disabled={!lista.length}>
            Exportar CSV
          </button>
        </div>
      </div>
      <p className="secundario">
        A sugestão é a mediana das posições em que o motorista concluiu a entrega do cliente (mínimo de amostras no
        período). Confira no mapa antes de corrigir A1_IONLAT/A1_IONLONG no ERP.
      </p>

      <div className="filtros">
        <input type="search" placeholder="Cliente, código ou endereço" value={busca}
          onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        <select value={situacao} onChange={(e) => setSituacao(e.target.value as typeof situacao)} aria-label="Situação">
          <option value="">Todas as situações</option>
          <option value="SEM_COORDENADA">Sem coordenada</option>
          <option value="SUSPEITA">Suspeita (longe das entregas)</option>
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
      {dados && lista.length === 0 && <div className="aviso">Nenhum cliente com coordenada ausente ou suspeita.</div>}

      <div className={selecionado ? 'coordenadas-layout com-mapa' : 'coordenadas-layout'}>
        {lista.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr><th>Cliente</th><th>Situação</th><th>Cadastro</th><th>Sugerida</th><th>Distância</th><th>Amostras</th></tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={`${c.codigo}|${c.loja}`} className={selecionado === c ? 'linha-selecionada' : undefined}
                    onClick={() => setSelecionado(c.latitude_sugerida !== null || c.latitude !== null ? c : null)}>
                    <td>{c.nome ?? c.razao_social ?? '—'}
                      <div className="secundario">{c.codigo}/{c.loja}{c.endereco ? ` · ${c.endereco}` : ''}</div></td>
                    <td><span className={`etiqueta ${c.situacao === 'SEM_COORDENADA' ? 'vermelha' : 'amarela'}`}>
                      {c.situacao === 'SEM_COORDENADA' ? 'Sem coordenada' : 'Suspeita'}</span></td>
                    <td>{coord(c.latitude, c.longitude)}</td>
                    <td>
                      {coord(c.latitude_sugerida, c.longitude_sugerida)}
                      {c.latitude_sugerida !== null && c.longitude_sugerida !== null && (
                        <div><a href={linkMapa(c.latitude_sugerida, c.longitude_sugerida)} target="_blank" rel="noreferrer noopener"
                          onClick={(e) => e.stopPropagation()}>Abrir no mapa</a></div>
                      )}
                    </td>
                    <td>{formatarDistancia(c.distancia_m)}</td>
                    <td>{c.amostras}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selecionado && pontosSel.length > 0 && (
          <aside className="coordenadas-mapa" aria-label="Mapa do cliente selecionado">
            <button type="button" className="fechar" onClick={() => setSelecionado(null)} aria-label="Fechar">×</button>
            <strong>{selecionado.nome ?? selecionado.codigo}</strong>
            <MapaBase pontos={pontosSel} chaveEnquadramento={`${selecionado.codigo}|${selecionado.loja}`} className="mapa-detalhe">
              {selecionado.latitude !== null && selecionado.longitude !== null && (
                <Marker position={[selecionado.latitude, selecionado.longitude]} icon={iconeCliente('NAO_ENTREGUE', null)}>
                  <Tooltip permanent direction="top">Cadastro</Tooltip>
                </Marker>
              )}
              {selecionado.latitude_sugerida !== null && selecionado.longitude_sugerida !== null && (
                <Marker position={[selecionado.latitude_sugerida, selecionado.longitude_sugerida]} icon={iconeCliente('ENTREGUE', null)}>
                  <Tooltip permanent direction="top">Sugerida ({selecionado.amostras} entregas)</Tooltip>
                </Marker>
              )}
              {pontosSel.length === 2 && <Polyline positions={pontosSel} pathOptions={{ color: '#616161', dashArray: '4 6', weight: 2 }} />}
            </MapaBase>
          </aside>
        )}
      </div>
    </main>
  );
}
