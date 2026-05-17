/**
 * Blog post / Newsletter long-form — system prompt suffix.
 *
 * Atende:
 *   - Blog post (≥1000 chars, com H2/H3, intro, conclusão, CTA)
 *   - Newsletter (subject + preview + body com 300-2000 chars)
 *   - Artigo no X / Medium / Substack (1000-3000 chars)
 */
import type { PlatformPromptInput } from './index.js';

export function buildBlogPromptSuffix(input: PlatformPromptInput): string {
  const { briefing, tone, clientName, fewShotBlock, platformHint } = input;
  const parts: string[] = [];

  parts.push('## REGRAS FORMATO: LONG-FORM (BLOG / NEWSLETTER / ARTIGO)');
  parts.push(`
### Estrutura obrigatória
1. **Título** (≤60 chars) — claro, com benefício ou pergunta provocativa.
2. **Intro (2-3 parágrafos curtos)** — hook + contextualização + promessa do
   que o leitor vai tirar. Sem floreio "vamos explorar".
3. **3-5 seções com H2** — cada seção entrega UM bloco temático. Pode ter
   H3s internos pra organizar listas/sub-passos.
4. **Conclusão (1-2 parágrafos)** — resumo do insight central + CTA específico.
5. **CTA** — pode ser pergunta aberta, link pra outro material do cliente,
   ou ação prática.

### Formatação
- Markdown OK aqui (blog renderiza, newsletter também).
- Use \`##\` pra H2 e \`###\` pra H3.
- Negrito (\`**\`) com moderação — destaque palavra-chave, não frase inteira.
- Listas com bullet ou numeradas quando faz sentido.
- Parágrafos curtos (2-4 linhas). Quebra visual ajuda leitura.

### Newsletter especificamente
- Comece com **SUBJECT:** [linha de assunto ≤50 chars]
- Em seguida **PREVIEW:** [preview text ≤90 chars]
- Saudação curta (1 linha) — opcional, fica pessoal se cliente prefere.
- Corpo na estrutura padrão (intro + seções + conclusão + CTA).
- Assinatura curta no fim (opcional).

### Comprimento
- Blog post: 800-2500 palavras.
- Newsletter: 300-1500 palavras.
- Artigo X / Medium: 800-2000 palavras.

### Tom
- Voz do cliente **${clientName}**.
${tone ? `- Tom solicitado: ${tone}` : ''}
- PT-BR. Analítico mas acessível.

### Densidade
- Cada parágrafo precisa entregar UM ponto concreto. Sem repetir.
- Números > adjetivos. Cite fontes quando usar dado externo.
- Storytelling pessoal funciona muito em intro e exemplos.

### PROIBIDO
- "Hoje vamos falar sobre" / "Neste post você vai aprender"
- "Antes de mais nada" / "Em primeiro lugar"
- "Em conclusão" / "Para concluir" / "Em resumo"
- Hashtags (mesmo em blog — sai feio)
- "Compartilha esse post" no fim — substitua por CTA real
`);

  if (platformHint) parts.push(platformHint);
  if (fewShotBlock) parts.push(fewShotBlock);

  parts.push(`## BRIEFING
${briefing}

## TAREFA
Gere AGORA o conteúdo completo. Entregue pronto pra publicar (markdown OK),
sem rótulos meta, sem explicações.`);

  return parts.join('\n\n');
}
