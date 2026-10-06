/**
 * Cadastro dos usuários da gerência (somente perfil ADMINISTRADOR): perfil, empresas liberadas e situação.
 * Novo usuário e "redefinir senha" geram senha temporária automática (troca obrigatória no primeiro login),
 * exibida uma única vez. A API impede desativar/rebaixar o próprio usuário e ficar sem administrador ativo.
 */
import { useState, type FormEvent } from 'react';
import { ErroApi, requisitar } from '../api/cliente';
import type { Perfil, SenhaTemporaria, Usuario } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { useConsulta } from '../hooks/useConsulta';
import { formatarDataHora } from '../util/formatacao';

const EMPRESAS: { codigo: string; nome: string }[] = [
  { codigo: '01', nome: 'Asa Branca' },
  { codigo: '08', nome: 'Rota Distribuidora' },
];
const PERFIS: Record<Perfil, string> = { ADMINISTRADOR: 'Administrador', USUARIO: 'Usuário' };

interface Formulario {
  id: number | null;
  login: string;
  nome: string;
  perfil: Perfil;
  empresas: string[];
  ativo: boolean;
}

const vazio: Formulario = { id: null, login: '', nome: '', perfil: 'USUARIO', empresas: ['01', '08'], ativo: true };

/** Exibe a senha temporária uma única vez, com cópia. */
function DialogoSenha({ senha, aoFechar }: { senha: SenhaTemporaria; aoFechar: () => void }) {
  const [copiada, setCopiada] = useState(false);
  return (
    <div className="modal-fundo" role="dialog" aria-modal="true" aria-labelledby="titulo-senha">
      <div className="modal">
        <h2 id="titulo-senha">Senha temporária de {senha.login}</h2>
        <p>Entregue ao usuário por um canal seguro (pessoalmente ou mensagem direta). Ela será trocada no primeiro acesso.</p>
        <div className="senha-temporaria">
          <code>{senha.senha_temporaria}</code>
          <button type="button" className="botao secundario-botao" onClick={() => {
            void navigator.clipboard?.writeText(senha.senha_temporaria).then(() => setCopiada(true));
          }}>
            {copiada ? 'Copiada' : 'Copiar'}
          </button>
        </div>
        <p className="aviso">Esta senha <strong>não será exibida novamente</strong>. Se perder, use "Redefinir senha".</p>
        <div className="modal-acoes">
          <button type="button" className="botao" onClick={aoFechar}>Já anotei, fechar</button>
        </div>
      </div>
    </div>
  );
}

function FormularioUsuario({ inicial, aoSalvar, aoCancelar }: {
  inicial: Formulario;
  aoSalvar: (f: Formulario) => Promise<void>;
  aoCancelar: () => void;
}) {
  const [f, setF] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const novo = f.id === null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (f.empresas.length === 0) {
      setErro('Selecione ao menos uma empresa.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await aoSalvar(f);
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Não foi possível salvar.');
    } finally {
      setEnviando(false);
    }
  }

  const alternarEmpresa = (codigo: string) => setF((x) => ({
    ...x,
    empresas: x.empresas.includes(codigo) ? x.empresas.filter((e) => e !== codigo) : [...x.empresas, codigo].sort(),
  }));

  return (
    <div className="modal-fundo" role="dialog" aria-modal="true" aria-labelledby="titulo-usuario">
      <form className="modal" onSubmit={enviar}>
        <h2 id="titulo-usuario">{novo ? 'Novo usuário' : `Editar ${f.login}`}</h2>
        {novo && (
          <label>
            Login
            <input value={f.login} onChange={(e) => setF({ ...f, login: e.target.value.toLowerCase() })}
              pattern="[a-z0-9._\-]{3,60}" title="3 a 60 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado"
              placeholder="ex.: joao.silva" autoFocus required />
          </label>
        )}
        <label>
          Nome completo
          <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} minLength={3} maxLength={100}
            autoFocus={!novo} required />
        </label>
        <fieldset>
          <legend>Perfil</legend>
          {(Object.keys(PERFIS) as Perfil[]).map((p) => (
            <label key={p} className="opcao">
              <input type="radio" name="perfil" checked={f.perfil === p} onChange={() => setF({ ...f, perfil: p })} />
              {PERFIS[p]}
              <span className="secundario">
                {p === 'ADMINISTRADOR' ? ' — consulta e cadastra usuários' : ' — só consulta o painel'}
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Empresas com acesso</legend>
          {EMPRESAS.map((e) => (
            <label key={e.codigo} className="opcao">
              <input type="checkbox" checked={f.empresas.includes(e.codigo)} onChange={() => alternarEmpresa(e.codigo)} />
              {e.codigo} - {e.nome}
            </label>
          ))}
        </fieldset>
        {!novo && (
          <label className="opcao">
            <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} />
            Usuário ativo <span className="secundario">(inativo não entra e tem as sessões encerradas)</span>
          </label>
        )}
        {novo && <p className="secundario">A senha temporária é gerada automaticamente ao salvar.</p>}
        {erro && <div className="aviso erro" role="alert">{erro}</div>}
        <div className="modal-acoes">
          <button type="button" className="botao secundario-botao" onClick={aoCancelar}>Cancelar</button>
          <button type="submit" className="botao" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  );
}

export function UsuariosPagina() {
  const { token, gestor } = useAuth();
  const { dados, erro, atualizar } = useConsulta<{ usuarios: Usuario[] }>('/gestao/usuarios', 5 * 60000);
  const [editando, setEditando] = useState<Formulario | null>(null);
  const [senha, setSenha] = useState<SenhaTemporaria | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function salvar(f: Formulario) {
    if (f.id === null) {
      const r = await requisitar<SenhaTemporaria>('/gestao/usuarios', {
        metodo: 'POST', token, corpo: { login: f.login.trim(), nome: f.nome, perfil: f.perfil, empresas: f.empresas },
      });
      setSenha(r);
    } else {
      await requisitar(`/gestao/usuarios/${f.id}`, {
        metodo: 'PUT', token, corpo: { nome: f.nome, perfil: f.perfil, empresas: f.empresas, ativo: f.ativo },
      });
      setMensagem(`Usuário ${f.login} atualizado.`);
    }
    setEditando(null);
    atualizar();
  }

  async function redefinir(u: Usuario) {
    const proprio = u.login === gestor?.login;
    const aviso = proprio
      ? 'Redefinir a SUA senha encerra a sua sessão; você entrará de novo com a senha temporária. Continuar?'
      : `Gerar nova senha temporária para ${u.nome}? As sessões abertas dele serão encerradas.`;
    if (!window.confirm(aviso)) return;
    try {
      setSenha(await requisitar<SenhaTemporaria>(`/gestao/usuarios/${u.id}/redefinir-senha`, { metodo: 'POST', token }));
      atualizar();
    } catch (err) {
      setMensagem(err instanceof ErroApi ? err.message : 'Não foi possível redefinir a senha.');
    }
  }

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>Usuários da gerência</h1>
        <button type="button" className="botao" onClick={() => { setMensagem(null); setEditando({ ...vazio }); }}>
          Novo usuário
        </button>
      </div>
      {mensagem && <div className="aviso">{mensagem}</div>}
      {erro && <div className="aviso erro">{erro}</div>}

      {dados && (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr><th>Usuário</th><th>Perfil</th><th>Empresas</th><th>Situação</th><th>Último acesso</th><th>Cadastro</th><th /></tr>
            </thead>
            <tbody>
              {dados.usuarios.map((u) => (
                <tr key={u.id} className={u.ativo ? undefined : 'linha-inativa'}>
                  <td><strong>{u.nome}</strong><div className="secundario">{u.login}{u.login === gestor?.login ? ' (você)' : ''}</div></td>
                  <td>{PERFIS[u.perfil]}</td>
                  <td>{u.empresas.join(', ')}</td>
                  <td>
                    <span className={`etiqueta ${u.ativo ? 'verde' : 'cinza'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                    {u.troca_senha_pendente && <div className="secundario">aguardando troca de senha</div>}
                    {u.bloqueado && <div className="erro-texto">bloqueado por tentativas</div>}
                  </td>
                  <td>{u.ultimo_login_em ? formatarDataHora(u.ultimo_login_em) : 'nunca'}</td>
                  <td className="secundario">
                    {formatarDataHora(u.criado_em)}{u.criado_por ? ` por ${u.criado_por}` : ''}
                    {u.atualizado_em && <div>alterado {formatarDataHora(u.atualizado_em)} por {u.atualizado_por}</div>}
                  </td>
                  <td className="acoes">
                    <button type="button" className="botao-link" onClick={() => {
                      setMensagem(null);
                      setEditando({ id: u.id, login: u.login, nome: u.nome, perfil: u.perfil, empresas: u.empresas, ativo: u.ativo });
                    }}>Editar</button>
                    <button type="button" className="botao-link" onClick={() => void redefinir(u)}>Redefinir senha</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && <FormularioUsuario inicial={editando} aoSalvar={salvar} aoCancelar={() => setEditando(null)} />}
      {senha && <DialogoSenha senha={senha} aoFechar={() => setSenha(null)} />}
    </main>
  );
}
