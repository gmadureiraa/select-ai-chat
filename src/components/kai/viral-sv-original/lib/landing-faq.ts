/** FAQ da landing — fonte única para UI (page) e JSON-LD (layout). */
export const LANDING_FAQ = [
  {
    q: "A IA copia o meu estilo?",
    a: "Não copia. Aprende. O Sequência Viral puxa seus últimos posts no perfil cadastrado, extrai padrões (vocabulário, ritmo, tipo de abertura, tabus) e usa isso como restrição. Você ainda pode adicionar regras manuais no onboarding (ex.: 'não uso hashtag', 'evito emoji'). O resultado é um carrossel que passa pelo teste do 'parece algo que eu escreveria'.",
  },
  {
    q: "A IA inventa coisas no carrossel?",
    a: "Não. A IA trabalha exclusivamente em cima da fonte que você colou: transcrição de vídeo, artigo, post do Instagram ou sua nota. Se não estiver na fonte, não entra no carrossel. No modo avançado você ainda revisa os ângulos antes da IA escrever, duas camadas de controle. Nada de alucinação.",
  },
  {
    q: "Quanto tempo leva pra gerar um carrossel?",
    a: "Em média 60 segundos do input ao carrossel completo com imagens. Transcrição de vídeos longos (>2h) e geração de imagens em picos podem adicionar alguns segundos, mas o fluxo é contínuo: você não fica esperando fase por fase.",
  },
  {
    q: "Posso usar os carrosséis comercialmente?",
    a: "Sim, todo conteúdo gerado é seu. Textos, imagens geradas, PNGs exportados: uso pessoal, cliente, agência, venda, não importa. Não cobramos royalty e não reclamamos autoria. A única coisa que pedimos é não republicar a ferramenta em si como se fosse sua.",
  },
  {
    q: "E se eu não gostar da imagem gerada?",
    a: "Três opções. Uma: regenera a imagem daquele slide específico (não re-gera o carrossel todo). Duas: troca pro modo 'sem imagem', fica só texto editorial e é rápido. Três: faz upload da sua própria foto/ilustração e a IA reajusta o layout em volta. Nenhuma dessas opções custa geração extra.",
  },
  {
    q: "Funciona com qualquer canal do YouTube?",
    a: "Qualquer vídeo público com áudio audível. Transcrevemos em português, inglês e espanhol. Vídeos acima de 2h podem levar alguns minutos extras. Lives e podcasts longos funcionam, rodamos transcrição em background enquanto você trabalha em outra coisa.",
  },
  {
    q: "Os carrosséis podem ser editados depois?",
    a: "Sim, tudo é editável inline: texto, tamanho da fonte, cor, template, ordem dos slides, variante do layout. Você pode reutilizar um carrossel antigo como base pra um novo e só trocar a fonte de conteúdo. Fluxo usado por agências pra padronizar entrega.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sem fidelidade. Cancela pelo painel em 2 cliques. Se cancelar no plano Pro no mesmo mês que assinou, fazemos rateio proporcional pros dias usados. No plano Creator, o mês em curso continua ativo até o próximo ciclo e depois não renova.",
  },
  {
    q: "Quem tá por trás do Sequência Viral?",
    a: "Sequência Viral é um produto da Kaleidos Digital, agência brasileira de marketing de conteúdo que atende criadores, fintechs e projetos cripto/web3. A gente cansou de ver copy genérica dominando o feed e fez a ferramenta que queríamos usar com os nossos clientes.",
  },
] as const;
