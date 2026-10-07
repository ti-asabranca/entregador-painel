/**
 * Retirar carga da viagem do motorista (ex.: carga antiga esquecida sem prestação de contas que não está mais no
 * caminhão) e lista das retiradas, com a opção de devolver à viagem. A carga retirada some do aplicativo do
 * motorista, do painel e das rotas; fica registrado quem retirou, quando e o motivo.
 */
import { ErroApi, requisitar } from '../api/cliente';
import type { CargaResumo, CargaRetirada } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { useConsulta } from '../hooks/useConsulta';
import { formatarDataHora } from '../util/formatacao';

/** Pede confirmação e motivo e retira a carga. Retorna true se retirou. */
export async function retirarCarga(
  carga: Pick<CargaResumo, 'filial' | 'codigo' | 'seqcar' | 'data'>,
  motorista: string,
  token: string | null,
  escopo: string,
): Promise<boolean> {
  const motivo = window.prompt(
    `Retirar a carga ${carga.codigo}/${carga.seqcar} (${carga.data.split('-').reverse().join('/')}) da viagem de ${motorista}?\n\n`
    + 'Ela deixa de aparecer no aplicativo do motorista, no painel e nas rotas. Se for engano, use "Desfazer" no aviso '
    + 'que aparece em seguida ou "Cargas retiradas" > "Devolver à viagem".\n\n'
    + 'Motivo (opcional):',
    'Carga sem prestação de contas, não está mais no caminhão',
  );
  if (motivo === null) return false;
  try {
    await requisitar(`/gestao/cargas/retirar?${escopo}`, {
      metodo: 'POST', token, corpo: { filial: carga.filial, carga_codigo: carga.codigo, seqcar: carga.seqcar, motivo },
    });
    return true;
  } catch (err) {
    window.alert(err instanceof ErroApi ? err.message : 'Não foi possível retirar a carga.');
    return false;
  }
}

/** Devolve a carga retirada à viagem do motorista. Lança ErroApi em caso de falha. */
export async function devolverCarga(
  carga: { filial: string; codigo: string; seqcar: string },
  token: string | null,
  escopo: string,
): Promise<void> {
  await requisitar(`/gestao/cargas/devolver?${escopo}`, {
    metodo: 'POST', token, corpo: { filial: carga.filial, carga_codigo: carga.codigo, seqcar: carga.seqcar },
  });
}

export function CargasRetiradas({ aoFechar, aoAlterar }: { aoFechar: () => void; aoAlterar: () => void }) {
  const { escopo, token } = useAuth();
  const { dados, erro, atualizar } = useConsulta<{ cargas: CargaRetirada[] }>(`/gestao/cargas/retiradas?${escopo}`, 5 * 60000);

  async function devolver(c: CargaRetirada) {
    if (!window.confirm(`Devolver a carga ${c.codigo}/${c.seqcar} à viagem de ${c.motorista_nome ?? c.motorista}? Ela volta a aparecer no aplicativo.`)) return;
    try {
      await devolverCarga(c, token, escopo);
      atualizar();
      aoAlterar();
    } catch (err) {
      window.alert(err instanceof ErroApi ? err.message : 'Não foi possível devolver a carga.');
    }
  }

  return (
    <div className="modal-fundo" role="dialog" aria-modal="true" aria-labelledby="titulo-retiradas" onClick={aoFechar}>
      <div className="modal modal-largo" onClick={(e) => e.stopPropagation()}>
        <h2 id="titulo-retiradas">Cargas retiradas da viagem</h2>
        <p className="secundario">Cargas em aberto retiradas pela gerência. Saem desta lista quando a prestação de contas é feita no ERP.</p>
        {erro && <div className="aviso erro">{erro}</div>}
        {dados && dados.cargas.length === 0 && <div className="aviso">Nenhuma carga retirada.</div>}
        {dados && dados.cargas.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Carga</th><th>Motorista</th><th>Retirada</th><th /></tr></thead>
              <tbody>
                {dados.cargas.map((c) => (
                  <tr key={`${c.filial}|${c.codigo}|${c.seqcar}`}>
                    <td>
                      <strong>Nº {c.codigo}/{c.seqcar}</strong> · {c.data.split('-').reverse().join('/')}
                      <div className="secundario">Filial {c.filial} · {c.notas} NF{c.rota_descricao ? ` · ${c.rota_descricao}` : ''}</div>
                    </td>
                    <td>{c.motorista_nome ?? '—'}<div className="secundario">{c.motorista}{c.caminhao_placa ? ` · ${c.caminhao_placa}` : ''}</div></td>
                    <td>
                      {formatarDataHora(c.retirada_em)} por {c.retirada_por}
                      {c.retirada_motivo && <div className="secundario">{c.retirada_motivo}</div>}
                    </td>
                    <td><button type="button" className="botao-link" onClick={() => void devolver(c)}>Devolver à viagem</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="modal-acoes"><button type="button" className="botao" onClick={aoFechar}>Fechar</button></div>
      </div>
    </div>
  );
}
