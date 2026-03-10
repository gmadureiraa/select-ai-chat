

# Melhorar Tweets do Madureira: Referências + Prompts

## Diagnóstico

Os tweets atuais são genéricos porque:
1. **A biblioteca de referências tem conteúdo errado** — as refs existentes são artigos longos sobre Web3 marketing, não exemplos de tweets virais no estilo desejado
2. **Os prompts pedem estilo "professor/educacional"** — mas os exemplos que você mostrou são conversacionais, provocativos, com listas e perguntas ao leitor
3. **O knowledge-loader já injeta referências** (limit 5) mas as refs atuais não refletem o tom certo

## Plano

### 1. Adicionar 5 referências de tweet na biblioteca do Madureira

Inserir via SQL os exemplos que você enviou como `reference_type: 'tweet'`:
- "Sistema de criação diária" (processo Kaleidos)
- "Profissões do digital" (lista com salários)
- "IPVA imposto sobre imposto" (opinião provocativa curta)
- "iPhone vs petróleo" (comparação financeira com tabela)
- "Seu carro e sua casa não são seus" (provocação + pergunta)
- "Prioridade quando o dinheiro entra" (lista prática + pergunta)

### 2. Atualizar os prompts das automações de Twitter

Reescrever os prompts de **3 automações** para refletir o estilo real dos exemplos:

| Automação | Mudança no prompt |
|-----------|-------------------|
| 🧠 Tweet Insight Diário | Trocar tom "professor" por conversacional/provocativo. Formatos: lista, comparação, opinião forte + pergunta |
| Tweet — Dica & Ferramenta | Expandir para incluir listas práticas, dados financeiros, comparações do dia-a-dia |
| 🎯 Tweet Marketing & Growth | Incluir formatos de opinião, provocação e listas — não só educacional |

Cada prompt terá instrução explícita: **"USE as referências da biblioteca como MODELO DE ESTILO E FORMATO. Replique a estrutura, tom e engajamento desses exemplos."**

### 3. Aumentar peso das referências no knowledge-loader

Mudar a instrução de `"NÃO copie — reinterprete"` para algo mais direto: **"REPLIQUE o formato e tom desses exemplos. Use a mesma estrutura (listas, perguntas, provocações) adaptando o tema."**

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| Database | INSERT 6 referências na `client_reference_library` |
| Database | UPDATE prompt_template de 3 automações |
| `supabase/functions/_shared/knowledge-loader.ts` | Reforçar instrução de uso das referências como modelo de estilo |

