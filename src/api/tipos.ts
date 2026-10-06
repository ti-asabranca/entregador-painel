/** Tipos das respostas de /gestao (entregador-api/services/gestaoService.js). */

export type Situacao = 'PAUSA' | 'ENTREGANDO' | 'ANDANDO' | 'PARADO' | 'SEM_SINAL';
export type SituacaoCliente = 'PENDENTE' | 'ENTREGUE' | 'NAO_ENTREGUE' | 'PARCIAL';

export type Perfil = 'ADMINISTRADOR' | 'USUARIO';

export interface Gestor {
  login: string;
  nome: string;
  empresas: string[];
  /** Ausente em sessões antigas (antes dos perfis): tratado como USUARIO. */
  perfil?: Perfil;
}

/** Usuário da gerência (tela de administração). */
export interface Usuario {
  id: number;
  login: string;
  nome: string;
  perfil: Perfil;
  empresas: string[];
  ativo: boolean;
  troca_senha_pendente: boolean;
  bloqueado: boolean;
  ultimo_login_em: string | null;
  criado_em: string;
  criado_por: string | null;
  atualizado_em: string | null;
  atualizado_por: string | null;
}

export interface SenhaTemporaria {
  login: string;
  senha_temporaria: string;
}

export interface RespostaLogin {
  token: string;
  expira_em: string;
  troca_senha_obrigatoria: boolean;
  gestor: Gestor;
}

export interface CargaResumo {
  filial: string;
  codigo: string;
  seqcar: string;
  data: string;
  hora: string | null;
  peso: number | null;
  caminhao: string | null;
}

export interface Posicao {
  latitude: number;
  longitude: number;
  velocidade_kmh: number | null;
  precisao_m: number | null;
  em: string;
}

export interface Motorista {
  codigo: string;
  nome: string;
  situacao: Situacao;
  caminhoes: string[];
  cargas: CargaResumo[];
  peso_total: number | null;
  peso_restante: number;
  peso_restante_incompleto: boolean;
  posicao: Posicao | null;
  pausa: { motivo: string; descricao: string | null; desde: string } | null;
  visita: { cliente_codigo: string; cliente_loja: string; cliente_nome: string | null; desde: string } | null;
  ultima_conexao: string | null;
  inicio_entregas: string | null;
  notas_total: number;
  notas_entregues: number;
  clientes_total: number;
  clientes_entregues: number;
  clientes_nao_entregues: number;
  clientes_parciais: number;
  clientes_pendentes: number;
}

/** Cliente na lista do painel: concluídos primeiro, depois pendentes na ordem da rota. */
export interface ClienteLista {
  codigo: string;
  loja: string;
  nome: string | null;
  municipio: string | null;
  situacao: SituacaoCliente;
  ordem: number | null;
}

/** Motorista no painel (lista e mapa). */
export interface MotoristaPainel extends Motorista {
  /** Ordem dos pendentes: melhor rota (calculada pela API), rota vigente do motorista ou sequência do ERP. */
  ordem_rota: 'MELHOR' | 'VIGENTE' | 'ERP';
  melhor_rota_m: number | null;
  melhor_rota_s: number | null;
  rota_vigente: { origem: string; criterio: string; distancia_m: number | null; duracao_s: number | null } | null;
  clientes: ClienteLista[];
}

export interface Painel {
  atualizado_em: string;
  empresa: string;
  resumo: {
    motoristas: number;
    por_situacao: Partial<Record<Situacao, number>>;
    clientes_pendentes: number;
    peso_restante: number;
  };
  motoristas: MotoristaPainel[];
}

export interface ClienteViagem {
  codigo: string;
  loja: string;
  nome: string | null;
  razao_social: string | null;
  endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  latitude: number | null;
  longitude: number | null;
  situacao: SituacaoCliente;
  motivo: string | null;
  descricao: string | null;
  concluido_em: string | null;
  notas: number;
  notas_entregues: number;
  peso_pendente: number;
  peso_incompleto: boolean;
  ordem: number | null;
  distancia_acumulada_m: number | null;
  duracao_acumulada_s: number | null;
}

export interface ParadaRota {
  sequencia: number;
  cliente_codigo: string;
  cliente_loja: string;
  distancia_acumulada_m: number | null;
  duracao_acumulada_s: number | null;
  sem_coordenadas: boolean;
}

export interface Rota {
  versao: number | null;
  origem: string;
  criterio: string;
  partida_tipo: string;
  distancia_m: number | null;
  duracao_s: number | null;
  calculado_em: string;
  paradas: ParadaRota[];
  geometria: string | null;
}

export interface DetalheMotorista extends Motorista {
  deposito: { nome: string | null; latitude: number; longitude: number } | null;
  clientes: ClienteViagem[];
  rota_vigente: Rota | null;
  melhor_rota: Rota | null;
  melhor_rota_aviso: string | null;
  percurso: [number, number][];
  percurso_desde: string | null;
}

export type TipoOcorrencia = 'NOTA_NAO_ENTREGUE' | 'ITEM_DEVOLVIDO';

export interface Ocorrencia {
  tipo: TipoOcorrencia;
  motorista: string | null;
  motorista_nome: string | null;
  filial: string;
  carga_codigo: string;
  seqcar: string;
  caminhao: string | null;
  cliente_codigo: string;
  cliente_loja: string;
  cliente_nome: string | null;
  municipio: string | null;
  nf_doc: string;
  nf_serie: string;
  pedido: string | null;
  item: string | null;
  produto: string | null;
  produto_descricao: string | null;
  quantidade: number | null;
  quantidade_nota: number | null;
  unidade: string | null;
  resultado: string | null;
  motivo: string | null;
  descricao: string | null;
  ocorrido_em: string | null;
}

export interface RespostaOcorrencias {
  atualizado_em: string;
  ocorrencias: Ocorrencia[];
}
