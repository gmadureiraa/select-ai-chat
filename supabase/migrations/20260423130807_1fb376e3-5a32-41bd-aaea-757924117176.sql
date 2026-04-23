UPDATE planning_automations
SET 
  content_type = 'viral_carousel',
  platform = 'instagram',
  platforms = ARRAY['instagram'],
  auto_generate_image = false,
  prompt_template = 'Crie um carrossel viral estilo "página de jornal" no Instagram do Jornal Cripto explicando a notícia abaixo em 8 slides curtos e impactantes (cada slide é um tweet com **negrito** estratégico).

NOTÍCIA RECEBIDA:
Título: {{title}}
Resumo: {{description}}
Link: {{link}}

INSTRUÇÕES:
- Slide 1 (capa): manchete impactante em estilo editorial financeiro. Use **CAPS** ou **negrito** na palavra-chave.
- Slide 2: contextualize — o que aconteceu, quando, quem está envolvido.
- Slides 3-6: desdobre 4 ângulos da notícia — impacto no mercado, reação dos players, dados/números relevantes, contexto histórico ou regulatório. Um insight por slide.
- Slide 7: análise editorial — o que essa notícia significa pro investidor cripto brasileiro. Tom afiado, sem genericidades.
- Slide 8 (CTA): chamada pra comentar, salvar ou seguir o Jornal Cripto pra mais análises.

TOM: editorial financeiro, sério mas acessível, em pt-BR. Zero hashtags. Zero emojis decorativos. **Negrito** em 1-3 termos por slide pra criar hierarquia visual.',
  image_prompt_template = NULL
WHERE id = 'fe3b56fe-9732-4afc-95dc-aebd9c42b001';