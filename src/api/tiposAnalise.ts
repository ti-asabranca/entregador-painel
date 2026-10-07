/** Tipos das análises e alertas (entregador-api: gestaoAnaliseService.js e gestaoAlertasService.js). */

export interface Periodo {
  de: string;
  ate: string;
}

export interface IndicadorMotorista {
  motorista: string;
  nome: string | null;
  clientes_concluidos: number;
  clientes_entregues: number;
  clientes_parciais: number;
  clientes_nao_entregues: number;
  taxa_sucesso: number | null;
  notas_entregues: number;
  itens_entregues: number;
  itens_devolvidos: number;
  visitas: number;
  tempo_medio_cliente_s: number | null;
  minutos_por_item: number | null;
  km: number | null;
}

export interface Indicadores {
  periodo: Periodo;
  resumo: {
    motoristas: number;
    clientes_concluidos: number;
    clientes_entregues: number;
    clientes_parciais: number;
    clientes_nao_entregues: number;
    taxa_sucesso: number | null;
    notas_entregues: number;
    itens_entregues: number;
    itens_devolvidos: number;
    visitas: number;
    tempo_medio_cliente_s: number | null;
    km: number;
  };
  motoristas: IndicadorMotorista[];
  clientes_demorados: {
    codigo: string;
    loja: string;
    nome: string | null;
    municipio: string | null;
    visitas: number;
    media_cliente_s: number;
    mediana_cliente_s: number;
    media_ate_concluir_s: number | null;
  }[];
  motivos: { tipo: 'NAO_ENTREGA' | 'DEVOLUCAO'; motivo: string; quantidade: number }[];
  evolucao: { dia: string; concluidos: number; entregues: number; media_cliente_s: number | null }[];
}

export type TipoAlerta = 'SEM_SINAL' | 'PARADO' | 'CLIENTE_DEMORADO' | 'FORA_SEQUENCIA' | 'DIRECAO_CONTINUA' | 'ATRASO';

export interface Alerta {
  chave: string;
  tipo: TipoAlerta;
  gravidade: 'alta' | 'media' | 'baixa';
  motorista: string;
  nome: string;
  mensagem: string;
  desde: string | null;
}

export interface RespostaAlertas {
  atualizado_em: string;
  limites: Record<string, number | string>;
  alertas: Alerta[];
}

export interface EventoLinhaDoTempo {
  em: string;
  tipo: string;
  cliente_codigo: string | null;
  cliente_loja: string | null;
  cliente_nome: string | null;
  detalhe: string | null;
  inicio: string | null;
  motivo: string | null;
}

export interface LinhaDoTempo {
  dia: string;
  eventos: EventoLinhaDoTempo[];
  /** [horário ISO, latitude, longitude, velocidade m/s] */
  percurso: [string, number, number, number | null][];
}

export interface Reenvio {
  filial: string;
  carga_codigo: string;
  seqcar: string;
  nf_doc: string;
  nf_serie: string;
  pedido: string | null;
  cliente_codigo: string;
  cliente_loja: string;
  cliente_nome: string | null;
  municipio: string | null;
  motorista: string | null;
  motorista_nome: string | null;
  descricao: string | null;
  ocorrido_em: string;
}

export interface Devolucao {
  filial: string;
  nf_doc: string;
  nf_serie: string;
  item: string;
  produto: string | null;
  produto_descricao: string | null;
  unidade: string | null;
  quantidade: number;
  quantidade_nota: number | null;
  motivo: string;
  descricao: string | null;
  motorista: string | null;
  motorista_nome: string | null;
  devolvido_em: string;
  valor: number | null;
  peso: number | null;
  cliente_codigo: string | null;
  cliente_loja: string | null;
  cliente_nome: string | null;
}

export interface Fechamento {
  periodo: Periodo;
  reenvios: Reenvio[];
  devolucoes: Devolucao[];
  devolucoes_por_motivo: { motivo: string; itens: number; valor: number; peso: number; sem_valor: number }[];
}

export interface ClienteCoordenada {
  codigo: string;
  loja: string;
  nome: string | null;
  razao_social: string | null;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  situacao: 'SEM_COORDENADA' | 'SUSPEITA';
  amostras: number;
  latitude_sugerida: number | null;
  longitude_sugerida: number | null;
  distancia_m: number | null;
}

export interface Coordenadas {
  dias: number;
  limite_m: number;
  clientes: ClienteCoordenada[];
}

export interface CamadasMapa {
  periodo: Periodo;
  percursos: { motorista: string; linha: [number, number][] }[];
  ocorrencias: [number, number, string][];
}
