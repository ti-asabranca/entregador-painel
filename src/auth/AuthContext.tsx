/**
 * Sessão do gestor: token guardado em sessionStorage (some ao fechar o navegador; a API também expira em 12 h),
 * empresa selecionada (preferência em localStorage) e ações de login, troca de senha e saída.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { definirAoPerderSessao, requisitar } from '../api/cliente';
import type { Gestor, RespostaLogin } from '../api/tipos';

const CHAVE_SESSAO = 'gestao.sessao';
const CHAVE_EMPRESA = 'gestao.empresa';
const CHAVE_FILIAIS = 'gestao.filiais_filtro';

interface SessaoGuardada {
  token: string;
  gestor: Gestor;
  trocaSenha: boolean;
}

interface Contexto {
  token: string | null;
  gestor: Gestor | null;
  /** Perfil ADMINISTRADOR: acessa o cadastro de usuários. */
  ehAdministrador: boolean;
  trocaSenha: boolean;
  empresa: string;
  definirEmpresa: (e: string) => void;
  /** Filiais liberadas ao usuário na empresa atual; null = todas. */
  filiaisPermitidas: string[] | null;
  /** Filtro de filiais da sessão (vazio = todas as liberadas). */
  filiaisFiltro: string[];
  definirFiliaisFiltro: (f: string[]) => void;
  /** Parâmetros das consultas: "empresa=01&filiais=00,02". */
  escopo: string;
  entrar: (login: string, senha: string) => Promise<void>;
  trocarSenha: (atual: string, nova: string) => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<Contexto | null>(null);

function lerGuardada(): SessaoGuardada | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    return bruto ? (JSON.parse(bruto) as SessaoGuardada) : null;
  } catch {
    return null;
  }
}

function gravar(s: SessaoGuardada | null): void {
  try {
    if (s) sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
    else sessionStorage.removeItem(CHAVE_SESSAO);
  } catch {
    // armazenamento indisponível: a sessão vale só até recarregar a página
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<SessaoGuardada | null>(lerGuardada);
  const [empresa, setEmpresa] = useState<string>(() => {
    try {
      return localStorage.getItem(CHAVE_EMPRESA) || '';
    } catch {
      return '';
    }
  });

  const [filtros, setFiltros] = useState<Record<string, string[]>>(() => {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_FILIAIS) || '{}') as Record<string, string[]>;
    } catch {
      return {};
    }
  });

  const atualizar = useCallback((s: SessaoGuardada | null) => {
    gravar(s);
    setSessao(s);
  }, []);

  useEffect(() => {
    definirAoPerderSessao(() => atualizar(null));
    return () => definirAoPerderSessao(null);
  }, [atualizar]);

  // Ao abrir (ou recarregar), confirma a sessão na API e atualiza perfil/empresas alterados pelo administrador.
  const tokenAtual = sessao?.token;
  useEffect(() => {
    if (!tokenAtual) return;
    let ativo = true;
    requisitar<{ troca_senha_obrigatoria: boolean; gestor: Gestor }>('/gestao/auth/sessao', { token: tokenAtual })
      .then((r) => {
        if (ativo) atualizar({ token: tokenAtual, gestor: r.gestor, trocaSenha: r.troca_senha_obrigatoria });
      })
      .catch(() => undefined); // 401 já volta ao login; sem conexão, mantém a sessão guardada
    return () => {
      ativo = false;
    };
  }, [tokenAtual, atualizar]);

  const entrar = useCallback(async (login: string, senha: string) => {
    const r = await requisitar<RespostaLogin>('/gestao/auth/login', { metodo: 'POST', corpo: { login, senha } });
    atualizar({ token: r.token, gestor: r.gestor, trocaSenha: r.troca_senha_obrigatoria });
  }, [atualizar]);

  const trocarSenha = useCallback(async (atual: string, nova: string) => {
    if (!sessao) return;
    await requisitar('/gestao/auth/alterar-senha', {
      metodo: 'POST', corpo: { senha_atual: atual, nova_senha: nova }, token: sessao.token,
    });
    atualizar({ ...sessao, trocaSenha: false });
  }, [sessao, atualizar]);

  const sair = useCallback(async () => {
    const token = sessao?.token;
    atualizar(null);
    if (token) await requisitar('/gestao/auth/logout', { metodo: 'POST', token }).catch(() => undefined);
  }, [sessao, atualizar]);

  const definirEmpresa = useCallback((e: string) => {
    setEmpresa(e);
    try {
      localStorage.setItem(CHAVE_EMPRESA, e);
    } catch {
      // preferência só nesta aba
    }
  }, []);

  const empresas = sessao?.gestor.empresas ?? [];
  const empresaValida = empresas.includes(empresa) ? empresa : (empresas[0] ?? '');

  // Filiais: permissão do usuário na empresa e filtro da sessão (guardado por usuário/empresa no navegador).
  const filiaisPermitidas = useMemo(() => {
    const da = (sessao?.gestor.filiais ?? []).filter((f) => f.startsWith(`${empresaValida}|`)).map((f) => f.slice(3));
    return da.length ? da : null;
  }, [sessao, empresaValida]);
  const chaveFiltro = `${sessao?.gestor.login}|${empresaValida}`;
  const filiaisFiltro = useMemo(() => {
    const salvo = filtros[chaveFiltro] ?? [];
    // Permissão reduzida pelo administrador: descarta filiais que deixaram de ser liberadas.
    return filiaisPermitidas ? salvo.filter((f) => filiaisPermitidas.includes(f)) : salvo;
  }, [filtros, chaveFiltro, filiaisPermitidas]);
  const definirFiliaisFiltro = useCallback((f: string[]) => {
    setFiltros((atual) => {
      const novo = { ...atual, [chaveFiltro]: [...new Set(f)].sort() };
      try {
        localStorage.setItem(CHAVE_FILIAIS, JSON.stringify(novo));
      } catch {
        // preferência só nesta aba
      }
      return novo;
    });
  }, [chaveFiltro]);
  const escopo = `empresa=${encodeURIComponent(empresaValida)}${
    filiaisFiltro.length ? `&filiais=${encodeURIComponent(filiaisFiltro.join(','))}` : ''}`;

  const valor = useMemo<Contexto>(() => ({
    token: sessao?.token ?? null,
    gestor: sessao?.gestor ?? null,
    ehAdministrador: sessao?.gestor.perfil === 'ADMINISTRADOR',
    trocaSenha: sessao?.trocaSenha ?? false,
    empresa: empresaValida,
    definirEmpresa,
    filiaisPermitidas,
    filiaisFiltro,
    definirFiliaisFiltro,
    escopo,
    entrar,
    trocarSenha,
    sair,
  }), [sessao, empresaValida, definirEmpresa, filiaisPermitidas, filiaisFiltro, definirFiliaisFiltro, escopo,
    entrar, trocarSenha, sair]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): Contexto {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
