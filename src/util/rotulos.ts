/** Rótulos e cores das situações e motivos (códigos da entregador-api). */
import type { CargaResumo, Motorista, Situacao, SituacaoCliente, TipoOcorrencia, Veiculo } from '../api/tipos';

export const SITUACAO: Record<Situacao, { rotulo: string; cor: string; descricao: string }> = {
  ENTREGANDO: { rotulo: 'Entregando', cor: '#1565c0', descricao: 'No cliente (chegada detectada)' },
  ANDANDO: { rotulo: 'Andando', cor: '#2e7d32', descricao: 'Em deslocamento' },
  PARADO: { rotulo: 'Parado', cor: '#ef6c00', descricao: 'Parado fora de cliente, sem pausa registrada' },
  PAUSA: { rotulo: 'Em pausa', cor: '#6a1b9a', descricao: 'Pausa registrada pelo motorista' },
  SEM_SINAL: { rotulo: 'Sem sinal', cor: '#616161', descricao: 'Sem posição há mais de 15 minutos' },
};

export const ORDEM_SITUACOES: Situacao[] = ['ENTREGANDO', 'ANDANDO', 'PARADO', 'PAUSA', 'SEM_SINAL'];

export const SITUACAO_CLIENTE: Record<SituacaoCliente, { rotulo: string; cor: string }> = {
  PENDENTE: { rotulo: 'Pendente', cor: '#9e9e9e' },
  ENTREGUE: { rotulo: 'Entregue', cor: '#2e7d32' },
  PARCIAL: { rotulo: 'Entrega parcial', cor: '#f9a825' },
  NAO_ENTREGUE: { rotulo: 'Não entregue', cor: '#c62828' },
};

export const TIPO_OCORRENCIA: Record<TipoOcorrencia, string> = {
  NOTA_NAO_ENTREGUE: 'Nota não entregue',
  ITEM_DEVOLVIDO: 'Item devolvido',
};

const MOTIVOS: Record<string, string> = {
  // Não entrega do cliente
  DEVOLUCAO_TOTAL: 'Devolução total',
  CLIENTE_FECHADO: 'Cliente fechado',
  ENDERECO_NAO_LOCALIZADO: 'Endereço não localizado',
  REENVIO: 'Reenvio (entrega encerrada)',
  // Devolução de item
  AVARIA: 'Avaria',
  VALIDADE: 'Validade',
  PRODUTO_ERRADO: 'Produto errado',
  FALTA: 'Falta',
  RECUSA_CLIENTE: 'Recusa do cliente',
  OUTRO: 'Outro',
  // Pausa
  REFEICAO: 'Refeição',
  DESCANSO: 'Descanso',
  PERNOITE: 'Pernoite',
  ABASTECIMENTO: 'Abastecimento',
};

export const rotuloMotivo = (codigo: string | null | undefined): string =>
  codigo ? (MOTIVOS[codigo] ?? codigo) : '—';

/** "RGZ3F75 - 000417 - M.BENZ ATEGO 1419/48" (placa, código e descrição; só o que houver). */
export const rotuloVeiculo = (v: Veiculo): string =>
  [v.placa, v.codigo, v.descricao].filter(Boolean).join(' - ');

/** Veículos do motorista (com cadastro DA3 quando a API enviar; senão, só o código DAK_CAMINH). */
export function veiculosDoMotorista(m: Pick<Motorista, 'caminhoes' | 'veiculos'>): string {
  const lista = m.veiculos?.length ? m.veiculos.map(rotuloVeiculo) : m.caminhoes;
  return lista.join(', ') || 'Veículo não informado';
}

/** Rota de entrega da carga (DA8): "MACEIO - LIT (000123)". */
export function rotuloRota(c: Pick<CargaResumo, 'rota_codigo' | 'rota_descricao'>): string | null {
  if (!c.rota_descricao && !c.rota_codigo) return null;
  return c.rota_descricao ? `${c.rota_descricao}${c.rota_codigo ? ` (${c.rota_codigo})` : ''}` : `Rota ${c.rota_codigo}`;
}

/** Texto para busca: códigos e placas dos caminhões, descrições e rotas. */
export function textoBuscaVeiculoRota(m: Pick<Motorista, 'caminhoes' | 'veiculos' | 'cargas'>): string {
  return [
    ...m.caminhoes,
    ...(m.veiculos ?? []).flatMap((v) => [v.placa, v.descricao]),
    ...m.cargas.flatMap((c) => [c.rota_codigo, c.rota_descricao]),
  ].filter(Boolean).join(' ').toLowerCase();
}
