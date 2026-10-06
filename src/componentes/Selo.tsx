import type { Situacao, SituacaoCliente } from '../api/tipos';
import { SITUACAO, SITUACAO_CLIENTE } from '../util/rotulos';

/** Selo colorido da situação do motorista. */
export function SeloSituacao({ situacao }: { situacao: Situacao }) {
  const s = SITUACAO[situacao];
  return (
    <span className="selo" style={{ backgroundColor: s.cor }} title={s.descricao}>
      {s.rotulo}
    </span>
  );
}

/** Ponto colorido + rótulo da situação do cliente. */
export function MarcaCliente({ situacao, ordem }: { situacao: SituacaoCliente; ordem?: number | null }) {
  const s = SITUACAO_CLIENTE[situacao];
  return (
    <span className="marca-cliente" style={{ backgroundColor: s.cor }} title={s.rotulo} aria-label={s.rotulo}>
      {ordem ?? ''}
    </span>
  );
}
