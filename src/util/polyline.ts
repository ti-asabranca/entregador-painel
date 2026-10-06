/** Decodifica polyline (algoritmo do Google, precisão 5 — formato do OSRM usado pela entregador-api). */
export function decodificarPolyline(texto: string, precisao = 5): [number, number][] {
  const fator = 10 ** precisao;
  const pontos: [number, number][] = [];
  let indice = 0;
  let lat = 0;
  let lng = 0;
  while (indice < texto.length) {
    for (const eixo of [0, 1]) {
      let resultado = 0;
      let deslocamento = 0;
      let byte: number;
      do {
        byte = texto.charCodeAt(indice++) - 63;
        resultado |= (byte & 0x1f) << deslocamento;
        deslocamento += 5;
      } while (byte >= 0x20 && indice < texto.length);
      const delta = resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
      if (eixo === 0) lat += delta;
      else lng += delta;
    }
    pontos.push([lat / fator, lng / fator]);
  }
  return pontos;
}
