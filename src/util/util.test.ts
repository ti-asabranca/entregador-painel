import { describe, expect, it } from 'vitest';
import { formatarDistancia, formatarDuracao, formatarPeso, percentualEntregue } from './formatacao';
import { decodificarPolyline } from './polyline';
import { rotuloMotivo } from './rotulos';

describe('decodificarPolyline', () => {
  it('decodifica o exemplo de referência do algoritmo (precisão 5)', () => {
    expect(decodificarPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it('texto vazio → nenhum ponto', () => {
    expect(decodificarPolyline('')).toEqual([]);
  });
});

describe('formatação', () => {
  it('peso, distância e duração em pt-BR', () => {
    expect(formatarPeso(1520.25)).toBe('1.520,3 kg');
    expect(formatarPeso(null)).toBe('—');
    expect(formatarDistancia(850)).toBe('850 m');
    expect(formatarDistancia(42300)).toBe('42,3 km');
    expect(formatarDuracao(25 * 60)).toBe('25 min');
    expect(formatarDuracao(95 * 60)).toBe('1 h 35 min');
    expect(formatarDuracao(120 * 60)).toBe('2 h');
  });

  it('percentual do peso entregue limitado a 0–100; sem total → null', () => {
    expect(percentualEntregue(1000, 250)).toBe(75);
    expect(percentualEntregue(1000, 1200)).toBe(0);
    expect(percentualEntregue(null, 10)).toBeNull();
  });

  it('motivo desconhecido aparece com o código', () => {
    expect(rotuloMotivo('REENVIO')).toBe('Reenvio (entrega encerrada)');
    expect(rotuloMotivo('NOVO_MOTIVO')).toBe('NOVO_MOTIVO');
    expect(rotuloMotivo(null)).toBe('—');
  });
});

describe('caminhão (DA3) e rota (DA8)', async () => {
  const { rotuloRota, rotuloVeiculo, veiculosDoMotorista } = await import('./rotulos');

  it('veículo com placa, código e descrição; sem cadastro usa o código', () => {
    expect(rotuloVeiculo({ placa: 'RGZ3F75', codigo: '000417', descricao: 'M.BENZ ATEGO' })).toBe('RGZ3F75 - 000417 - M.BENZ ATEGO');
    expect(veiculosDoMotorista({ caminhoes: ['000417'], veiculos: [] })).toBe('000417');
    expect(veiculosDoMotorista({ caminhoes: [] })).toBe('Veículo não informado');
  });

  it('rota com descrição e código; só código; nenhuma', () => {
    expect(rotuloRota({ rota_codigo: '000123', rota_descricao: 'MACEIO - LIT' })).toBe('MACEIO - LIT (000123)');
    expect(rotuloRota({ rota_codigo: '000123', rota_descricao: null })).toBe('Rota 000123');
    expect(rotuloRota({})).toBeNull();
  });
});
