/**
 * LinkedIn long-form post — system prompt suffix.
 *
 * Regras chave (decididas com Gabriel após bug 2026-05-16):
 *   - Hook: 2-3 linhas curtas (~120-180 chars total) — aparece antes do
 *     "ver mais". Tem que prender SEM dar a resposta inteira.
 *   - Corpo: 5-12 parágrafos curtos (1-3 linhas cada), com quebras visuais.
 *     LinkedIn não renderiza markdown — usar emoji só pra ponto-de-lista
 *     (•, →) E NUNCA decorativo (🔥💡✨).
 *   - CTA: pergunta aberta no fim (gera comentários) OU convite específico
 *     ("conta no DM se passou por isso"). NÃO "siga + curta + compartilhe".
 *   - Hashtags: ZERO no padrão Madureira. Cliente pode override no spec.
 *   - Limite: 1500-2500 chars (sweet spot LinkedIn 2026).
 *   - PROIBIDO: "Olá rede", "Bom dia LinkedIn", "Queridos seguidores", "Hot take:".
 */
import type { PlatformPromptInput } from './index.js';

export function buildLinkedInPromptSuffix(input: PlatformPromptInput): string {
  const { briefing, tone, clientName, fewShotBlock, platformHint } = input;
  const parts: string[] = [];

  parts.push('## REGRAS PLATAFORMA: LINKEDIN LONG-FORM');
  parts.push(`
### Estrutura obrigatória
1. **Hook (linhas 1-2)** — frase curta de 60-90 chars que para o scroll. Pode ser:
   - Confissão/admissão ("Demorei 3 anos pra entender isso.")
   - Dado contraintuitivo ("80% dos founders fazem X. Eu faço o oposto.")
   - Cena concreta ("Reunião de quarta. Cliente fala uma frase que mudou tudo.")
   NÃO comece com saudação, NÃO comece com pergunta vazia, NÃO use "Hot take:".

2. **Espaço em branco entre o hook e o desenvolvimento.** LinkedIn corta no "ver mais".
   O leitor PRECISA querer expandir.

3. **Desenvolvimento (5-12 parágrafos curtos)** — 1 a 3 linhas cada, separados
   por linhas em branco. Cada parágrafo entrega UM insight. Sem floreio.

4. **CTA final** — pergunta aberta ou convite específico. Exemplos bons:
   - "Você já passou por isso? Conta no comentário."
   - "Se quiser o template que eu uso, manda DM 'template'."
   - "Discordo? Comenta o por quê."
   Exemplos RUINS:
   - "Curte se concorda! Compartilha com a rede!" (genérico, AI-ish)
   - "Siga pra mais conteúdo!" (spam)

### Formatação
- ZERO markdown (LinkedIn não renderiza). Use texto puro.
- Emojis funcionais (• → ✓) em listas, MÁXIMO 1 por parágrafo. ZERO emojis
  decorativos (🔥💡✨🚀💰🎯💪).
- ZERO hashtags na regra padrão. Se o cliente tem cadência diferente, o
  contexto histórico avisa.
- Negrito (com **palavra**) NÃO funciona no LinkedIn — não use. Pra ênfase,
  reescreva a frase.

### Comprimento
- Hook + desenvolvimento + CTA = 1200-2500 chars no total. Idealmente 1500-2000.
- Se ficar menos de 800, o post é raso. Se passar de 3000, é overkill.

### Tom de voz
- Voz do cliente **${clientName}** acima da voz LinkedIn-genérico.
- 1ª pessoa quando o cliente é uma pessoa (founder/criador). 3ª pessoa
  institucional quando o cliente é uma empresa.
${tone ? `- Tom solicitado: ${tone}` : ''}

### PROIBIDO especificamente em LinkedIn
- "Olá rede" / "Bom dia LinkedIn" / "Queridos seguidores"
- "Hot take:" / "Unpopular opinion:" / "A verdade é que..."
- Listas com bullets sem contexto (cada bullet precisa de 1-2 linhas de elaboração)
- Frases tipo "Vamos explorar X" / "Aqui está o que aprendi"
- Pedidos de engagement no final ("salva pra ler depois", "compartilha")
`);

  if (platformHint) {
    parts.push(platformHint);
  }
  if (fewShotBlock) {
    parts.push(fewShotBlock);
  }

  parts.push(`## BRIEFING
${briefing}

## TAREFA
Gere AGORA o post LinkedIn completo. Entregue APENAS o texto do post, pronto
pra colar no editor. Sem rótulos, sem explicações, sem "aqui está".`);

  return parts.join('\n\n');
}
