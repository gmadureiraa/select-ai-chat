/**
 * Twitter/X — system prompt suffix.
 *
 * Cobre dois casos:
 *   1. Tweet único (≤280 chars) — quando briefing dá pra caber.
 *   2. Thread — quando briefing exige >280 chars ou usuário explicitamente
 *      pediu "thread"/"fio".
 *
 * O builder NÃO decide sozinho — ele instrui o LLM a:
 *   - tentar tweet único primeiro;
 *   - se ultrapassar 280 chars em SEM perder informação importante, virar
 *     thread numerada (1/N, 2/N, ...);
 *   - separar tweets da thread com `---` numa linha sozinha (compat
 *     com `parseThreadItems` em createContent.ts).
 *
 * Sem hashtags. Sem emojis decorativos. PT-BR padrão Madureira/Defiverso.
 */
import type { PlatformPromptInput } from './index.js';

export function buildTwitterPromptSuffix(input: PlatformPromptInput): string {
  const { briefing, tone, clientName, fewShotBlock, platformHint } = input;
  const parts: string[] = [];

  parts.push('## REGRAS PLATAFORMA: TWITTER / X');
  parts.push(`
### Tweet único (preferido se cabe)
- Limite ABSOLUTO: 280 chars (conte espaços + emojis = 2 chars cada).
- Estrutura: hook na primeira linha. Insight/dado no meio. Punch ou pergunta no fim.
- Pode usar até 1 emoji funcional total (👇 / → / ✓). ZERO emojis decorativos.
- ZERO hashtags. Twitter algoritmo penaliza hashtag em 2026.

### Thread (quando não cabe em 280)
- Comece com tweet 1 que prende (gancho + promessa do que vem).
- 1 tweet = 1 ideia. Sem encavalar 2 conceitos no mesmo.
- Numere "1/N", "2/N", "3/N" no INÍCIO de cada tweet.
- Separe tweets na resposta com uma linha contendo APENAS \`---\` (3 hifens).
- Último tweet: CTA leve OU resumo punchy. Sem "siga pra mais".

### Formatação (vale pros dois casos)
- Texto puro, sem markdown (X não renderiza ** ou _).
- Quebra de linha visual ajuda — Twitter respeita \\n.
- Português brasileiro. Voz do cliente **${clientName}**.
${tone ? `- Tom solicitado: ${tone}` : ''}

### PROIBIDO
- Hashtags (#palavra) — zero, mesmo "branded".
- "Hot take:" / "Unpopular opinion:" / "A verdade é que..."
- Emojis decorativos (🔥💡✨🚀💰🎯).
- "Siga pra mais conteúdo" / "salva esse tweet".
- Threads de >12 tweets — se passou disso, vira blog post.
`);

  if (platformHint) parts.push(platformHint);
  if (fewShotBlock) parts.push(fewShotBlock);

  parts.push(`## BRIEFING
${briefing}

## TAREFA
Decida se cabe em tweet único (≤280 chars) ou precisa virar thread.
- Tweet único: entregue só o texto, sem prefixo, sem explicação.
- Thread: numere "1/N", separe cada tweet com linha \`---\`, sem prefixo introdutório.`);

  return parts.join('\n\n');
}
