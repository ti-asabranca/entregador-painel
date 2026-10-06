/**
 * Ícones dos marcadores do mapa (Leaflet divIcon). O HTML usa apenas cores e números gerados aqui — nomes e
 * textos vindos da API vão nos Tooltips do React (escapados), nunca neste HTML.
 */
import L from 'leaflet';
import type { Situacao, SituacaoCliente } from '../api/tipos';
import { SITUACAO, SITUACAO_CLIENTE } from '../util/rotulos';

const cacheMotorista = new Map<string, L.DivIcon>();

/** Caminhão na cor da situação; selecionado = maior com contorno. */
export function iconeMotorista(situacao: Situacao, selecionado = false): L.DivIcon {
  const chave = `${situacao}|${selecionado}`;
  let icone = cacheMotorista.get(chave);
  if (!icone) {
    const tamanho = selecionado ? 44 : 36;
    icone = L.divIcon({
      className: 'icone-mapa',
      iconSize: [tamanho, tamanho],
      iconAnchor: [tamanho / 2, tamanho / 2],
      html: `<div class="icone-motorista${selecionado ? ' selecionado' : ''}" style="background:${SITUACAO[situacao].cor}">
        <svg viewBox="0 0 24 24" width="60%" height="60%" aria-hidden="true"><path fill="#fff"
          d="M3 6h11v9H3zM14 9h4l3 3.5V15h-7zM6.5 18.5a1.75 1.75 0 1 0 0-.01zM17 18.5a1.75 1.75 0 1 0 0-.01z"/></svg>
      </div>`,
    });
    cacheMotorista.set(chave, icone);
  }
  return icone;
}

/** Cliente: círculo na cor da situação, com o número na ordem da melhor rota (pendentes). */
export function iconeCliente(situacao: SituacaoCliente, ordem: number | null): L.DivIcon {
  const texto = ordem === null ? '' : String(Math.trunc(ordem));
  return L.divIcon({
    className: 'icone-mapa',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div class="icone-cliente" style="background:${SITUACAO_CLIENTE[situacao].cor}">${texto}</div>`,
  });
}

export const iconeDeposito = L.divIcon({
  className: 'icone-mapa',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html: `<div class="icone-deposito" title="Depósito">
    <svg viewBox="0 0 24 24" width="70%" height="70%" aria-hidden="true"><path fill="#fff" d="M12 3 2 8v13h20V8zm-6 16v-8h12v8z"/></svg>
  </div>`,
});
