

# Plano: Automações Criativas com Referências + Imagens Inteligentes

## Diagnóstico

1. **`getFullContentContext` não carrega `client_reference_library`** — a biblioteca de referências (artigos, inspirações, estudos de caso) nunca chega ao prompt das automações. A IA está criando "no vácuo", sem material de inspiração real.
2. **Imagens são geradas com prompts genéricos** — o `image_prompt_template` é básico ("Create an image for: título"). Não há busca inteligente de imagens na web nem geração contextualizada com a identidade visual do cliente.
3. **Só existe 1 automação de tweet (GM)** — falta diversidade de formatos e horários.

---

## Mudanças Necessárias

### 1. Injetar Biblioteca de Referências no Contexto de Geração

**Arquivo:** `supabase/functions/_shared/knowledge-loader.ts`

Adicionar uma etapa entre a seção 3 (exemplos favoritos) e seção 4 (top performers) na função `getFullContentContext`:

- Buscar `client_reference_library` do cliente (limite 5, ordenado por `created_at DESC`)
- Formatar como seção "MATERIAL DE REFERÊNCIA — USE COMO INSPIRAÇÃO"
- Incluir `title`, `content` (truncado a 800 chars), `reference_type` e `source_url`
- Isso garante que TODAS as gerações (automações, chat, canvas) tenham acesso às referências

### 2. Sistema de Imagem Inteligente para Automações

**Arquivo:** `supabase/functions/process-automations/index.ts`

Quando `auto_generate_image = true` e o conteúdo já foi gerado:

- Construir o prompt de imagem com base no **conteúdo gerado** (não só no título)
- Incluir referências visuais do cliente (`client_visual_references`) no prompt
- Usar o identity_guide para extrair paleta de cores e estilo visual
- Forçar formato correto baseado na plataforma (1:1 para Twitter, etc.)
- Adicionar instrução explícita de "NO TEXT" reforçada

O prompt de imagem passará a ser construído assim:
```
IDENTIDADE VISUAL: [cores, estilo da marca]
CONTEÚDO DO POST: [resumo do tweet/thread gerado]
ESTILO: [image_style da automação]
FORMATO: 1:1 (Twitter)
REGRA ABSOLUTA: Sem texto na imagem
```

### 3. Criar 4 Novas Automações via Migration SQL

**Arquivo:** Nova migration SQL (insert direto na tabela `planning_automations`)

Usando os dados do cliente Madureira (`c3fdf44d-1eb5-49f0-aa91-a030642b5396`):

| Automação | Tipo | Horário | content_type | auto_generate_image | Descrição |
|-----------|------|---------|--------------|---------------------|-----------|
| **Tweet Insight Diário** | daily | 12:00 | tweet | false | Tweet de insight/provocação baseado nas referências. Estilo rotativo via variation system |
| **Tweet Visual Diário** | daily | 18:00 | tweet | **true** | Tweet com imagem gerada pela IA. Prompt de imagem contextualizado pelo conteúdo |
| **Tweet Noturno** | daily | 21:00 | tweet | false | Tweet reflexivo/pergunta para engajamento noturno |
| **Thread Semanal** | weekly (terça) | 10:00 | thread | false | Thread profunda baseada em referências da biblioteca |

Cada automação terá um `prompt_template` rico que instrui a IA a:
- Consultar as referências da biblioteca para inspiração
- Usar tom e voz do identity_guide
- Variar o estilo (sistema de rotação já existente para tweets)
- Para a thread: explorar um tema em profundidade, com dados e insights

### 4. Prompt Templates Específicos

**Tweet Insight (12h):**
```
Crie um tweet único e impactante sobre o universo do cliente.
USE as referências da biblioteca como fonte de inspiração.
Traga um insight ORIGINAL baseado no material de referência.
NÃO seja genérico. Cite dados, tendências ou observações específicas.
```

**Tweet Visual (18h):**
```
Crie um tweet curto e impactante que será acompanhado de uma imagem.
O tweet deve COMPLEMENTAR a imagem, não descrevê-la.
Máximo 200 caracteres para deixar espaço visual.
Use insight das referências da biblioteca.
```

**Tweet Noturno (21h):**
```
Crie um tweet reflexivo ou uma pergunta provocativa para gerar conversa.
Baseie-se nas referências da biblioteca para trazer profundidade.
Tom mais pessoal e introspectivo.
```

**Thread Semanal (terça 10h):**
```
Crie uma thread de 7-12 tweets aprofundando um tema relevante.
OBRIGATÓRIO: Use as referências da biblioteca como base de pesquisa.
Traga dados, análises e insights originais.
Formato: 1/ 2/ 3/ etc. Máximo 280 chars cada.
Gancho forte no primeiro tweet. Último tweet pede RT.
```

---

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/_shared/knowledge-loader.ts` | Adicionar carregamento de `client_reference_library` no `getFullContentContext` |
| `supabase/functions/process-automations/index.ts` | Melhorar construção do prompt de imagem usando conteúdo gerado + identidade visual |
| Nova migration SQL | Inserir 4 automações para o cliente Madureira |

---

## Resultado Esperado

- **Tweets nunca mais genéricos** — IA sempre terá material de referência real para se inspirar
- **3 tweets/dia** em horários diferentes com estilos diferentes (insight, visual, reflexivo)
- **1 thread/semana** profunda baseada nas referências
- **Imagens contextualizadas** — geradas com base no conteúdo real + identidade visual do cliente
- O sistema de variação (8 categorias) continua ativo para evitar repetição

