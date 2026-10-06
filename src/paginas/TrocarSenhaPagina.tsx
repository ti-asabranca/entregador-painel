import { useState, type FormEvent } from 'react';
import { ErroApi } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';

/** Troca da senha temporária (obrigatória no primeiro acesso). Regras validadas também na API. */
export function TrocarSenhaPagina() {
  const { gestor, trocarSenha, sair } = useAuth();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (nova !== confirmacao) {
      setErro('A confirmação não confere com a nova senha.');
      return;
    }
    setEnviando(true);
    try {
      await trocarSenha(atual, nova);
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="tela-login">
      <form className="cartao-login" onSubmit={enviar}>
        <h1>Defina sua senha</h1>
        <p className="secundario">
          Olá, {gestor?.nome}. Troque a senha temporária para continuar. Use ao menos 10 caracteres, com letras e números.
        </p>
        <label>
          Senha temporária
          <input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" required />
        </label>
        <label>
          Nova senha
          <input type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password"
            minLength={10} required />
        </label>
        <label>
          Confirme a nova senha
          <input type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)}
            autoComplete="new-password" required />
        </label>
        {erro && <div className="aviso erro" role="alert">{erro}</div>}
        <button type="submit" className="botao" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar nova senha'}</button>
        <button type="button" className="botao-link" onClick={() => void sair()}>Sair</button>
      </form>
    </main>
  );
}
