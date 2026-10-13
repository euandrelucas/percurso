# Percurso

Acompanhamento psicológico com apoio de IA — **beta fechado** (só por convite).
Next.js 15 · **PostgreSQL + Prisma** · OpenAI (Realtime por WebRTC para voz; Chat Completions para texto, análises e relatórios) · PWA instalável.

## Subir em produção (Docker)

```bash
git clone <repo> && cd percurso
./scripts/setup.sh percurso.seudominio.com   # gera .env com segredos fortes (sem domínio = modo local http://localhost)
docker compose up -d
```

Isso sobe **Postgres 16**, aplica as migrações (`migrate`), o **app** (Next.js standalone, usuário não‑root, FS somente leitura) e o **Caddy** (HTTPS automático via Let's Encrypt quando há domínio). Aponte o DNS do domínio para o servidor e libere as portas 80/443. Na primeira vez, o admin é criado com `ADMIN_EMAIL`/`ADMIN_PASSWORD`; ao entrar, o app pede para ativar **2FA** (app autenticador).

- Logs: `docker compose logs -f app` · Backup do banco: `./scripts/backup.sh` · Atualizar: `git pull && docker compose up -d --build`
- ⚠️ **Guarde o `ENCRYPTION_KEY`** (no `.env`, ou no volume `appdata` se foi auto‑gerada): sem ela as transcrições/memória cifradas não podem ser lidas. Faça backup do banco **e** da chave, em locais separados.
- Microfone e câmera só funcionam em **HTTPS** (ou `localhost`) — por isso o Caddy com domínio.

## Desenvolvimento

```bash
npm install
cp .env.local.example .env.local  # ajuste DATABASE_URL; MOCK_AI=1 roda sem OpenAI
npx prisma migrate deploy         # aplica as migrações
npm run seed:demo                 # paciente fictício com 4 sessões (só dev)
npm run dev
```

```bash
npm test                          # 26 testes (precisa do banco percurso_test; veja tests/helpers.ts)
npm run smoke                     # 43 verificações de segurança/fluxo contra uma instância rodando
npm run eval:prompts              # cenários difíceis contra o modelo REAL (precisa de OPENAI_API_KEY)
```

## Áreas

| Rota | Quem | O que tem |
|---|---|---|
| `/` | público | Landing: projeto para democratizar o acesso à psicologia, beta por convite |
| `/cadastro?code=…`, `/entrar` | convidados | Conta só com código de convite (uso único); senha forte obrigatória |
| `/onboarding` | paciente | Consentimento, triagem (PHQ‑2 / GAD‑2 + pergunta de segurança), criação do agente (nome, voz, rosto, tom, estilo, humor, ritmo, limites) |
| `/app` | paciente | Início, metas, exercícios, humor, sessões e resumos, personalização do agente; **instalável como app** |
| `/app/atendimento/chamada` | paciente | Chamada estilo Meet: avatar ilustrado animado (boca sincronizada ao áudio), câmera local, legendas, cronômetro |
| `/app/atendimento/mensagens` | paciente | Chat estilo WhatsApp para emergências |
| `/admin` | você | Painel (taxas, funil, gráficos, alertas), convites, pacientes (busca/filtros), ficha completa, **dossiê em PDF**, auditoria, segurança (2FA), CSV pseudonimizado do estudo |

## Voz

Usa a API **OpenAI Realtime** (`gpt-realtime`, modelo fala‑para‑fala): a voz é gerada diretamente pelo modelo, sem TTS separado. As vozes disponíveis são as do próprio modelo (marin, cedar, coral, sage, ash, verse); a transcrição para registro usa `gpt-4o-transcribe`. O navegador abre o WebRTC **passando pelo nosso servidor** (`/api/call/[id]/connect`): a chave e as instruções ficam no servidor.

## Dossiê do paciente (PDF para o estudo)

`/admin/pacientes/[id]` → **Gerar dossiê completo (PDF)**: capa, sumário, identificação e consentimento, agente escolhido, triagem, síntese (IA, separando fato de hipótese), gráfico de humor, linha do tempo, **cada sessão em detalhe**, metas/exercícios, alertas e tratamento, memória do caso (com versões), limitações, **Anexo A — transcrições integrais** e **Anexo B — chat de emergência**. Dá para gerar sem transcrições. Cada download fica na auditoria.

## Segurança (o que foi feito)

Nenhum sistema é “100% seguro”; isto é defesa em profundidade e o que ainda depende de quem hospeda.

- **Autenticação:** senhas com scrypt (N=2¹⁵), política de senha, bloqueio de conta após 5 falhas (backoff até 24 h), rate limit por IP/e‑mail, resposta de login genérica e com tempo constante; **sessões no banco** (token aleatório de 256 bits, só o hash é guardado), revogáveis, cookie `HttpOnly` + `SameSite=Strict` (+ `__Host-`/`Secure` em HTTPS), expiração (admin 8 h, paciente 7 d); troca de senha derruba as outras sessões.
- **Admin:** **2FA TOTP obrigatório em produção** (código de uso único, com bloqueio de reuso), API do admin inacessível até ativar.
- **Dados em repouso:** transcrições, análises, memória do caso, relatórios, alertas e segredo do 2FA são **cifrados em nível de campo (AES‑256‑GCM)**, com a coluna como AAD (não dá para trocar um texto cifrado de lugar). Senhas só em hash. Postgres sem porta exposta.
- **Aplicação:** CSRF (verificação de `Origin`/`Sec-Fetch-Site` + SameSite), **CSP com nonce**, HSTS, `X-Frame-Options: DENY`, COOP/CORP, `no-store` nas páginas; validação de todas as entradas com **zod**; Prisma (queries parametrizadas); limite de tamanho de corpo; checagem de dono em todo recurso (um paciente nunca acessa dado de outro); export CSV com proteção a injeção de fórmula e **pseudonimizado**.
- **Auditoria:** trilha append‑only (logins, 2FA, convites, alertas, **todo acesso de admin a dados de pacientes**, downloads de PDF/CSV).
- **Contêiner:** usuário não‑root, FS somente leitura, `cap_drop: ALL`, `no-new-privileges`, rede interna para o banco, healthchecks, logs com rotação, `tini`.
- **PWA:** o service worker **nunca** guarda API nem páginas autenticadas em cache (só estáticos versionados e a tela offline).
- **IA:** a chave da OpenAI nunca vai ao navegador; instruções da IA ficam no servidor; guardrails e classificação de risco em duas camadas.

O que continua sendo seu: manter o servidor/SO atualizado, firewall (só 80/443), backups cifrados, proteger o `.env`, não compartilhar a conta de admin, e o contrato com a OpenAI (sem treino com seus dados). Dependências com avisos no `npm audit` (`postcss` embutido no Next e `deepmerge-ts` na CLI do Prisma) são de **ferramentas de build**, não rodam no servidor; serão resolvidas ao migrar para o Next 16.

## Engenharia de prompt (`src/lib/prompts/`)

O modelo nunca recebe a ficha toda nem o histórico bruto — recebe um prompt **montado de forma determinística**: persona (escolhas do paciente) + arte da conversa (voz/chat) + memória em camadas + roteiro por fase (triagem/acompanhamento) + segurança. Consistência garantida por: saída estruturada (JSON Schema estrito), guardrails determinísticos no chat, lembretes de persona, risco em duas camadas (regras + modelo; cartão de crise determinístico), `PROMPT_VERSION` gravada por sessão e memória versionada. Cada paciente mostra no admin o **prompt exato** da próxima chamada.

## Regras do beta (`.env`)

1 chamada/dia de até 60 min (`CALLS_PER_DAY`, `SESSION_MAX_MINUTES`; ajustável por paciente), encerramento conversado (avisos aos 10/5/1 min, tolerância de 20 s), retomada após queda, chat com limite diário. Vídeo do paciente é local e nunca enviado.

## ⚠️ Antes de convidar alguém

Beta técnico. O documento de produto exige antes de qualquer participante real: aprovação de comitê de ética, termo de consentimento revisado, revisão jurídica (LGPD — dados de saúde são sensíveis), psicólogo responsável para os alertas e contrato com o provedor de IA que proíba treino com os dados. A IA só sinaliza risco; a decisão é humana.
