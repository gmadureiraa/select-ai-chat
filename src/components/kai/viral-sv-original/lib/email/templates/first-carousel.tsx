import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
} from "./_layout";

export function FirstCarouselEmail({
  name,
  carouselTitle,
  appUrl,
}: {
  name?: string;
  carouselTitle: string;
  appUrl: string;
}) {
  const firstName = (name || "").trim().split(" ")[0] || "você";
  return (
    <EmailLayout preview="Primeiro carrossel salvo. Próximos passos.">
      <EmailKicker>Primeira geração</EmailKicker>
      <EmailHeadline>Mandou bem, {firstName}.</EmailHeadline>
      <EmailText>
        Seu primeiro carrossel <em>“{carouselTitle}”</em> tá salvo na
        biblioteca. Dá pra editar, duplicar ou exportar a qualquer hora.
      </EmailText>
      <EmailButton href={`${appUrl}/app/carousels`}>
        Abrir minha biblioteca
      </EmailButton>
      <EmailText>
        Tip: regenera a capa no editor (botão ✦ Nova capa) se quiser outra
        imagem cinemática. Ou troca de template (Futurista ↔ Twitter) no passo
        02 sem perder o conteúdo.
      </EmailText>
      <EmailText>
        Quando atingir 3 carrosséis no mês, a gente te manda um email com
        atalho pra Pro — mais limite, sem marca d&apos;água.
      </EmailText>
    </EmailLayout>
  );
}

export default FirstCarouselEmail;
