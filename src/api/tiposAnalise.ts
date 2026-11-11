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

export type OrigemCoordenada = 'SUGERIDA' | 'MANUAL' | 'ENDERECO';

export interface ClienteCoordenada {
  codigo: string;
  loja: string;
  nome: string | null;
  razao_social: string | null;
  endereco: string | null;
  municipio: string | null;
  uf: string | null;
  /** Coordenada vigente: a corrigida pela gerência ou, sem ela, a do ERP. */
  latitude: number | null;
  longitude: number | null;
  /** ENTREGADOR = corrigida pela gerência (banco do entregador); ERP = A1_IONLAT/A1_IONLONG. */
  fonte: 'ENTREGADOR' | 'ERP' | null;
  latitude_erp: number | null;
  longitude_erp: number | null;
  corrigida_origem: OrigemCoordenada | null;
  corrigida_em: string | null;
  corrigida_por: string | null;
  situacao: 'SEM_COORDENADA' | 'SUSPEITA' | 'OK';
  amostras: number;
  latitude_sugerida: number | null;
  longitude_sugerida: number | null;
  distancia_m: number | null;
}

export interface EnderecoEncontrado {
  descricao: string;
  latitude: number;
  longitude: number;
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

/** Métricas somáveis da produtividade (por carga, por motorista e total). */
export interface MetricasProdutividade {
  pontos: number;
  concluidos: number;
  /** Clientes ENTREGUE ou PARCIAL. */
  entregas: number;
  entregas_dia1: number;
  entregas_dia2: number;
  entregas_dia3_mais: number;
  parciais: number;
  nao_entregues: number;
  notas: number;
  notas_entregues: number;
  itens: number;
  quantidade: number;
  quantidade_entregue: number;
  peso: number;
  peso_entregue: number;
  valor: number;
  valor_entregue: number;
  fonte_geocerca: number;
  fonte_gps: number;
  sem_comprovacao: number;
  marcadas_depois: number;
  tempo_medio_s: number | null;
  peso_incompleto: boolean;
}

export interface ProdutividadeTotal extends MetricasProdutividade {
  viagens: number;
  cargas: number;
  km_previsto: number;
  cargas_sem_km: number;
  abertas: number;
}

export interface ProdutividadeMotorista extends ProdutividadeTotal {
  motorista: string;
  nome: string | null;
}

export interface ProdutividadeSintetico {
  periodo: Periodo;
  motoristas: ProdutividadeMotorista[];
  total: ProdutividadeTotal;
}

export interface ProdutividadeCarga extends MetricasProdutividade {
  filial: string;
  carga_codigo: string;
  seqcar: string;
  motorista: string;
  motorista_nome: string | null;
  data_carga: string;
  caminhao: string | null;
  caminhao_placa: string | null;
  rota_descricao: string | null;
  peso_carga: number | null;
  prestacao_contas: string | null;
  fechada: boolean;
  viagem_id: string;
  viagem_saida_em: string;
  viagem_saida_dia: string;
  viagem_saida_fonte: 'DEPOSITO' | 'PRIMEIRA_ENTREGA';
  viagem_retorno_em: string | null;
  viagem_km_previsto: number | null;
  viagem_cargas: number;
  rota_erro: string | null;
  clientes_sem_coordenada: number | null;
  km_previsto: number | null;
  km_pendente: boolean;
  dias_viagem: number | null;
}

export interface ProdutividadeCargas {
  periodo: Periodo;
  cargas: ProdutividadeCarga[];
}

export interface ProdutividadeEntrega {
  filial: string;
  carga_codigo: string;
  seqcar: string;
  motorista: string;
  motorista_nome: string | null;
  cliente_codigo: string;
  cliente_loja: string;
  cliente_nome: string | null;
  municipio: string | null;
  resultado: 'ENTREGUE' | 'PARCIAL' | 'NAO_ENTREGUE';
  motivo: string | null;
  modo: 'NOTAS' | 'CLIENTE' | 'VIAGEM';
  marcada_em: string;
  efetiva_em: string;
  fonte: 'GEOCERCA' | 'GPS' | 'MARCACAO';
  sem_comprovacao: boolean;
  chegada_em: string | null;
  saida_em: string | null;
  permanencia_s: number | null;
  atraso_marcacao_s: number | null;
  marcada_depois: boolean;
  dia_viagem: number;
  viagem_saida_em: string;
  notas: number;
  notas_entregues: number;
  itens: number;
  quantidade: number;
  quantidade_entregue: number;
  peso: number;
  peso_entregue: number;
  valor: number;
  valor_entregue: number;
  peso_incompleto: boolean;
}

export interface ProdutividadeEntregas {
  periodo: Periodo;
  entregas: ProdutividadeEntrega[];
}
