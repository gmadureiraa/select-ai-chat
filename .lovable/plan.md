

# Plano: Importar Conteudo do ClickUp para o Kai

## Resumo
Criar uma edge function que conecta na API do ClickUp, puxa todas as tarefas de abril em diante (200+), e insere como planning items no Kai -- organizados por cliente, formato, data, descricao e com imagens anexadas.

## Pre-requisitos
Voce ja tem `CLICKUP_CLIENT_ID` e `CLICKUP_CLIENT_SECRET` configurados. Porem, a API do ClickUp para leitura de tarefas funciona melhor com um **Personal API Token**. Vou precisar que voce adicione um secret `CLICKUP_API_TOKEN` com seu token pessoal (Settings > Apps no ClickUp).

## Arquitetura

```text
Edge Function "import-clickup"
         |
    ClickUp API v2
    /team/{team_id}/space  -->  Lista Spaces (= clientes)
    /space/{id}/list       -->  Lista Lists
    /list/{id}/task        -->  Busca Tasks (paginado, 100/vez)
    /task/{id}/attachment   -->  Busca Anexos
         |
    Mapeamento Space/Folder -> Cliente Kai
         |
    Insert planning_items + Upload imagens no Storage
```

## Etapas

### 1. Adicionar Secret `CLICKUP_API_TOKEN`
- Solicitar ao usuario o Personal API Token do ClickUp
- Armazenar como secret na edge function

### 2. Criar Edge Function `import-clickup/index.ts`
A funcao fara:

**a) Descoberta de estrutura**
- GET `/team` para obter o team_id
- GET `/team/{id}/space` para listar todos os Spaces
- Retornar a lista para o frontend mapear Space -> Cliente do Kai

**b) Importacao paginada**
- Para cada Space mapeado, buscar todas as Lists
- Para cada List, buscar Tasks com filtro `date_updated_gt` (01/04/2026) -- paginacao de 100 em 100
- Extrair: name, description (markdown), due_date, start_date, status, tags, custom_fields, assignees
- Buscar attachments de cada task

**c) Mapeamento de dados**

| ClickUp | Kai (planning_items) |
|---------|---------------------|
| task.name | title |
| task.description | content |
| task.due_date | scheduled_at ou due_date |
| task.status.status | column_id (mapear para kanban) |
| task.tags[] | labels[], content_type (inferir formato) |
| task.attachments[] | media_urls[] (upload para storage) |
| Space name | client_id (match por nome) |
| task.priority | priority |

**d) Upload de anexos**
- Download de cada attachment do ClickUp
- Upload para bucket `planning-media` no Storage
- Salvar URL publica em `media_urls`

**e) Deduplicacao**
- Usar campo `metadata.clickup_task_id` para evitar duplicatas em re-importacoes
- Upsert: se ja existe, atualiza; se nao, insere

### 3. Criar Interface de Importacao no Frontend
Componente `ClickUpImportDialog`:
- Step 1: Conectar (validar token)
- Step 2: Selecionar Spaces e mapear para clientes do Kai
- Step 3: Preview dos items encontrados (tabela com titulo, data, formato, cliente)
- Step 4: Confirmar e importar com progress bar

### 4. Mapeamento Automatico de Formato
Inferir `content_type` e `platform` a partir de:
- Tags do ClickUp (ex: "instagram", "stories", "newsletter", "tweet")
- Nome da List (ex: "Reels", "Carrossel", "Newsletter")
- Custom fields se existirem

### 5. Tratamento de Imagens
- Download paralelo (batch de 5) para nao sobrecarregar
- Suporte a JPG, PNG, MP4, PDF
- Fallback: se download falhar, salvar URL original do ClickUp no metadata

## Arquivos a Criar/Modificar

1. **`supabase/functions/import-clickup/index.ts`** -- Edge function principal
2. **`src/components/planning/ClickUpImportDialog.tsx`** -- UI de importacao
3. **`src/hooks/useClickUpImport.ts`** -- Hook com logica de chamada e progresso
4. **`src/components/planning/PlanningBoard.tsx`** -- Adicionar botao "Importar do ClickUp" no header

## Seguranca
- Token do ClickUp fica apenas server-side (edge function)
- Validacao de JWT do usuario na edge function
- Verificacao de workspace membership antes de inserir

## Estimativa
- ~200+ tasks com paginacao automatica
- Timeout da edge function: usar processamento em batches (50 tasks por chamada)
- Se necessario, dividir em multiplas chamadas com cursor de paginacao

