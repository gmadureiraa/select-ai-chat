/**
 * Instagram post (legenda) — system prompt suffix.
 *
 * Refere-se ao TEXTO da legenda (caption) — quando o usuário pede carrossel
 * (slides + imagens), o tool routing vai pra `carousel.ts` em vez deste.
 *
 * Regras:
 *   - 1ª linha = gancho que para o scroll. Curta (≤90 chars).
 *   - Quebra visual entre o gancho e o desenvolvimento (linha em branco).
 *   - Desenvolvimento: 3-7 parágrafos curtos. Storytelling pessoal funciona muito.
 *   - CTA específico no fim — "salva pra rever" só se faz sentido com o conteúdo;
 *     "DM 'palavra'" se tem entrega real associada (manychat); pergunta aberta
 *     que gera comentários.
 *   - Hashtags: máximo 3 estratégicas no fim. ZERO no padrão Madureira.
 *   - Limite: 800-2200 chars. Insta legenda permite mais, mas perde retenção.
 */
import type { PlatformPromptInput } from './index.js';

export function buildInstagramPromptSuffix(input: PlatformPromptInput): string {
  const { briefing, tone, clientName, fewShotBlock, platformHint } = input;
  const parts: string[] = [];

  parts.push('## REGRAS PLATAFORMA: INSTAGRAM (legenda de post estático/feed)');
  parts.push(`
### Estrutura
1. **Hook (linha 1)** — ≤90 chars. Frase punchy que para o scroll. Pode ser
   confissão, dado contraintuitivo, ou cena concreta. NÃO comece com "Você sabia que".

2. **Linha em branco** (vai aparecer truncada no feed, dá espaço pro "mais").

3. **Desenvolvimento (3-7 parágrafos curtos)** — 1 a 3 linhas cada. Storytelling
   pessoal funciona muito bem aqui. Use 1ª pessoa quando o cliente é pessoa.

4. **CTA final** — específico, não genérico:
   - "Conta no comentário se passou por isso" (gera engajamento real)
   - "DM 'palavra' que eu mando o material" (quando tem material real)
   - "Salva pra rever" (SÓ se o conteúdo realmente justifica revisitar)
   NUNCA "siga pra mais conteúdo", NUNCA "compartilha com a rede".

### Hashtags
- Padrão geral: 0 hashtags. Algoritmo IG 2026 não premia hashtag em legenda.
- Se o cliente historicamente usa: MÁXIMO 3, todas no FIM da legenda (linha
  separada), e devem ser temáticas reais (não #marketingdigital).

### Formatação
- Texto puro. Markdown não renderiza no Insta.
- Emojis funcionais (→ / • / ✓) OK em listas, máximo 1 por parágrafo.
- ZERO emojis decorativos (🔥💡✨🚀💰🎯💪🏆⭐).
- ZERO frases tipo "anote aí" / "salva esse post" / "bora lá".

### Comprimento
- Total 800-2200 chars. Ideal 1000-1500.
- Menos de 500 = raso. Mais de 2500 = ninguém lê inteiro.

### Tom
- Voz do cliente **${clientName}**.
${tone ? `- Tom solicitado: ${tone}` : ''}
- Português brasileiro coloquial mas analítico (não giria pesada).
`);

  if (platformHint) parts.push(platformHint);
  if (fewShotBlock) parts.push(fewShotBlock);

  parts.push(`## BRIEFING
${briefing}

## TAREFA
Gere AGORA a legenda completa do post Instagram. Entregue APENAS o texto da
legenda, sem labels (\`**Legenda:**\`, \`**CTA:**\`), sem explicações.`);

  return parts.join('\n\n');
}
