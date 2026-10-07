/**
 * Cadastro dos motoristas (somente consulta: inclusão e alteração são exclusivas do ERP, pela API). A única ação é
 * resetar a senha do aplicativo para o padrão (CPF), com troca obrigatória no próximo login — desbloqueia o acesso e
 * encerra as sessões abertas. Usuário restrito por filial vê os motoristas com carga nas filiais dele.
 */
import { useMemo, useState } from 'react';
import { ErroApi, requisitar } from '../api/cliente';
import type { Entregador } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { useConsulta } from '../hooks/useConsulta';
import { formatarDataHora } from '../util/formatacao';

type Filtro = 'ATIVOS' | 'BLOQUEADOS' | 'SENHA_PADRAO' | 'TODOS';

function situacaoAcesso(e: Entregador): { texto: string; classe: string } {
  if (e.deletado) return { texto: 'Deletado no ERP', classe: 'cinza' };
  if (e.sem_senha) return { texto: 'Sem acesso (CPF inválido no ERP)', classe: 'vermelha' };
  if (e.bloqueado) return { texto: 'Bloqueado por tentativas', classe: 'vermelha' };
  if (e.senha_padrao) return { texto: 'Senha padrão (CPF) — troca pendente', classe: 'amarela' };
  return { texto: 'Senha própria', classe: 'verde' };
}

export function CadastroMotoristasPagina() {
  const { escopo, token } = useAuth();
  const { dados, erro, atualizar } = useConsulta<{ entregadores: Entregador[] }>(`/gestao/entregadores?${escopo}`, 5 * 60000);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('ATIVOS');
  const [mensagem, setMensagem] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [resetando, setResetando] = useState<string | null>(null);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (dados?.entregadores ?? [])
      .filter((e) => filtro === 'TODOS'
        || (filtro === 'ATIVOS' && !e.deletado)
        || (filtro === 'BLOQUEADOS' && !e.deletado && (e.bloqueado || e.sem_senha))
        || (filtro === 'SENHA_PADRAO' && !e.deletado && e.senha_padrao))
      .filter((e) => !termo || e.nome.toLowerCase().includes(termo) || e.codigo.includes(termo));
  }, [dados, busca, filtro]);

  async function resetar(e: Entregador) {
    const aviso = `Resetar a senha do aplicativo de ${e.nome} (${e.codigo})?\n\n`
      + 'A senha volta a ser o CPF do motorista (somente números) e ele terá de criar uma nova no próximo login. '
      + 'O acesso é desbloqueado e o aplicativo aberto em outro aparelho é desconectado.';
    if (!window.confirm(aviso)) return;
    setResetando(e.codigo);
    setMensagem(null);
    try {
      await requisitar(`/gestao/entregadores/${e.codigo}/resetar-senha?${escopo}`, { metodo: 'POST', token });
      setMensagem({ texto: `Senha de ${e.nome} resetada. Oriente o motorista a entrar com o CPF (só números) e criar uma nova senha.` });
      atualizar();
    } catch (err) {
      setMensagem({ texto: err instanceof ErroApi ? err.message : 'Não foi possível resetar a senha.', erro: true });
    } finally {
      setResetando(null);
    }
  }

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>Motoristas</h1>
        <span className="secundario">Cadastro mantido pelo ERP. Aqui só é possível resetar a senha do aplicativo.</span>
      </div>
      <div className="filtros">
        <input type="search" placeholder="Buscar por nome ou código" value={busca} onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar motorista" />
        <div className="chips" role="group" aria-label="Filtrar">
          {([['ATIVOS', 'Ativos'], ['BLOQUEADOS', 'Sem acesso / bloqueados'], ['SENHA_PADRAO', 'Senha padrão'], ['TODOS', 'Todos']] as [Filtro, string][])
            .map(([v, r]) => (
              <button key={v} type="button" className={filtro === v ? 'ativo' : ''} onClick={() => setFiltro(v)}>{r}</button>
            ))}
        </div>
      </div>
      {mensagem && <div className={`aviso${mensagem.erro ? ' erro' : ''}`} role="status">{mensagem.texto}</div>}
      {erro && <div className="aviso erro">{erro}</div>}
      {dados && lista.length === 0 && <div className="aviso">Nenhum motorista neste filtro.</div>}
      {lista.length > 0 && (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr><th>Motorista</th><th>CPF</th><th>Acesso ao aplicativo</th><th>Último login</th><th>Última carga</th><th>Reset de senha</th><th /></tr>
            </thead>
            <tbody>
              {lista.map((e) => {
                const s = situacaoAcesso(e);
                return (
                  <tr key={e.codigo} className={e.deletado ? 'linha-inativa' : undefined}>
                    <td><strong>{e.nome}</strong><div className="secundario">{e.codigo}</div></td>
                    <td>{e.cpf ?? '—'}{!e.cpf_valido && <div className="erro-texto">inválido</div>}</td>
                    <td>
                      <span className={`etiqueta ${s.classe}`}>{s.texto}</span>
                      {e.sessoes_ativas > 0 && <div className="secundario">{e.sessoes_ativas} sessão(ões) ativa(s)</div>}
                    </td>
                    <td>{e.ultimo_login_em ? formatarDataHora(e.ultimo_login_em) : 'nunca'}</td>
                    <td>{e.ultima_carga ? e.ultima_carga.split('-').reverse().join('/') : '—'}</td>
                    <td className="secundario">
                      {e.senha_resetada_em ? `${formatarDataHora(e.senha_resetada_em)} por ${e.senha_resetada_por}` : '—'}
                    </td>
                    <td className="acoes">
                      <button type="button" className="botao-link" disabled={e.deletado || !e.cpf_valido || resetando === e.codigo}
                        title={e.deletado ? 'Motorista deletado no ERP' : !e.cpf_valido ? 'Corrija o CPF no ERP' : 'Senha volta a ser o CPF'}
                        onClick={() => void resetar(e)}>
                        {resetando === e.codigo ? 'Resetando…' : 'Resetar senha'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
