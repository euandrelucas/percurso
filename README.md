# Percurso

Acompanhamento psicológico com apoio de IA — **beta fechado** (só por convite).
Next.js 15 · SQLite (`node:sqlite`) · OpenAI (Realtime por WebRTC para voz, Chat Completions para texto e análises).

## Áreas

| Rota | Quem | O que tem |
|---|---|---|
| `/` | público | Landing: projeto para democratizar o acesso à psicologia, beta por convite |
| `/cadastro`, `/entrar` | convidados | Conta só com código de convite (uso único) |
| `/onboarding` | paciente | Consentimento, triagem (PHQ‑2 / GAD‑2 + pergunta de segurança), **criação do agente**: nome, voz, rosto, tom, estilo, humor, ritmo, limites |
| `/app` | paciente | Início, metas, exercícios, check‑in de humor, sessões e resumos, personalização do agente |
| `/app/atendimento/chamada` | paciente | Chamada estilo Meet: avatar animado (boca sincronizada ao áudio), sua câmera local, legendas, cronômetro |
| `/app/atendimento/mensagens` | paciente | Chat estilo WhatsApp para emergências |
| `/admin` | você | Painel com taxas (%), alertas de risco, convites, pacientes (memória, sessões, transcrições, prompt montado) e **relatório em PDF** |

## Rodando

```bash
npm install
cp .env.example .env.local   # preencha OPENAI_API_KEY, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run dev                  # http://localhost:3000
```

Sem `OPENAI_API_KEY` (ou com `MOCK_AI=1`) o app roda em **modo demonstração**: respostas simuladas e a chamada usa a voz do navegador + texto digitado. Serve para testar toda a interface.

Primeiro acesso: entre com `ADMIN_EMAIL`/`ADMIN_PASSWORD` → **Convites** → gere códigos → envie aos amigos.

```bash
npm test               # risco, guardrails, escalas, montagem dos prompts, regras de uso diário
npm run eval:prompts   # (precisa de OPENAI_API_KEY) cenários difíceis contra o modelo real
```

## Regras do beta (configuráveis em `.env`)

- **1 chamada por dia**, até **60 min** (`CALLS_PER_DAY`, `SESSION_MAX_MINUTES`; o admin pode ajustar por paciente). Chamadas que caem antes de 3 min não consomem o direito do dia; se a conexão cai no meio, o paciente **retoma a mesma sessão** (a IA recebe o que já foi dito).
- **Encerramento conversado:** a IA não enxerga o relógio, então o cliente injeta avisos (10, 5 e 1 min). Ela resume, combina o exercício, pergunta o humor final, se despede e só então chama a ferramenta `finalizar_sessao`. Existe tolerância de 20 s para a despedida terminar; o corte só acontece depois disso.
- **Chat de emergência:** `CHAT_MESSAGES_PER_DAY` mensagens/dia, em balões curtos com “digitando…”.
- Vídeo do paciente é **local** (nunca enviado nem gravado). O “vídeo” da IA é um avatar ilustrado que o paciente personaliza.

## Engenharia de prompt (`src/lib/prompts/`)

O modelo nunca recebe a ficha toda nem o histórico bruto — recebe um prompt **montado de forma determinística**:

1. `persona.ts` + `options.ts` — quem é o agente, a partir das escolhas do paciente (tom, estilo, humor, ritmo, gênero da voz, limites). Entradas validadas antes de entrar no prompt.
2. `craft.ts` — a “arte” da conversa (escuta, uma pergunta por vez, sem clichês, técnicas TCC breves, uso natural da memória) e estilos específicos de **voz** (frases curtas, sem listas) e **chat** (balões, sem markdown).
3. `memory.ts` — memória em camadas lida do banco: contexto do caso, escalas, humor, metas, exercícios pendentes/feitos, resumo e “abertura sugerida” da última sessão.
4. `phases.ts` — roteiro por fase: **triagem** (1ª sessão) e **acompanhamento**, regras de encerramento e avisos de tempo.
5. `safety.ts` — identidade honesta (é IA), o que a IA não faz, protocolo de risco, CVV 188 / SAMU 192. Vai em todos os prompts, com prioridade máxima.

Como garantimos que ele “sempre devolve aquilo”:

- **Saída estruturada** (JSON Schema estrito) para análise pós-sessão, relatório e classificador de risco.
- **Guardrails determinísticos** no chat (`guardrails.ts`): detecta “sou humano”, diagnóstico, orientação de medicação, markdown, vazamento de instruções, resposta longa/em inglês → reescreve 1× com instrução de correção; markdown é removido sempre.
- **Lembretes de persona** injetados a cada turno (chat) e a cada ~10 min (voz).
- **Risco em duas camadas** (`risk.ts`): regras (sempre ligadas) + modelo rápido; na dúvida, o maior nível. O cartão de crise no chat é **determinístico**, independe do que o modelo diga. Na voz, a IA também chama a ferramenta `sinalizar_risco`.
- `PROMPT_VERSION` (`src/lib/config.ts`) é gravada em cada sessão; a memória do caso é versionada (append‑only).
- `npm run eval:prompts` testa cenários difíceis (pânico, “você é humano?”, pedido de diagnóstico, dose de remédio, ideação, extração de prompt, limites do paciente, inglês).
- No admin, cada paciente mostra o **prompt exato** que seria enviado na próxima chamada.

Depois de cada sessão a IA gera: resumo, temas, humor, **fatos separados de hipóteses**, risco, técnicas, exercício, metas, pontos para a próxima sessão e memória atualizada. Isso alimenta o PDF do relatório (triagem, evolução, riscos, adesão, recomendações, limitações).

## Voz em tempo real

O navegador abre um WebRTC com a API Realtime **passando pelo nosso servidor** (`/api/call/[id]/connect`): a chave e as instruções ficam no servidor. Eventos de transcrição vêm pelo canal de dados e são gravados a cada fala. Para soar mais humano: VAD de servidor com interrupção, redução de ruído, voz/velocidade escolhidas pelo paciente, e “agente fala primeiro”. Defina `REALTIME_VAD=semantic` para testar o detector semântico de fim de fala.

## Produção

- Um único processo Node com **volume persistente** para `DATABASE_PATH` (SQLite). Não use hospedagem serverless sem disco.
- `AUTH_SECRET` longo e aleatório; HTTPS obrigatório (microfone/câmera exigem contexto seguro).
- O rate limit é em memória (suficiente para um processo e poucos usuários).

## ⚠️ Antes de convidar alguém

Este código é um beta técnico. O documento de produto exige, **antes de qualquer participante real**: aprovação de comitê de ética (CEP/CONEP) e termo de consentimento revisado, revisão jurídica (LGPD — dados de saúde são sensíveis), psicólogo responsável com cobertura definida para alertas e contrato com o provedor de IA que proíba treino com os dados. Resposta a alertas é **humana** (painel `/admin/alertas`): a IA só sinaliza. O app não faz diagnóstico nem decide alta.
