# acompanhamento-entrega-frontend

Painel web da **gerência de transporte** para acompanhar as entregas em andamento (cargas sem prestação de contas).
React + TypeScript + Vite, mapa OpenStreetMap (Leaflet). Consome a `entregador-api` (rotas `/gestao`).

## Funcionalidades

| Tela | O que mostra |
|---|---|
| **Mapa** (`/mapa`) | Todos os motoristas em viagem, na cor da situação: **Entregando** (chegada no cliente detectada), **Andando**, **Parado** (fora de cliente, sem pausa), **Em pausa** (registrada no app) e **Sem sinal** (sem posição há 15 min). Clicar no caminhão abre o detalhe no painel lateral. Atualiza a cada 30 s. |
| **Entregadores** (`/entregadores`) | **Lista** (padrão): uma linha por motorista — dados gerais (nome, caminhão, última conexão, contadores de clientes por situação, NF entregues/total, kg entregue/saída), carga (número, data, início das entregas, distância da melhor rota e da rota do motorista) e situação da entrega (um ícone por cliente colorido pela situação, na ordem da melhor rota, caminhão antes do próximo cliente, barra e percentual de clientes concluídos). **Cartões**: visão resumida. Em ambas: situação, caminhão, cargas, peso de saída (Σ `DAK_PESO`), peso que resta (Σ `D2_QUANT × B1_PESBRU` das notas não entregues), clientes entregues/pendentes. Filtro por situação e busca. |
| **Detalhe do motorista** (`/motoristas/:codigo`) | Mapa com o **percurso realizado** (cinza), a **rota que o motorista está seguindo** (azul tracejado) e a **melhor rota** (verde — menor distância por ruas da posição atual pelos clientes pendentes, calculada pela API **sem alterar** a rota do motorista). Lista de clientes **na ordem da melhor rota**, com ícone colorido: cinza pendente, verde entregue, amarelo parcial, vermelho não entregue. |
| **Ocorrências** (`/ocorrencias`) | Notas não entregues (não entrega do cliente ou encerramento/REENVIO) e itens devolvidos das cargas em aberto, com motivo e descrição — para agir antes do motorista voltar. Filtros e exportação CSV. As novas ficam destacadas. |
| **Alerta de nova ocorrência** (todas as telas) | Verificação a cada 1 min: aviso no canto da tela (clique abre Ocorrências), contador no menu e, com "Ativar notificações", notificação do navegador quando o painel está em segundo plano. As já existentes ao abrir o painel pela 1ª vez não geram alerta (vistas guardadas por usuário/empresa no navegador). |
| **Usuários** (`/usuarios`, só administrador) | Cadastro dos usuários da gerência: perfil (Administrador/Usuário), empresas com acesso, ativo/inativo, redefinir senha. Senha temporária automática exibida uma vez, com troca obrigatória no primeiro login. |

## Requisitos

- Node.js 20+.
- `entregador-api` com a migração **016** aplicada e um usuário de gestão (`npm run gestor -- criar ...` na API).
- Para o peso restante: o select de itens do ERP enviando `B1_PESBRU` em `/notas/itens/sincronizacao`
  (sem ele, o peso restante aparece como "parcial").
- Para a melhor rota: OSRM configurado na API (`OSRM_URL`) e depósito da filial cadastrado.

## Desenvolvimento

```bash
npm install
cp .env.example .env        # ajuste API_PROXY_DESTINO se a API não estiver em http://localhost:3000
npm run dev                 # http://localhost:5173 (o Vite encaminha /api para a API — sem CORS)
npm test                    # testes unitários (Vitest)
npm run verificar           # verificação de tipos
npm run build               # build de produção em dist/
```

## Implantação

O build (`dist/`) é estático. Recomendado: servir pelo mesmo domínio da API com proxy reverso (nginx), por exemplo:

```nginx
location /api/ { proxy_pass http://127.0.0.1:3000/; proxy_set_header X-Forwarded-For $remote_addr; }
location /     { root /srv/acompanhamento/dist; try_files $uri /index.html; }
```

Com `TRUST_PROXY=1` na API (IP real para o limite de tentativas de login). Em domínio separado, defina
`VITE_API_URL` no build e `GESTAO_ORIGENS` na API (CORS). Use sempre HTTPS e cabeçalhos de segurança
(`Content-Security-Policy`, `X-Frame-Options`) no servidor web.

## Segurança

- Login próprio da gerência (não usa a `x-api-key` do ERP). Sessão de 12 h (`GESTAO_SESSAO_HORAS`), token só em
  `sessionStorage` (sai ao fechar o navegador) e enviado no cabeçalho `Authorization` (sem cookies → sem CSRF).
- Senha temporária com troca obrigatória no primeiro acesso; bloqueio após tentativas falhas (mesma regra do app).
- Cada gestor só vê as empresas liberadas no cadastro.
- Localização de motoristas é dado pessoal (LGPD): acesso restrito à gerência; não exporte nem compartilhe o mapa.
- O CSV de ocorrências neutraliza fórmulas (proteção contra injeção ao abrir no Excel).
