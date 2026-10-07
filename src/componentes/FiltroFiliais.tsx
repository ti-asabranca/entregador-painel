/**
 * Filtro de filiais da sessão, na barra superior (sempre visível): mostra as filiais selecionadas e abre uma lista
 * com as filiais que o usuário pode ver na empresa atual (várias de uma vez). Nenhuma marcada = todas as liberadas.
 */
import { useEffect, useRef, useState } from 'react';
import type { Filial } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { useConsulta } from '../hooks/useConsulta';

export function rotuloFilial(f: Filial): string {
  return f.nome ? `${f.filial} - ${f.nome}` : `Filial ${f.filial}`;
}

export function FiltroFiliais() {
  const { empresa, filiaisPermitidas, filiaisFiltro, definirFiliaisFiltro } = useAuth();
  const { dados } = useConsulta<{ filiais: Filial[] }>('/gestao/filiais', 10 * 60000);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [aberto]);

  const opcoes = (dados?.filiais ?? []).filter((f) => f.empresa === empresa);
  const alternar = (filial: string) => definirFiliaisFiltro(
    filiaisFiltro.includes(filial) ? filiaisFiltro.filter((f) => f !== filial) : [...filiaisFiltro, filial],
  );
  const resumo = filiaisFiltro.length === 0
    ? (filiaisPermitidas ? `Minhas filiais (${filiaisPermitidas.join(', ')})` : 'Todas as filiais')
    : `Filial ${filiaisFiltro.join(', ')}`;

  return (
    <div className="filtro-filiais" ref={caixa}>
      <button type="button" className={`filtro-filiais-botao${filiaisFiltro.length ? ' ativo' : ''}`}
        onClick={() => setAberto((a) => !a)} aria-expanded={aberto} aria-haspopup="listbox"
        title="Filtrar as telas por filial (vale para mapa, entregadores, ocorrências e motoristas)">
        <span className="rotulo-filtro">Filiais:</span> {resumo} ▾
      </button>
      {aberto && (
        <div className="filtro-filiais-lista" role="listbox" aria-multiselectable="true">
          <label className="opcao">
            <input type="checkbox" checked={filiaisFiltro.length === 0} onChange={() => definirFiliaisFiltro([])} />
            {filiaisPermitidas ? 'Todas as minhas filiais' : 'Todas as filiais'}
          </label>
          {opcoes.map((f) => (
            <label key={f.filial} className="opcao">
              <input type="checkbox" checked={filiaisFiltro.includes(f.filial)} onChange={() => alternar(f.filial)} />
              {rotuloFilial(f)}
            </label>
          ))}
          {opcoes.length === 0 && <span className="secundario">Nenhuma filial com cargas.</span>}
        </div>
      )}
    </div>
  );
}
