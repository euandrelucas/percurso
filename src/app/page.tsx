import Link from "next/link";
import { Logo } from "@/components/ui";
import { HeroAvatar } from "@/components/HeroAvatar";

const steps = [
  { n: "1", t: "Entre com seu convite", d: "O Percurso está em beta fechado. Quem recebeu um código cria a conta em um minuto." },
  { n: "2", t: "Monte o seu acompanhante", d: "Escolha nome, voz, rosto e jeito de conversar. Do tom mais acolhedor ao mais direto." },
  { n: "3", t: "Converse de verdade", d: "Chamada de voz com vídeo, no seu ritmo, e mensagens para os momentos de aperto." },
  { n: "4", t: "Siga o seu percurso", d: "A cada sessão ele retoma de onde parou, propõe pequenos exercícios e acompanha as suas metas." },
];

const principles = [
  { t: "Transparência", d: "Você sempre sabe que está falando com uma IA. Sem teatro e sem promessas de cura." },
  { t: "Pessoas por trás", d: "Uma pessoa responsável acompanha o estudo e é avisada em situações de risco." },
  { t: "Privacidade", d: "Suas conversas ficam criptografadas, com acesso restrito à coordenação do estudo, e não são vendidas nem usadas em anúncios." },
  { t: "Segurança primeiro", d: "Sinais de risco acionam recursos de apoio imediato, como o CVV (188), em qualquer canal." },
];

export default function Landing() {
  return (
    <main>
      <header className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/cadastro" className="btn btn-ghost hidden sm:inline-flex">Tenho um convite</Link>
          <Link href="/entrar" className="btn btn-dark">Entrar</Link>
        </nav>
      </header>

      <section className="max-w-6xl mx-auto px-5 pt-10 pb-20 grid md:grid-cols-[1.15fr_.85fr] gap-12 items-center">
        <div className="fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-teal-soft text-teal-deep text-sm font-semibold px-3.5 py-1.5">
            <span className="w-2 h-2 rounded-full bg-teal" /> Beta fechado · só por convite
          </span>
          <h1 className="mt-5 text-5xl md:text-6xl leading-[1.05] font-semibold">
            Cuidar da mente <em className="text-teal not-italic">não deveria</em> ser um privilégio.
          </h1>
          <p className="mt-6 text-lg text-ink-soft max-w-xl leading-relaxed">
            O Percurso é um projeto em construção para <strong>democratizar o acesso ao acompanhamento psicológico</strong>: um espaço acolhedor, disponível quando você precisa, que lembra de você entre uma conversa e outra e caminha ao seu lado, um passo de cada vez.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/cadastro" className="btn btn-primary text-base">Criar conta com convite</Link>
            <a href="#como-funciona" className="btn btn-ghost text-base">Como funciona</a>
          </div>
          <p className="mt-5 text-sm text-muted max-w-md">Esta primeira versão é um estudo com um grupo pequeno de convidados. Ainda não está aberta ao público.</p>
        </div>

        <div className="relative fade-up" style={{ animationDelay: ".1s" }}>
          <div className="absolute -inset-6 bg-teal-soft rounded-[3rem] -rotate-3" aria-hidden />
          <div className="relative card !p-3 !rounded-[2rem] shadow-xl shadow-teal/10">
            <div className="rounded-[1.5rem] overflow-hidden aspect-[4/5] bg-ink relative">
              <HeroAvatar />
              <div className="absolute left-3 bottom-3 right-3 rounded-2xl bg-black/45 backdrop-blur px-4 py-3 text-white text-sm">
                “Que bom te ver de novo. Da última vez você comentou sobre aquela conversa com seu chefe… como foi?”
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="bg-ink text-white">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <h2 className="text-4xl font-semibold max-w-xl">Um acompanhante que lembra de você.</h2>
          <p className="mt-3 text-white/70 max-w-xl">Não é um chat genérico. Cada sessão continua da anterior, com exercícios e metas combinados com você.</p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="serif text-3xl text-teal">{s.n}</div>
                <div className="font-semibold mt-2">{s.t}</div>
                <p className="text-sm text-white/65 mt-1.5 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-20">
        <h2 className="text-4xl font-semibold max-w-2xl">Feito para ser seguro, não só simpático.</h2>
        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          {principles.map((p) => (
            <div key={p.t} className="card">
              <div className="serif text-xl font-semibold">{p.t}</div>
              <p className="text-ink-soft mt-1.5 leading-relaxed">{p.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-2xl bg-coral-soft border border-[#f6d2c9] p-5 text-ink-soft">
          <strong className="text-ink">Se você está em crise agora, não espere.</strong> Ligue <strong>188</strong> (CVV, apoio emocional 24 h) ou <strong>192</strong> (SAMU). O Percurso não substitui atendimento de emergência.
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-5 py-8 text-sm text-muted flex flex-wrap gap-4 justify-between">
          <Logo />
          <p className="max-w-xl">
            O Percurso é uma ferramenta de apoio emocional com inteligência artificial, em fase de estudo supervisionado. Não é um psicólogo humano, não faz diagnósticos e não substitui acompanhamento profissional de saúde.
          </p>
        </div>
      </footer>
    </main>
  );
}
