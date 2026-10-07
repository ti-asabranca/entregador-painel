/**
 * Funcionalidade 1: mapa com todos os motoristas em viagem, na cor da situação (pausa, andando, entregando,
 * parado, sem sinal). Clicar no caminhão abre o detalhe (funcionalidade 2) no painel lateral.
 */
import { useMemo, useState } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import type { Painel } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { DetalheMotorista } from '../componentes/DetalheMotorista';
import { MapaBase } from '../componentes/MapaBase';
import { iconeMotorista } from '../componentes/marcadores';
import { useConsulta } from '../hooks/useConsulta';
import { formatarDecorrido } from '../util/formatacao';
import { ORDEM_SITUACOES, SITUACAO } from '../util/rotulos';

const INTERVALO_MS = 30000;

export function MapaPagina() {
  const { empresa, escopo } = useAuth();
  const { dados, erro } = useConsulta<Painel>(`/gestao/painel?${escopo}`, INTERVALO_MS);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const comPosicao = useMemo(() => (dados?.motoristas ?? []).filter((m) => m.posicao), [dados]);
  const pontos = useMemo(
    () => comPosicao.map((m) => [m.posicao!.latitude, m.posicao!.longitude] as [number, number]),
    [comPosicao],
  );
  const semPosicao = (dados?.motoristas.length ?? 0) - comPosicao.length;

  return (
    <main className="pagina-mapa">
      <div className="mapa-area">
        <MapaBase pontos={pontos} chaveEnquadramento={`${empresa}|${comPosicao.length > 0}`}>
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
              </Tooltip>
            </Marker>
          ))}
        </MapaBase>
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
