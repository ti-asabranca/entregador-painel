/** Formatação pt-BR (números, peso, distância, tempo). */

const numero = (casas: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });

export const formatarPeso = (kg: number | null | undefined): string =>
  kg === null || kg === undefined ? '—' : `${numero(1).format(kg)} kg`;

export const formatarDistancia = (m: number | null | undefined): string => {
  if (m === null || m === undefined) return '—';
  return m < 1000 ? `${Math.round(m)} m` : `${numero(1).format(m / 1000)} km`;
};

export const formatarDuracao = (s: number | null | undefined): string => {
  if (s === null || s === undefined) return '—';
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 === 0 ? `${h} h` : `${h} h ${String(min % 60).padStart(2, '0')} min`;
};

export const formatarHora = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

export const formatarDataHora = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

/** "há 5 min", "há 2 h 10 min". */
export function formatarDecorrido(iso: string | null | undefined, agora = Date.now()): string {
  if (!iso) return '—';
  const s = Math.max(0, (agora - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  return `há ${formatarDuracao(s)}`;
}

/** Percentual (0–100) do peso já entregue. */
export function percentualEntregue(total: number | null, restante: number | null): number | null {
  if (!total || total <= 0 || restante === null) return null;
  return Math.min(100, Math.max(0, Math.round(((total - restante) / total) * 100)));
}
