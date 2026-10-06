import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, /api é encaminhado à entregador-api (mesma origem: sem CORS).
// Em produção, sirva o build e a API sob o mesmo domínio (proxy reverso) ou defina VITE_API_URL + GESTAO_ORIGENS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.API_PROXY_DESTINO || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (caminho) => caminho.replace(/^\/api/, ''),
        },
      },
    },
    test: { environment: 'node' },
  };
});
