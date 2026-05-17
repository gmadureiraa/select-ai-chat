/**
 * Carrossel (Instagram / LinkedIn) — system prompt suffix.
 *
 * IMPORTANTE: NÃO substitui o pipeline `createViralCarousel` (que gera slides
 * + imagens via Sequência Viral). Esse builder é usado APENAS quando o
 * tool routing entra em `createContent` mas o formato pedido é carrossel
 * textual (sem imagens) — fluxo legacy/fallback.
 *
 * O LLM gera N slides separados por `---` numa linha sozinha + uma legenda
 * abaixo. O parser em `editContent`/`createContent` reconhece esse separador.
 */
import type { PlatformPromptInput } from './index.js';

export function buildCarouselPromptSuffix(input: PlatformPromptInput): string {
  const { briefing, tone, clientName, fewShotBlock, platformHint } = input;
  const parts: string[] = [];

  parts.push('## REGRAS PLATAFORMA: CARROSSEL TEXTUAL (Instagram / LinkedIn)');
  parts.push(`
### Estrutura
- **8-10 slides** no total (incluindo capa + slide final de CTA).
- Capa: headline impactante (≤8 palavras) + subheadline curta opcional (≤12 palavras).
- Slides 2 a N-1: cada um entrega UM ponto/insight/passo. Máximo 30 palavras por slide.
- Slide final: CTA específico (não genérico).

### Formato de entrega
\`\`\`
Slide 1 (Capa):
[Headline 8 palavras]
[Subheadline opcional 12 palavras]

---

Slide 2:
[Conteúdo do slide — max 30 palavras]

---

Slide 3:
[...]

---

Slide N (CTA):
[Call to action específico]

---

LEGENDA:
[Legenda do post no feed — gancho na linha 1, desenvolvimento curto, CTA]
\`\`\`

### Regras de copy
- Densidade alta: cada slide precisa entregar valor real, nada de filler.
- Números específicos > adjetivos vagos.
- Voz do cliente **${clientName}**.
${tone ? `- Tom solicitado: ${tone}` : ''}
- ZERO hashtags. ZERO emojis decorativos.
- ZERO frases tipo "salva pra rever", "compartilha com a rede" — exceto no
  slide final SE for o CTA específico.

### PROIBIDO
- Mais de 10 slides (excede atenção). Menos de 6 (raso demais).
- Slides com 1 palavra só (filler visual).
- Repetir o título da capa em outros slides.
`);

  if (platformHint) parts.push(platformHint);
  if (fewShotBlock) parts.push(fewShotBlock);

  parts.push(`## BRIEFING
${briefing}

## TAREFA
Gere AGORA o carrossel completo + legenda. SIGA o formato de entrega acima
RIGOROSAMENTE (separador \`---\` numa linha sozinha entre slides).`);

  return parts.join('\n\n');
}
