/**
 * Alertas operacionais em tempo real das viagens em andamento (mesma consulta do aviso global, sem requisição
 * duplicada). Os limites vêm da API (.env da entregador-api) e são exibidos para transparência.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAlertas } from '../alertas/AlertasOcorrencias';
import type { Alerta, TipoAlerta } from '../api/tiposAnalise';
import { formatarDecorrido, formatarHora } from '../util/formatacao';
import { TIPO_ALERTA } from '../util/rotulos';

const GRAVIDADE: Record<Alerta['gravidade'], { rotulo: string; classe: string; icone: string }> = {
  alta: { rotulo: 'Alta', classe: 'vermelha', icone: '▲' },
  media: { rotulo: 'Média', classe: 'amarela', icone: '●' },
  baixa: { rotulo: 'Baixa', classe: 'cinza', icone: '○' },
};

export function AlertasPagina() {
  const { alertas, erroAlertas, alertasNovos, marcarAlertasVistos } = useAlertas();
  // Os novos ficam destacados enquanto a tela está aberta; ao sair, contam como vistos.
  useEffect(() => marcarAlertasVistos, [marcarAlertasVistos]);
  const [tipo, setTipo] = useState<TipoAlerta | ''>('');

  const lista = useMemo(() => (alertas?.alertas ?? []).filter((a) => !tipo || a.tipo === tipo), [alertas, tipo]);
  const porTipo = useMemo(() => {
    const m = new Map<TipoAlerta, number>();
    for (const a of alertas?.alertas ?? []) m.set(a.tipo, (m.get(a.tipo) ?? 0) + 1);
    return m;
  }, [alertas]);
  const l = alertas?.limites;

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>Alertas das viagens em andamento</h1>
        <div className="resumo">
          <span><strong>{alertas?.alertas.length ?? 0}</strong> alertas</span>
          {alertas && <span className="secundario">Atualizado às {formatarHora(alertas.atualizado_em)}</span>}
        </div>
      </div>

      <div className="chips filtro-tipos" role="group" aria-label="Tipo de alerta">
        <button type="button" className={tipo === '' ? 'ativo' : ''} onClick={() => setTipo('')}>Todos</button>
        {(Object.keys(TIPO_ALERTA) as TipoAlerta[]).map((t) => (
          <button key={t} type="button" className={tipo === t ? 'ativo' : ''} onClick={() => setTipo(t)}>
            {TIPO_ALERTA[t]} ({porTipo.get(t) ?? 0})
          </button>
        ))}
      </div>

      {erroAlertas && <div className="aviso erro">{erroAlertas}</div>}
      {alertas && lista.length === 0 && <div className="aviso">Nenhum alerta no momento.</div>}

      {lista.length > 0 && (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead><tr><th>Gravidade</th><th>Tipo</th><th>Motorista</th><th>Situação</th><th>Desde</th></tr></thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.chave} className={alertasNovos.has(a.chave) ? 'linha-nova' : undefined}>
                  <td><span className={`etiqueta ${GRAVIDADE[a.gravidade].classe}`}>
                    <span aria-hidden="true">{GRAVIDADE[a.gravidade].icone} </span>{GRAVIDADE[a.gravidade].rotulo}</span>
                    {alertasNovos.has(a.chave) && <div><span className="etiqueta nova">Novo</span></div>}</td>
                  <td>{TIPO_ALERTA[a.tipo]}</td>
                  <td><Link to={`/motoristas/${a.motorista}`}>{a.nome}</Link><div className="secundario">{a.motorista}</div></td>
                  <td>{a.mensagem}</td>
                  <td>{a.desde ? <>{formatarHora(a.desde)}<div className="secundario">{formatarDecorrido(a.desde)}</div></> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {l && (
        <p className="secundario limites-alerta">
          Regras: parado fora de cliente sem pausa &gt; {l.paradoMin} min · sem conexão &gt; {l.semSinalMin} min ·
          no cliente &gt; {l.clienteMin} min · {l.foraSequencia}+ clientes pulados na rota ideal · direção contínua
          &gt; {l.direcaoMin} min sem parada de {l.descansoMin} min (Lei 13.103/2015) · término previsto após {l.horarioLimite}.
        </p>
      )}
    </main>
  );
}
