/**
 * Cliente HTTP da entregador-api (/gestao). O token da sessão vai no cabeçalho Authorization (não em cookie:
 * sem risco de CSRF). Erros viram ErroApi com mensagem pronta para a tela.
 */

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';
const TEMPO_LIMITE_MS = 30000;

export class ErroApi extends Error {
  readonly status: number | null;
  readonly codigo: string | null;

  constructor(mensagem: string, status: number | null = null, codigo: string | null = null) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }

  get sessaoInvalida(): boolean {
    return this.status === 401;
  }
}

/** Chamado quando a API responde 401 (sessão expirada/revogada): a aplicação volta ao login. */
let aoPerderSessao: (() => void) | null = null;
export function definirAoPerderSessao(fn: (() => void) | null): void {
  aoPerderSessao = fn;
}

interface Opcoes {
  metodo?: 'GET' | 'POST' | 'PUT';
  corpo?: unknown;
  token?: string | null;
  sinal?: AbortSignal;
}

export async function requisitar<T>(caminho: string, { metodo = 'GET', corpo, token, sinal }: Opcoes = {}): Promise<T> {
  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  sinal?.addEventListener('abort', () => controle.abort());
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
      cache: 'no-store',
    });
  } catch (err) {
    if (sinal?.aborted) throw err;
    throw new ErroApi('Sem conexão com o servidor. Verifique a rede e tente novamente.');
  } finally {
    clearTimeout(tempo);
  }

  if (resposta.status === 204) return undefined as T;
  let dados: unknown = null;
  try {
    dados = await resposta.json();
  } catch {
    // corpo vazio ou não JSON
  }
  if (!resposta.ok) {
    const d = (dados ?? {}) as { erro?: string; codigo?: string };
    const erro = new ErroApi(
      d.erro || (resposta.status >= 500 ? 'Servidor indisponível. Tente novamente em instantes.' : 'Requisição recusada.'),
      resposta.status,
      d.codigo ?? null,
    );
    if (erro.sessaoInvalida && token) aoPerderSessao?.();
    throw erro;
  }
  if (dados === null) throw new ErroApi('Resposta inesperada do servidor.', resposta.status);
  return dados as T;
}
