import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
} from "./_layout";

/**
 * D+1 — Como funciona: explica os 3 modos de geração (ideia, link, vídeo)
 * e leva o user de volta pra criar o primeiro carrossel.
 */
export function OnboardingHowItWorksEmail({
  name,
  appUrl,
}: {
  name?: string;
  appUrl: string;
}) {
  const firstName = (name || "").trim().split(" ")[0] || "creator";
  return (
    <EmailLayout preview="Como funciona o Sequência Viral em 3 modos — escolha seu jeito de criar.">
      <EmailKicker>Dia 1 · Como funciona</EmailKicker>
      <EmailHeadline>
        {firstName}, você tem 3 formas de alimentar a IA.
      </EmailHeadline>
      <EmailText>
        A gente desenhou o fluxo pra você sair com um carrossel em ~60
        segundos, não importa o ponto de partida:
      </EmailText>
      <EmailText>
        <strong>1. Ideia em texto</strong> — descreve o tema (ex: &quot;5
        erros que matam engajamento no Instagram&quot;) e a IA escreve no
        seu tom, com a estética da sua marca.
      </EmailText>
      <EmailText>
        <strong>2. Link de artigo/post</strong> — cola uma URL (Medium,
        Substack, Reel, qualquer coisa) e a IA lê, resume e monta o
        carrossel.
      </EmailText>
      <EmailText>
        <strong>3. Vídeo do YouTube</strong> — cola a URL, a IA pega a
        transcrição e transforma em carrossel. Funciona com vídeo de 20
        minutos viraram 8 slides.
      </EmailText>
      <EmailButton href={`${appUrl}/app/create/new`}>
        Testar os 3 modos agora
      </EmailButton>
      <EmailText>
        Dica de pro: o modo <strong>Link</strong> é o mais subestimado. Cola
        um artigo que você curtiu e deixa a IA adaptar pra sua voz.
      </EmailText>
    </EmailLayout>
  );
}

export default OnboardingHowItWorksEmail;
