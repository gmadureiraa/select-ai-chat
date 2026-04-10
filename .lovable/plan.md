

# Plano: Corrigir Importacao ClickUp + Novos Clientes + Deduplicacao + Anexos

## Problemas Identificados

1. **77 clickup_task_ids duplicados** no banco (387 items totais, muitos triplicados)
2. **Formato/plataforma incorreto**: items com `content_type=null` ou mapeamento errado (ex: tweets na lista "Twitter/X" sem content_type definido, items do blog com formato errado)
3. **Clientes faltando**: Paradigma Education, Hugo Doria, Ledger nao existem no Kai
4. **Conteudos do space Growth/Kaleidos** nao foram importados
5. **Anexos nao foram puxados** (media_urls vazio em todos os items)

## Etapas

### 1. Limpar Duplicatas
- SQL para manter apenas 1 registro por `clickup_task_id`, deletando os extras (manter o mais antigo)
- Sao 77 task_ids duplicados a corrigir

### 2. Criar 3 Novos Clientes
- Criar Paradigma Education, Hugo Doria e Ledger no workspace existente

### 3. Corrigir Mapeamento de Formato
Atualizar a edge function `import-clickup`:
- `inferContentType`: adicionar deteccao por nome da lista (ex: "Twitter/X" -> tweet, "Blog e News" -> blog_post, "LinkedIn" -> linkedin_post)
- `inferPlatform`: ja funciona bem, mas precisa cobrir mais casos
- Rodar UPDATE em batch nos items existentes que tem `content_type=null` baseado no `clickup_list` salvo no metadata

### 4. Atualizar Edge Function para Baixar Anexos
- Adicionar logica para buscar attachments via `/task/{id}?include_subtasks=true` (attachments vem no task detail)
- Download de cada arquivo e upload para bucket `planning-media`
- Salvar URLs no campo `media_urls`
- Processar em batches de 5 para nao dar timeout

### 5. Importar Conteudos Faltantes
- Chamar a edge function para importar listas de:
  - **Paradigma Education** (mapear para novo client_id)
  - **Hugo Doria** (mapear para novo client_id)
  - **Ledger** (mapear para novo client_id)
  - **Space Growth** -> conteudos Kaleidos (mapear para client Kaleidos existente)

### 6. Atualizar content_type dos Items Existentes
- UPDATE em batch baseado no metadata `clickup_list`:
  - "Twitter/X%" -> content_type='tweet', platform='twitter'
  - "Blog e News" -> content_type='blog_post', platform='blog'
  - "D-sec LinkedIn" -> content_type='linkedin_post', platform='linkedin'
  - "Newsletter%" -> content_type='newsletter', platform='newsletter'
  - "Stories%" -> content_type='stories', platform='instagram'
  - "Instagram%" sem content_type -> content_type='instagram_post'

## Arquivos a Modificar
1. `supabase/functions/import-clickup/index.ts` - melhorar inferencia + adicionar download de anexos
2. Migrations/inserts para criar clientes e limpar duplicatas

## Ordem de Execucao
1. Deletar duplicatas (SQL)
2. Criar clientes novos (SQL)
3. Corrigir content_type dos existentes (SQL UPDATE)
4. Atualizar edge function (anexos + melhor inferencia)
5. Rodar importacao dos clientes/spaces faltantes
6. Verificar resultado final

