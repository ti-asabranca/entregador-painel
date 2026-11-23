import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// /api é encaminhado à entregador-api (mesma origem: sem CORS).
// SEGURANÇA: `npm run dev` (servidor de desenvolvimento) NUNCA deve ficar acessível pela rede — ele compila código
// sob demanda e já foi alvo de execução remota de código. Em produção use `npm run producao`: compila e serve só os
// arquivos estáticos de dist/ na mesma porta 5173, com o mesmo encaminhamento de /api.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxy = {
    '/api': {
      target: env.API_PROXY_DESTINO || 'http://localhost:3000',
      changeOrigin: true,
      rewrite: (caminho: string) => caminho.replace(/^\/api/, ''),
    },
  };
  return {
    plugins: [react()],
    // Desenvolvimento: só na própria máquina (sem --host).
    server: { port: 5173, host: 'localhost', proxy },
    // Produção: arquivos estáticos do build, acessíveis pela rede na porta de sempre.
    preview: { port: 5173, strictPort: true, host: '0.0.0.0', proxy },
    test: { environment: 'node' },
  };
});
