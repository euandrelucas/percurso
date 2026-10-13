/**
 * Cria um paciente FICTÍCIO com histórico completo (4 sessões, chat, alertas, humor) para demonstrar o painel e o PDF.
 * Uso (apenas desenvolvimento):  npm run seed:demo
 */
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { addMessage, raiseAlert, saveAnalysis, saveMemory } from "../src/lib/store";
import { PROMPT_VERSION } from "../src/lib/config";
import type { SessionAnalysis } from "../src/lib/types";

if (process.env.NODE_ENV === "production") throw new Error("Não rode o seed de demonstração em produção.");

const email = "demo.paciente@percurso.test";
await prisma.user.deleteMany({ where: { email } });
const day = (n: number, h = 20, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d;
};

const u = await prisma.user.create({
  data: { email, name: "Marina Duarte (demo)", password_hash: await hashPassword("Demo-Paciente-2026!"), onboarded: true, consent_at: day(14, 19, 40), created_at: day(14, 19, 30) },
});
await prisma.agentSettings.create({
  data: { user_id: u.id, preferred_name: "Mari", agent_name: "Íris", voice: "marin", tone: "acolhedor", style: "equilibrado", formality: "informal", humor: "leve", pace: "normal", avatar: { skin: "#e8b48f", hair: "hair-long", hairColor: "#5a3a22", accessory: "glasses-round", accent: "#6366f1" }, about_me: "Sou analista, moro sozinha e gosto de caminhar.", topics: "ansiedade no trabalho, sono", boundaries: "", goal_hint: "dormir melhor e me sentir menos tensa" },
});
for (const [kind, answers, score, flagged] of [["phq2", [1, 2], 3, true], ["gad2", [2, 2], 4, true], ["seguranca", [0], 0, false]] as const)
  await prisma.screening.create({ data: { user_id: u.id, kind, answers: [...answers], score, flagged, created_at: day(14, 19, 45) } });

type Turn = [("user" | "assistant"), string];
const sessions: { n: number; ago: number; kind: "triagem" | "acompanhamento"; min: number; end: string; turns: Turn[]; a: SessionAnalysis }[] = [
  {
    n: 1, ago: 14, kind: "triagem", min: 52, end: "agente",
    turns: [
      ["assistant", "Oi, Mari. Eu sou a Íris, uma IA de apoio emocional do Percurso. Que bom ter você aqui. Como você está chegando hoje?"],
      ["user", "Oi. Tô meio cansada, pra falar a verdade. A semana foi puxada no trabalho."],
      ["assistant", "Imagino. Cansaço de semana puxada pesa mesmo. O que foi mais puxado nela?"],
      ["user", "A gente tem um prazo grande de entrega e meu chefe fica cobrando todo dia. Eu fico com a cabeça acelerada e não consigo desligar."],
      ["assistant", "Cabeça acelerada e sem conseguir desligar… isso cansa de um jeito diferente. Desde quando você tá sentindo isso?"],
      ["user", "Faz uns dois meses. Eu durmo umas quatro, cinco horas por noite. Acordo de madrugada pensando nas tarefas."],
      ["assistant", "Quatro, cinco horas por noite por dois meses é bastante desgaste. E durante o dia, como isso aparece pra você?"],
      ["user", "Fico irritada fácil, esqueço coisas. Às vezes sinto o coração acelerado quando abre o e-mail do trabalho."],
      ["assistant", "Obrigada por me contar. Mari, uma pergunta importante, e eu faço com todo mundo: nas últimas semanas você chegou a pensar em se machucar, ou que seria melhor não estar aqui?"],
      ["user", "Não, nada disso. Eu só quero conseguir descansar."],
      ["assistant", "Que bom que você me contou, e é um pedido muito legítimo: descansar. Se daqui a algumas semanas as coisas estivessem um pouco melhores, o que você notaria de diferente?"],
      ["user", "Dormir pelo menos seis horas e conseguir desligar depois do expediente."],
      ["assistant", "Então vamos começar por aí. Posso te sugerir um exercício pequeno de respiração pra antes de dormir, por três minutos? De zero a dez, como você tá agora?"],
      ["user", "Uns cinco. Pode ser, vou tentar."],
    ],
    a: {
      resumo: "Primeira sessão de triagem. Mari relata cerca de dois meses de sobrecarga no trabalho, com pressão do chefe por um prazo grande. Descreve sono reduzido (4 a 5 horas), despertares de madrugada com pensamentos sobre tarefas, irritabilidade, esquecimentos e palpitações ao abrir e-mails do trabalho. Nega pensamentos de se machucar. Combinou como meta dormir ao menos seis horas e conseguir desligar após o expediente, e aceitou um exercício de respiração antes de dormir.",
      temas: ["sobrecarga no trabalho", "sono", "ansiedade"], emocoes_predominantes: ["cansaço", "tensão", "irritabilidade"],
      humor_estimado_inicio: null, humor_estimado_fim: 5, risco: { nivel: 0, evidencias: [] },
      fatos_observados: ["Relata dormir de 4 a 5 horas por noite há cerca de dois meses.", "Relata despertar de madrugada pensando em tarefas.", "Relata palpitações ao abrir e-mails do trabalho.", "Nega pensamentos de se machucar (resposta direta na sessão).", "Atribui o desgaste a um prazo grande e à cobrança diária do chefe."],
      hipoteses: [{ texto: "Padrão de ativação ansiosa vinculado ao ambiente de trabalho, com impacto no sono.", confianca: "media" }, { texto: "Possível ruminação noturna sobre tarefas dificultando o início/manutenção do sono.", confianca: "media" }],
      tecnicas_usadas: ["escuta ativa", "psicoeducação sobre sono", "respiração lenta"], exercicio: { titulo: "Respiração de 3 minutos antes de dormir", descricao: "Antes de deitar, respire contando 4 segundos para inspirar e 6 para soltar, por 3 minutos. Anote como se sentiu." },
      metas: [{ titulo: "Dormir pelo menos 6 horas por noite", status: "nova" }, { titulo: "Conseguir desligar do trabalho após o expediente", status: "nova" }],
      pontos_para_proxima_sessao: ["Como foi a respiração antes de dormir", "Prazo de entrega no trabalho"], abertura_sugerida: "Da última vez você contou do prazo grande e do sono curto. Como foram as noites desde então?",
      para_o_profissional: "Sem sinais de risco. Escalas na triagem acima do ponto de corte (PHQ-2=3; GAD-2=4). Boa aliança inicial.",
      memoria_atualizada: { queixa_principal: "Sobrecarga e ansiedade no trabalho com sono reduzido.", contexto_de_vida: "Analista, mora sozinha, gosta de caminhar. Prazo grande no trabalho e cobrança diária do chefe.", historico_relevante: "Sem acompanhamento anterior relatado.", padroes: ["Ativação ansiosa vinculada ao trabalho com ruminação noturna"], forcas_e_recursos: ["Gosta de caminhar", "Busca ajuda ativamente"], o_que_funciona: ["Perguntas diretas e objetivas"], o_que_evitar: [], temas_recorrentes: ["trabalho", "sono"], rede_de_apoio: "Não explorada ainda.", preferencias_de_comunicacao: "Linguagem informal." },
    },
  },
  {
    n: 2, ago: 11, kind: "acompanhamento", min: 48, end: "agente",
    turns: [
      ["assistant", "Oi, Mari! Da última vez você contou do prazo grande e do sono curto. Como foram as noites desde então?"],
      ["user", "Melhorou um pouquinho. Fiz a respiração em três noites e dormi umas cinco horas e meia."],
      ["assistant", "Que legal, três noites já é um esforço de verdade. O que você percebeu quando fez a respiração?"],
      ["user", "Que meu coração desacelera. Mas quando penso na reunião de quinta, volta tudo."],
      ["assistant", "Faz sentido. O que te preocupa mais nessa reunião?"],
      ["user", "Tenho medo de o chefe falar que a entrega tá atrasada e eu ficar sem resposta. Sinto que sempre vou falhar."],
      ["assistant", "Esse 'sempre vou falhar' parece pesar bastante. Posso te propor olhar isso juntas, com calma? Me conta uma vez em que você entregou algo e deu certo."],
      ["user", "Mês passado entreguei o relatório trimestral antes do prazo e elogiaram."],
      ["assistant", "Então já existe uma evidência bem concreta contra o 'sempre'. Como você diria essa frase de um jeito mais justo com você?"],
      ["user", "Tipo… 'às vezes o prazo aperta, mas eu costumo dar conta'."],
      ["assistant", "Gostei dessa versão. De zero a dez, como você está agora?"],
      ["user", "Sete. Bem melhor."],
    ],
    a: {
      resumo: "Mari relata melhora parcial do sono (cerca de 5h30 em três noites com a respiração). Surge ansiedade antecipatória sobre uma reunião de quinta com o chefe e a crença 'sempre vou falhar'. Foi trabalhada reestruturação gentil: ela resgatou uma evidência contrária (entrega antecipada do relatório trimestral, elogiada) e formulou uma frase alternativa mais equilibrada. Humor final 7/10.",
      temas: ["ansiedade antecipatória", "autocrítica", "sono"], emocoes_predominantes: ["ansiedade", "alívio ao final"],
      humor_estimado_inicio: 5, humor_estimado_fim: 7, risco: { nivel: 0, evidencias: [] },
      fatos_observados: ["Fez a respiração em 3 noites e dormiu cerca de 5h30.", "Relata que o coração desacelera durante a respiração.", "Tem reunião na quinta com o chefe e teme ser cobrada por atraso.", "Entregou o relatório trimestral antes do prazo no mês passado e foi elogiada."],
      hipoteses: [{ texto: "Crença de fracasso generalizado ('sempre vou falhar') pode alimentar a ansiedade antecipatória.", confianca: "media" }],
      tecnicas_usadas: ["reestruturação cognitiva", "busca de evidências", "reforço de adesão"], exercicio: { titulo: "Registro de pensamentos", descricao: "Quando surgir o pensamento 'sempre vou falhar', anote a situação e escreva a frase mais equilibrada que você criou hoje." },
      metas: [{ titulo: "Dormir pelo menos 6 horas por noite", status: "em_andamento" }],
      pontos_para_proxima_sessao: ["Como foi a reunião de quinta", "Uso do registro de pensamentos"], abertura_sugerida: "Como foi a reunião de quinta? Você chegou a usar a frase 'às vezes o prazo aperta, mas eu costumo dar conta'?",
      para_o_profissional: "Boa adesão ao exercício. Evolução favorável do humor intra-sessão. Sem risco identificado.",
      memoria_atualizada: { queixa_principal: "Sobrecarga e ansiedade no trabalho com sono reduzido.", contexto_de_vida: "Analista, mora sozinha. Prazo grande; reuniões com o chefe geram ansiedade antecipatória.", historico_relevante: "Sem acompanhamento anterior relatado.", padroes: ["Crença 'sempre vou falhar' com ansiedade antecipatória", "Ruminação noturna"], forcas_e_recursos: ["Gosta de caminhar", "Entregou relatório antes do prazo", "Boa adesão a exercícios"], o_que_funciona: ["Busca de evidências", "Respiração antes de dormir"], o_que_evitar: [], temas_recorrentes: ["trabalho", "sono", "autocrítica"], rede_de_apoio: "Não explorada ainda.", preferencias_de_comunicacao: "Linguagem informal, objetiva." },
    },
  },
  {
    n: 3, ago: 7, kind: "acompanhamento", min: 55, end: "tempo",
    turns: [
      ["assistant", "Oi, Mari. Como foi a reunião de quinta?"],
      ["user", "Foi melhor do que eu esperava! O chefe até reconheceu o esforço. Mas depois eu não dormi bem, fiquei remoendo."],
      ["assistant", "Que bom que foi melhor do que o medo previa. E mesmo assim a cabeça continuou rodando à noite. O que ela repetia?"],
      ["user", "Que eu devia ter respondido melhor uma pergunta. Fico revivendo as conversas."],
      ["assistant", "Revisitar a conversa tentando 'consertar'… Quando você faz isso, o que acontece no seu corpo?"],
      ["user", "Aperta o peito e eu perco o sono. Essa semana comecei a me sentir mais sozinha também, moro sozinha e não converso com ninguém."],
      ["assistant", "Obrigada por contar da solidão. Tem alguém com quem você gostaria de falar mais?"],
      ["user", "Minha irmã. A gente se afastou, mas eu sinto falta."],
      ["assistant", "Parece importante. Que tal um passo pequeno: mandar uma mensagem simples pra ela esta semana?"],
      ["user", "Acho que consigo. Vou mandar um 'oi, saudade'."],
      ["assistant", "Chegamos perto do nosso horário. Combinamos o 'oi, saudade' pra sua irmã e a respiração antes de dormir. Como você está, de zero a dez?"],
      ["user", "Seis."],
      ["assistant", "Obrigada por hoje, Mari. Foi um prazer. Cuide de você, e até a próxima."],
    ],
    a: {
      resumo: "Reunião correu melhor que o previsto, com reconhecimento do chefe. Persistem ruminação noturna ('consertar' respostas) e perda de sono. Surge solidão e saudade da irmã, de quem se afastou. Combinou enviar uma mensagem simples à irmã e manter a respiração. Humor final 6/10. Sessão encerrada por limite de tempo, com despedida concluída.",
      temas: ["ruminação", "solidão", "vínculos familiares"], emocoes_predominantes: ["alívio", "solidão", "tensão"],
      humor_estimado_inicio: null, humor_estimado_fim: 6, risco: { nivel: 1, evidencias: ["Relata sentir-se mais sozinha e perder o sono remoendo conversas."] },
      fatos_observados: ["A reunião de quinta foi melhor que o esperado; o chefe reconheceu o esforço.", "Ruminou a noite toda sobre uma resposta que 'devia ter dado'.", "Relata aperto no peito e perda de sono ao ruminar.", "Relata sentir-se sozinha; mora sozinha.", "Sente falta da irmã, de quem se afastou."],
      hipoteses: [{ texto: "Ruminação pós-evento (revisitar conversas) mantém a ativação e prejudica o sono.", confianca: "media" }, { texto: "Isolamento social pode estar contribuindo para o desgaste emocional.", confianca: "baixa" }],
      tecnicas_usadas: ["escuta ativa", "ativação comportamental (contato social)"], exercicio: { titulo: "Mensagem para a irmã", descricao: "Envie uma mensagem curta para sua irmã (por exemplo, 'oi, saudade') até domingo e perceba como se sente depois." },
      metas: [{ titulo: "Retomar contato com minha irmã", status: "nova" }, { titulo: "Dormir pelo menos 6 horas por noite", status: "em_andamento" }],
      pontos_para_proxima_sessao: ["Se enviou a mensagem para a irmã", "Ruminação noturna"], abertura_sugerida: "Você chegou a mandar o 'oi, saudade' para sua irmã? Como foi?",
      para_o_profissional: "Surgimento de queixa de solidão. Sem ideação. Monitorar isolamento. Boa adesão geral.",
      memoria_atualizada: { queixa_principal: "Sobrecarga e ansiedade no trabalho; sono reduzido; solidão.", contexto_de_vida: "Analista, mora sozinha. Afastada da irmã, de quem sente falta.", historico_relevante: "Sem acompanhamento anterior relatado.", padroes: ["Ruminação pós-evento", "Ansiedade antecipatória", "Isolamento crescente"], forcas_e_recursos: ["Gosta de caminhar", "Boa adesão", "Disposição para reaproximar da irmã"], o_que_funciona: ["Busca de evidências", "Passos pequenos concretos"], o_que_evitar: [], temas_recorrentes: ["trabalho", "sono", "solidão"], rede_de_apoio: "Irmã (afastada, mas há desejo de reaproximação).", preferencias_de_comunicacao: "Linguagem informal, objetiva." },
    },
  },
  {
    n: 4, ago: 2, kind: "acompanhamento", min: 41, end: "paciente",
    turns: [
      ["assistant", "Oi, Mari! Você chegou a mandar o 'oi, saudade' para sua irmã? Como foi?"],
      ["user", "Mandei! Ela respondeu na hora e a gente conversou quase uma hora. Chorei um pouco, mas foi bom."],
      ["assistant", "Que passo bonito. O que você sentiu depois?"],
      ["user", "Alívio. Combinamos de almoçar domingo. Mas ontem me bateu uma tristeza forte, uma hora eu pensei que não aguento mais essa rotina e que queria sumir um pouco."],
      ["assistant", "Obrigada por me contar isso, Mari. Estou aqui com você. Quando você diz 'sumir um pouco', você está pensando em tirar a própria vida?"],
      ["user", "Não, não é isso. É mais vontade de desaparecer da rotina, de descansar de tudo. Não tenho plano nenhum."],
      ["assistant", "Entendi, e agradeço a sinceridade. Você está em segurança neste momento? E tem alguém por perto?"],
      ["user", "Estou sim. Minha irmã tá mandando mensagem agora pouco, vou falar com ela depois."],
      ["assistant", "Que bom que ela está por perto. Quero que você saiba que o CVV, no 188, atende 24 horas se esse sentimento ficar mais forte. Vou avisar a equipe do estudo, porque me importo com você."],
      ["user", "Tudo bem. Acho que preciso mesmo descansar. Vou encerrar por hoje."],
      ["assistant", "Claro. Obrigada por confiar em mim. Vá falar com sua irmã, e descanse. Estou aqui quando precisar."],
    ],
    a: {
      resumo: "Mari conta que reatou o contato com a irmã (conversaram quase uma hora, almoço combinado para domingo) e sentiu alívio. Relata, porém, um episódio de tristeza forte no dia anterior com pensamento 'não aguento mais essa rotina' e 'queria sumir um pouco'. Questionada diretamente, nega ideação suicida e plano, descrevendo desejo de descansar da rotina. Referiu estar em segurança e com a irmã por perto. Foram reforçados o CVV (188) e a equipe foi sinalizada. Encerrada pela paciente.",
      temas: ["reaproximação familiar", "esgotamento", "ideação passiva possível"], emocoes_predominantes: ["alívio", "tristeza", "exaustão"],
      humor_estimado_inicio: null, humor_estimado_fim: null, risco: { nivel: 2, evidencias: ["queria sumir um pouco", "não aguento mais essa rotina"] },
      fatos_observados: ["Enviou mensagem à irmã; conversaram quase uma hora; almoço combinado para domingo.", "Relata tristeza forte no dia anterior.", "Disse 'queria sumir um pouco' e 'não aguento mais essa rotina'.", "Nega ideação suicida e plano quando perguntada diretamente.", "Afirma estar em segurança e com a irmã em contato."],
      hipoteses: [{ texto: "Esgotamento por sobrecarga persistente pode estar gerando desejo de 'desaparecer' da rotina, distinto de ideação suicida, mas que requer acompanhamento próximo.", confianca: "media" }],
      tecnicas_usadas: ["avaliação direta de segurança", "validação emocional"], exercicio: null,
      metas: [{ titulo: "Retomar contato com minha irmã", status: "em_andamento" }],
      pontos_para_proxima_sessao: ["Como ela está desde ontem", "Almoço com a irmã no domingo", "Sobrecarga e descanso"], abertura_sugerida: "Pensei em você. Como você tem se sentido desde nossa última conversa? E como foi o almoço com a sua irmã?",
      para_o_profissional: "ATENÇÃO: fala 'queria sumir um pouco' com negação de ideação/plano. Recomenda-se contato ativo da equipe e reavaliação de risco. Rede de apoio (irmã) reativada.",
      memoria_atualizada: { queixa_principal: "Sobrecarga e ansiedade no trabalho; sono reduzido; solidão; episódio de tristeza intensa.", contexto_de_vida: "Analista, mora sozinha. Reaproximação com a irmã.", historico_relevante: "Sem acompanhamento anterior relatado. Episódio de 'queria sumir um pouco' na sessão 4 (nega ideação/plano).", padroes: ["Ruminação pós-evento", "Esgotamento com picos de tristeza", "Retomada de vínculos protetores"], forcas_e_recursos: ["Gosta de caminhar", "Boa adesão", "Irmã como apoio"], o_que_funciona: ["Passos pequenos concretos", "Perguntas diretas e acolhedoras"], o_que_evitar: [], temas_recorrentes: ["trabalho", "sono", "solidão", "esgotamento"], rede_de_apoio: "Irmã (reaproximada).", preferencias_de_comunicacao: "Linguagem informal, objetiva." },
    },
  },
];

for (const s of sessions) {
  const start = day(s.ago, 20, 10);
  const row = await prisma.therapySession.create({ data: { user_id: u.id, number: s.n, kind: s.kind, status: "ended", started_at: start, ended_at: new Date(start.getTime() + s.min * 60000), duration_sec: s.min * 60, end_reason: s.end, max_minutes: 60, prompt_version: PROMPT_VERSION } });
  let t = start.getTime();
  for (const [role, text] of s.turns) {
    const id = await addMessage(u.id, row.id, "voice", role, text);
    t += 45000 + Math.floor(text.length * 90);
    await prisma.message.update({ where: { id }, data: { created_at: new Date(t) } });
  }
  await saveAnalysis(row.id, s.a);
  await saveMemory(u.id, s.a.memoria_atualizada, row.id);
  if (s.a.humor_estimado_fim != null) await prisma.mood.create({ data: { user_id: u.id, score: s.a.humor_estimado_fim, note: `Ao final da sessão ${s.n}`, created_at: new Date(start.getTime() + s.min * 60000) } });
  if (s.a.risco.nivel >= 2) {
    const id = await raiseAlert(u.id, s.a.risco.nivel, `sessao:${row.id}`, s.a.risco.evidencias.join(" | "));
    await prisma.alert.update({ where: { id }, data: { created_at: new Date(start.getTime() + s.min * 60000) } });
  }
}
await prisma.mood.createMany({ data: [{ user_id: u.id, score: 4, created_at: day(13, 9) }, { user_id: u.id, score: 6, created_at: day(9, 9) }, { user_id: u.id, score: 5, created_at: day(5, 9) }, { user_id: u.id, score: 7, created_at: day(3, 9) }, { user_id: u.id, score: 5, created_at: day(1, 9) }] });
for (const g of [["Dormir pelo menos 6 horas por noite", "ativa"], ["Conseguir desligar do trabalho após o expediente", "ativa"], ["Retomar contato com minha irmã", "ativa"]] as const) await prisma.goal.create({ data: { user_id: u.id, title: g[0], status: g[1], created_at: day(14) } });
await prisma.exercise.createMany({
  data: [
    { user_id: u.id, title: "Respiração de 3 minutos antes de dormir", description: "Respire contando 4 para inspirar e 6 para soltar, por 3 minutos.", status: "feito", feedback: "Fiz em 3 noites, meu coração desacelera.", created_at: day(14), completed_at: day(11) },
    { user_id: u.id, title: "Registro de pensamentos", description: "Anote a situação e a frase mais equilibrada quando surgir 'sempre vou falhar'.", status: "nao_realizado", created_at: day(11) },
    { user_id: u.id, title: "Mensagem para a irmã", description: "Envie uma mensagem curta até domingo.", status: "feito", feedback: "Mandei e conversamos quase uma hora.", created_at: day(7), completed_at: day(5) },
  ],
});
const chat: [string, string, Date][] = [
  ["user", "Acordei agora com o coração disparado, acho que vou ter uma crise", day(6, 3, 12)],
  ["assistant", "Estou aqui com você, Mari.\n\nVamos respirar juntas: inspira contando até 4, segura 4, solta devagar contando até 6. Faz isso comigo três vezes e me conta como ficou.", day(6, 3, 13)],
  ["user", "Ficou um pouco melhor, obrigada", day(6, 3, 17)],
  ["assistant", "Que bom que aliviou um pouco. Quando você quiser, a gente conversa com calma na nossa próxima chamada.\n\nTenta voltar a deitar com a respiração lenta, tá?", day(6, 3, 18)],
];
for (const [r, c, at] of chat) {
  const id = await addMessage(u.id, null, "chat", r as "user" | "assistant", c);
  await prisma.message.update({ where: { id }, data: { created_at: at } });
}
await prisma.auditLog.create({ data: { actor: "system", action: "seed.demo", user_id: u.id } });
console.log(`Paciente demo criado: id ${u.id} (${email} / Demo-Paciente-2026!)`);
await prisma.$disconnect();
