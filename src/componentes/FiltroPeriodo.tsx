/** Filtro de período (de/até) com atalhos, numa linha acima dos gráficos e tabelas. */
const hojeIso = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // fuso de operação (UTC−3)
const diasAtras = (n: number) => new Date(Date.now() - 3 * 3600e3 - n * 864e5).toISOString().slice(0, 10);

export interface ValorPeriodo {
  de: string;
  ate: string;
}

export const periodoPadrao = (): ValorPeriodo => ({ de: diasAtras(6), ate: hojeIso() });

const ATALHOS: [string, () => ValorPeriodo][] = [
  ['Hoje', () => ({ de: hojeIso(), ate: hojeIso() })],
  ['7 dias', () => ({ de: diasAtras(6), ate: hojeIso() })],
  ['30 dias', () => ({ de: diasAtras(29), ate: hojeIso() })],
  ['90 dias', () => ({ de: diasAtras(89), ate: hojeIso() })],
];

export function FiltroPeriodo({ valor, aoMudar, maxDias = 92 }: {
  valor: ValorPeriodo;
  aoMudar: (v: ValorPeriodo) => void;
  maxDias?: number;
}) {
  const atalhos = ATALHOS.filter(([, f]) => {
    const p = f();
    return (new Date(p.ate).getTime() - new Date(p.de).getTime()) / 864e5 <= maxDias;
  });
  return (
    <div className="filtro-periodo" role="group" aria-label="Período">
      <div className="chips">
        {atalhos.map(([rotulo, f]) => {
          const p = f();
          const ativo = p.de === valor.de && p.ate === valor.ate;
          return (
            <button key={rotulo} type="button" className={ativo ? 'ativo' : ''} onClick={() => aoMudar(p)}>{rotulo}</button>
          );
        })}
      </div>
      <label>De <input type="date" value={valor.de} max={valor.ate} onChange={(e) => e.target.value && aoMudar({ ...valor, de: e.target.value })} /></label>
      <label>Até <input type="date" value={valor.ate} min={valor.de} max={hojeIso()} onChange={(e) => e.target.value && aoMudar({ ...valor, ate: e.target.value })} /></label>
    </div>
  );
}
