/**
 * Consulta à API com atualização periódica. Pausa enquanto a aba está oculta (economiza servidor e OSRM) e
 * atualiza ao voltar. Mantém os últimos dados em caso de erro temporário.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErroApi, requisitar } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';

export interface Consulta<T> {
  dados: T | null;
  erro: string | null;
  carregando: boolean;
  atualizar: () => void;
}

export function useConsulta<T>(caminho: string | null, intervaloMs: number): Consulta<T> {
  const { token } = useAuth();
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const atual = useRef<AbortController | null>(null);

  const buscar = useCallback(async () => {
    if (!caminho || !token) return;
    atual.current?.abort();
    const controle = new AbortController();
    atual.current = controle;
    setCarregando(true);
    try {
      const r = await requisitar<T>(caminho, { token, sinal: controle.signal });
      if (!controle.signal.aborted) {
        setDados(r);
        setErro(null);
      }
    } catch (e) {
      if (!controle.signal.aborted) setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar os dados.');
    } finally {
      if (atual.current === controle) setCarregando(false);
    }
  }, [caminho, token]);

  useEffect(() => {
    setDados(null);
    void buscar();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void buscar();
    }, intervaloMs);
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void buscar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
      atual.current?.abort();
    };
  }, [buscar, intervaloMs]);

  return { dados, erro, carregando, atualizar: () => void buscar() };
}
