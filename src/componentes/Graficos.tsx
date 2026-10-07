/**
 * Gráficos simples em SVG (sem biblioteca): barras empilhadas por dia, linha e barras horizontais.
 * Regras de visualização: um eixo só, marcas finas, 2px de espaço entre segmentos, extremidades arredondadas,
 * grade discreta, legenda para 2+ séries, textos na cor de texto (não na cor da série) e tooltip ao passar o mouse.
 * Cores categóricas validadas (azul/laranja, slots 1 e 2 da paleta de referência).
 */
import { useState, type ReactNode } from 'react';

export const COR_SERIE_1 = '#2a78d6';
export const COR_SERIE_2 = '#eb6834';
const COR_GRADE = '#e3e8ee';

const ALTURA = 180;
const MARGEM = { topo: 12, base: 24, esq: 36, dir: 8 };

function escala(max: number) {
  const passo = max <= 5 ? 1 : max <= 20 ? 5 : max <= 50 ? 10 : max <= 200 ? 50 : 100;
  const topo = Math.max(passo, Math.ceil(max / passo) * passo);
  const marcas: number[] = [];
  for (let v = 0; v <= topo; v += passo) marcas.push(v);
  return { topo, marcas: marcas.length > 6 ? marcas.filter((_, i) => i % 2 === 0) : marcas };
}

const rotuloDia = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);

/** Tooltip posicionado em % da largura do gráfico (acompanha o redimensionamento do SVG). */
function Tooltip({ x, children }: { x: string; children: ReactNode }) {
  return <div className="grafico-tooltip" style={{ left: x }}>{children}</div>;
}

/** Barras empilhadas por dia: série 1 (base) + série 2 (topo). */
export function BarrasEmpilhadas({ dados, serie1, serie2, titulo }: {
  dados: { rotulo: string; v1: number; v2: number }[];
  serie1: string;
  serie2: string;
  titulo: string;
}) {
  const [foco, setFoco] = useState<number | null>(null);
  const largura = Math.max(320, dados.length * 26 + MARGEM.esq + MARGEM.dir);
  const { topo, marcas } = escala(Math.max(1, ...dados.map((d) => d.v1 + d.v2)));
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.base;
  const y = (v: number) => MARGEM.topo + alturaUtil - (v / topo) * alturaUtil;
  const passo = (largura - MARGEM.esq - MARGEM.dir) / Math.max(1, dados.length);
  const larguraBarra = Math.min(22, passo * 0.7);
  const cadaN = Math.ceil(dados.length / 12);

  return (
    <figure className="grafico">
      <figcaption>{titulo}</figcaption>
      <div className="grafico-legenda">
        <span><i style={{ background: COR_SERIE_1 }} />{serie1}</span>
        <span><i style={{ background: COR_SERIE_2 }} />{serie2}</span>
      </div>
      <div className="grafico-area" onMouseLeave={() => setFoco(null)}>
        <svg viewBox={`0 0 ${largura} ${ALTURA}`} width="100%" role="img" aria-label={titulo}>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={MARGEM.esq} x2={largura - MARGEM.dir} y1={y(m)} y2={y(m)} stroke={COR_GRADE} strokeWidth={1} />
              <text x={MARGEM.esq - 6} y={y(m) + 4} textAnchor="end" className="grafico-eixo">{m}</text>
            </g>
          ))}
          {dados.map((d, i) => {
            const x = MARGEM.esq + i * passo + (passo - larguraBarra) / 2;
            const h1 = (d.v1 / topo) * alturaUtil;
            const h2 = (d.v2 / topo) * alturaUtil;
            const gap = d.v1 > 0 && d.v2 > 0 ? 2 : 0;
            return (
              <g key={d.rotulo} onMouseEnter={() => setFoco(i)}>
                {/* Alvo de hover maior que a barra. */}
                <rect x={MARGEM.esq + i * passo} y={MARGEM.topo} width={passo} height={alturaUtil} fill="transparent" />
                {d.v1 > 0 && <rect x={x} y={y(d.v1)} width={larguraBarra} height={Math.max(1, h1)} rx={d.v2 > 0 ? 0 : 4} fill={COR_SERIE_1} />}
                {d.v2 > 0 && <rect x={x} y={y(d.v1 + d.v2)} width={larguraBarra} height={Math.max(1, h2 - gap)} rx={4} fill={COR_SERIE_2} />}
                {i % cadaN === 0 && (
                  <text x={x + larguraBarra / 2} y={ALTURA - 6} textAnchor="middle" className="grafico-eixo">{rotuloDia(d.rotulo)}</text>
                )}
              </g>
            );
          })}
        </svg>
        {foco !== null && dados[foco] && (
          <Tooltip x={`${((MARGEM.esq + foco * passo + passo / 2) / largura) * 100}%`}>
            <strong>{rotuloDia(dados[foco].rotulo)}</strong>
            <span><i style={{ background: COR_SERIE_1 }} />{serie1}: {dados[foco].v1}</span>
            <span><i style={{ background: COR_SERIE_2 }} />{serie2}: {dados[foco].v2}</span>
            <span>Total: {dados[foco].v1 + dados[foco].v2}</span>
          </Tooltip>
        )}
      </div>
    </figure>
  );
}

/** Linha de uma série por dia (pontos sem valor ficam de fora). */
export function Linha({ dados, titulo, unidade }: {
  dados: { rotulo: string; valor: number | null }[];
  titulo: string;
  unidade: string;
}) {
  const [foco, setFoco] = useState<number | null>(null);
  const largura = Math.max(320, dados.length * 26 + MARGEM.esq + MARGEM.dir);
  const valores = dados.map((d) => d.valor).filter((v): v is number => v !== null);
  const { topo, marcas } = escala(Math.max(1, ...valores));
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.base;
  const y = (v: number) => MARGEM.topo + alturaUtil - (v / topo) * alturaUtil;
  const passo = (largura - MARGEM.esq - MARGEM.dir) / Math.max(1, dados.length);
  const x = (i: number) => MARGEM.esq + i * passo + passo / 2;
  const pontos = dados.map((d, i) => (d.valor === null ? null : `${x(i)},${y(d.valor)}`)).filter(Boolean).join(' ');
  const cadaN = Math.ceil(dados.length / 12);

  return (
    <figure className="grafico">
      <figcaption>{titulo}</figcaption>
      <div className="grafico-area" onMouseLeave={() => setFoco(null)}>
        <svg viewBox={`0 0 ${largura} ${ALTURA}`} width="100%" role="img" aria-label={titulo}>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={MARGEM.esq} x2={largura - MARGEM.dir} y1={y(m)} y2={y(m)} stroke={COR_GRADE} strokeWidth={1} />
              <text x={MARGEM.esq - 6} y={y(m) + 4} textAnchor="end" className="grafico-eixo">{m}</text>
            </g>
          ))}
          {valores.length > 1 && <polyline points={pontos} fill="none" stroke={COR_SERIE_1} strokeWidth={2} strokeLinejoin="round" />}
          {foco !== null && <line x1={x(foco)} x2={x(foco)} y1={MARGEM.topo} y2={MARGEM.topo + alturaUtil} stroke="#9aa5b1" strokeDasharray="3 3" />}
          {dados.map((d, i) => (
            <g key={d.rotulo} onMouseEnter={() => setFoco(i)}>
              <rect x={x(i) - passo / 2} y={MARGEM.topo} width={passo} height={alturaUtil} fill="transparent" />
              {d.valor !== null && <circle cx={x(i)} cy={y(d.valor)} r={foco === i ? 5 : 4} fill={COR_SERIE_1} stroke="#fff" strokeWidth={2} />}
              {i % cadaN === 0 && <text x={x(i)} y={ALTURA - 6} textAnchor="middle" className="grafico-eixo">{rotuloDia(d.rotulo)}</text>}
            </g>
          ))}
        </svg>
        {foco !== null && dados[foco] && (
          <Tooltip x={`${(x(foco) / largura) * 100}%`}>
            <strong>{rotuloDia(dados[foco].rotulo)}</strong>
            <span>{dados[foco].valor === null ? 'sem dados' : `${dados[foco].valor} ${unidade}`}</span>
          </Tooltip>
        )}
        {valores.length === 0 && <div className="grafico-vazio">Sem dados no período.</div>}
      </div>
    </figure>
  );
}

/** Barras horizontais de uma série (ex.: motivos), ordenadas, com o valor ao lado. */
export function BarrasHorizontais({ dados, titulo, cor = COR_SERIE_1, formatar = String }: {
  dados: { rotulo: string; valor: number }[];
  titulo: string;
  cor?: string;
  formatar?: (v: number) => string;
}) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <figure className="grafico">
      <figcaption>{titulo}</figcaption>
      {dados.length === 0 && <div className="grafico-vazio">Sem dados no período.</div>}
      <div className="barras-h">
        {dados.map((d) => (
          <div key={d.rotulo} className="barra-h" title={`${d.rotulo}: ${formatar(d.valor)}`}>
            <span className="barra-h-rotulo">{d.rotulo}</span>
            <span className="barra-h-trilho">
              <span className="barra-h-valor" style={{ width: `${(d.valor / max) * 100}%`, background: cor }} />
            </span>
            <span className="barra-h-numero">{formatar(d.valor)}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
