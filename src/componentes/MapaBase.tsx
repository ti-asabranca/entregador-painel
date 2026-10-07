/** Mapa OpenStreetMap (Leaflet) com enquadramento automático dos pontos informados. */
import { useEffect, useRef, type ReactNode } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

const TILES = (import.meta.env.VITE_MAPA_TILES_URL as string | undefined) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUICAO = '&copy; <a href="https://www.openstreetmap.org/copyright">Colaboradores do OpenStreetMap</a>';
/** Centro padrão (Aracaju) quando ainda não há pontos. */
const CENTRO_PADRAO: [number, number] = [-10.9472, -37.0731];

function Enquadrar({ pontos, chave }: { pontos: [number, number][]; chave: string }) {
  const mapa = useMap();
  const ultimaChave = useRef<string | null>(null);
  useEffect(() => {
    // Enquadra só quando o conjunto muda (não a cada atualização), para não atrapalhar quem está navegando.
    if (pontos.length === 0 || ultimaChave.current === chave) return;
    ultimaChave.current = chave;
    if (pontos.length === 1) mapa.setView(pontos[0], 14);
    else mapa.fitBounds(L.latLngBounds(pontos), { padding: [40, 40], maxZoom: 15 });
  }, [mapa, pontos, chave]);
  return null;
}

export function MapaBase({ pontos, chaveEnquadramento, children, className, canvas = false }: {
  pontos: [number, number][];
  /** Muda quando o enquadramento deve ser refeito (ex.: outro motorista selecionado). */
  chaveEnquadramento: string;
  children?: ReactNode;
  className?: string;
  /** Desenha vetores em canvas (milhares de pontos/linhas sem pesar o navegador). */
  canvas?: boolean;
}) {
  return (
    <MapContainer center={CENTRO_PADRAO} zoom={11} className={className ?? 'mapa'} scrollWheelZoom preferCanvas={canvas}>
      <TileLayer url={TILES} attribution={ATRIBUICAO} maxZoom={19} />
      <Enquadrar pontos={pontos} chave={chaveEnquadramento} />
      {children}
    </MapContainer>
  );
}
