

# Plano: Melhorar Qualidade dos Tweets + Corrigir Imagens — Madureira

## Diagnóstico

### Conteúdo Fraco
Os tweets recentes são genéricos e cheios de "frase de impacto" sem substância:
- "80% dos projetos Web3 falham em marketing porque focam em hype"
- "Atenção não se compra, se conquista"
- "Sua crença de que 'conteúdo de qualidade' basta..."

Todos seguem o mesmo padrão: afirmação polêmica genérica → conclusão vaga. Zero conteúdo educacional, zero dados, zero aprendizado real.

### Imagem Ausente
Dos últimos 5 posts, apenas 1 tem imagem. O GM Tweet às 08:15 e 15:31 não geraram imagem apesar de `auto_generate_image: true`. Provavelmente o modelo retornou texto sem imagem em algumas tentativas e o sistema falhou silenciosamente.

## Solução

### 1. Reescrever TODOS os prompts do Twitter para conteúdo educacional

**7 automações afetadas:**

| Automação | Mudança |
|---|---|
| GM Tweet Madureira | De "GM genérico" → GM com micro-insight educacional do dia |
| 🧠 Tweet Insight Diário | De "opinião vaga" → ensinar 1 conceito específico com exemplo real |
| 🎨 Tweet Visual Diário | De "frase evocativa" → mini-aula visual com dado ou framework |
| 🌙 Tweet Noturno | De "reflexão filosófica" → pergunta educacional que gere debate técnico |
| 📚 Thread Semanal | Já é educacional, reforçar com dados obrigatórios |
| Tweet — Dica & Ferramenta | De "frase genérica" → dica ESPECÍFICA com nome de ferramenta real |

**Diretrizes dos novos prompts:**
- PROIBIDO frases de impacto genéricas sem substância
- OBRIGATÓRIO: ensinar algo, dar dado real, nomear ferramenta, explicar conceito
- Formato preferido: "Aprendi que X funciona porque Y. Exemplo: Z"
- Perguntas que gerem debate técnico, não concordância passiva
- Citar referências reais da biblioteca (dados on-chain, protocolos, ferramentas)

### 2. Habilitar imagem em mais automações
- Ativar `auto_generate_image: true` no "Tweet — Dica & Ferramenta" e "🧠 Tweet Insight Diário"
- Garantir que o `image_prompt_template` do anime esteja configurado

### 3. Melhorar resiliência da geração de imagem
- No `process-automations`, adicionar log mais explícito quando imagem falha
- Garantir que se a primeira tentativa falhar, o retry funcione

## Implementação
- **6 UPDATEs** na tabela `planning_automations` (via insert tool) para novos `prompt_template`
- **2 UPDATEs** para habilitar `auto_generate_image` + `image_prompt_template` 
- **1 edit** no `process-automations/index.ts` para melhorar logs de falha de imagem

