/** Exportação CSV (separador ";" e BOM para o Excel em pt-BR). */

/**
 * Célula segura: aspas escapadas e neutralização de fórmulas (=, +, -, @) ao abrir no Excel.
 * Números puros (ex.: coordenadas negativas "-9,6512") ficam como estão.
 */
export function celula(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Número com vírgula decimal (Excel pt-BR). */
export const numeroCsv = (n: number | null | undefined): string =>
  n === null || n === undefined ? '' : String(n).replace('.', ',');

export function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: unknown[][]): void {
  const conteudo = [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n');
  const blob = new Blob([`﻿${conteudo}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
