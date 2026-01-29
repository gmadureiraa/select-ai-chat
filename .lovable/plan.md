
# Plano: Área de Automações no Menu Principal

## Visão Geral

Criar uma área dedicada de **Automações** no menu lateral que permita configurar fluxos automatizados completos: RSS triggers → IA gera conteúdo → Publica automaticamente → Aparece no planejamento.

## O Que Já Existe (Base Sólida)

| Componente | Status | Local |
|------------|--------|-------|
| Hook `usePlanningAutomations` | Completo | `src/hooks/usePlanningAutomations.ts` |
| Componente `PlanningAutomations` | Completo | `src/components/planning/PlanningAutomations.tsx` |
| Dialog `AutomationDialog` | Completo | `src/components/planning/AutomationDialog.tsx` |
| Edge Function `process-automations` | Completo | `supabase/functions/process-automations/` |
| Edge Function `fetch-rss-feed` | Completo | `supabase/functions/fetch-rss-feed/` |
| Tabela `planning_automations` | Existe | Database |
| Sistema Late API (publish) | Funcional | `late-post`, `process-scheduled-posts` |

## O Que Falta Implementar

### 1. Nova Entrada no Menu Lateral

```text
┌─────────────────────────────┐
│  Canvas                     │
│  Planejamento               │
│  Performance                │
│  Biblioteca                 │
│  ★ Automações ★ ← NOVA      │
│  Perfis                     │
└─────────────────────────────┘
```

### 2. Nova Página de Automações

```text
┌────────────────────────────────────────────────────────────────┐
│  Automações                                    [+ Nova Autom.] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📰 Nova Newsletter → Post LinkedIn                       │  │
│  │ RSS: newsletter.substack.com • Última: há 2h             │  │
│  │ IA gera conteúdo ✓ • Publica auto ✓                      │  │
│  │ [▶ Ativo]                               [Editar] [Test]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🎬 Novo Vídeo YouTube → Thread Twitter                   │  │
│  │ RSS: youtube.com/feeds/videos.xml • Última: há 1d        │  │
│  │ IA gera conteúdo ✓ • Publica auto ✓                      │  │
│  │ [⏸ Pausado]                             [Editar] [Test]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📅 Dica Diária 09:00 → Post Instagram                    │  │
│  │ Schedule: Diário às 09:00 • Última: hoje 09:02           │  │
│  │ IA gera conteúdo ✓ • Publica manual                      │  │
│  │ [▶ Ativo]                               [Editar] [Test]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  [Ver Histórico de Execuções]                                  │
└────────────────────────────────────────────────────────────────┘
```

### 3. Dialog de Automação Melhorado

Adicionar ao dialog existente:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Nova Automação                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GATILHO                                                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │ 📅 Agenda   │ │ 📰 RSS Feed │ │ 🔗 Webhook  │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
│                                                                 │
│  URL do RSS Feed:                                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ https://www.youtube.com/feeds/videos.xml?channel_id=...   │  │
│  └───────────────────────────────────────────────────────────┘  │
│  [Testar Feed]                                                  │
│                                                                 │
│  PERFIL E PLATAFORMA                                            │
│  Perfil: [Kaleidos Digital ▼]  Plataforma: [LinkedIn ▼]         │
│                                                                 │
│  GERAÇÃO DE CONTEÚDO                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ✅ Gerar conteúdo com IA                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│  Prompt (use {{title}} e {{description}}):                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Com base no novo vídeo "{{title}}", crie um post para     │  │
│  │ LinkedIn que destaque os principais pontos...             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ★ PUBLICAÇÃO AUTOMÁTICA (NOVA SEÇÃO) ★                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ✅ Publicar automaticamente                                 ││
│  │    Quando a IA gerar, publica direto na plataforma          ││
│  │    ⚠️ Requer conta conectada (Late API)                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                                        [Cancelar] [Criar]       │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Fluxo Completo

```text
1. RSS detecta novo item (ex: novo vídeo YouTube)
         ↓
2. Edge function `process-automations` dispara
         ↓
3. Cria card no planejamento (coluna "Ideias" ou configurada)
         ↓
4. Se auto_generate_content = true:
   → Chama `kai-content-agent` para gerar conteúdo
         ↓
5. Se auto_publish = true E conta conectada:
   → Chama `late-post` para publicar
   → Move card para coluna "Publicado"
         ↓
6. Tudo aparece no planejamento com metadata da automação
```

---

## Mudanças Técnicas

### Arquivo 1: Adicionar campo `auto_publish` na tabela

```sql
ALTER TABLE planning_automations 
ADD COLUMN auto_publish BOOLEAN DEFAULT false;
```

### Arquivo 2: `src/components/kai/KaiSidebar.tsx`

Adicionar nova entrada de menu entre Biblioteca e Perfis:

```tsx
{/* Automações - Dev only por enquanto, depois Pro */}
{isDevUser && (
  <NavItem
    icon={<Zap className="h-4 w-4" strokeWidth={1.5} />}
    label="Automações"
    active={activeTab === "automations"}
    onClick={() => onTabChange("automations")}
    collapsed={collapsed}
  />
)}
```

### Arquivo 3: Criar `src/pages/kai/AutomationsTab.tsx`

Nova página que agrupa:
- Lista de automações ativas/pausadas
- Botão para criar nova
- Histórico de execuções
- Status de conexões (Late API)

### Arquivo 4: Atualizar `src/components/planning/AutomationDialog.tsx`

Adicionar seção de publicação automática:
- Switch para `auto_publish`
- Verificação se conta está conectada (Late API)
- Warning se não tiver conexão

### Arquivo 5: Atualizar `supabase/functions/process-automations/index.ts`

Após gerar conteúdo, se `auto_publish = true`:
1. Verificar se cliente tem conta conectada para a plataforma
2. Chamar `late-post` para publicar
3. Atualizar status do card para `published`
4. Salvar ID do post retornado

### Arquivo 6: Atualizar `src/hooks/usePlanningAutomations.ts`

Adicionar `auto_publish` ao tipo e mutações.

### Arquivo 7: Atualizar `src/pages/kai/KaiWorkspace.tsx`

Adicionar renderização da nova tab `automations`.

---

## Exemplos de Uso Final

### Exemplo 1: Newsletter → LinkedIn
```text
Gatilho: RSS feed do Beehiiv
Plataforma: LinkedIn
IA: "Transforme esta newsletter em um post executivo..."
Auto-publish: ✅
→ Toda nova newsletter vira post no LinkedIn automaticamente
```

### Exemplo 2: YouTube → Thread Twitter
```text
Gatilho: RSS do canal YouTube
Plataforma: Twitter
IA: "Crie uma thread de 5 tweets resumindo o vídeo..."
Auto-publish: ✅
→ Todo novo vídeo gera thread automática no Twitter
```

### Exemplo 3: Dica Diária
```text
Gatilho: Diário às 09:00
Plataforma: Instagram
IA: "Gere uma dica de produtividade baseada em tendências..."
Auto-publish: ❌ (revisão manual)
→ Card criado todo dia para revisar antes de postar
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/migrations/...` | Criar | Add `auto_publish` column |
| `src/pages/kai/AutomationsTab.tsx` | Criar | Nova página de automações |
| `src/components/kai/KaiSidebar.tsx` | Modificar | Adicionar menu Automações |
| `src/pages/kai/KaiWorkspace.tsx` | Modificar | Renderizar nova tab |
| `src/components/planning/AutomationDialog.tsx` | Modificar | Seção auto-publish |
| `src/hooks/usePlanningAutomations.ts` | Modificar | Tipo + auto_publish |
| `supabase/functions/process-automations/index.ts` | Modificar | Lógica de auto-publish |

---

## Resultado Esperado

1. **Menu lateral** com entrada "Automações" dedicada
2. **Página completa** para gerenciar todas automações
3. **Auto-publish funcional** via Late API
4. **Tudo no planejamento** - cards criados automaticamente aparecem no Kanban
5. **Histórico visível** - saber quando cada automação rodou
6. **Teste manual** - botão para testar automação antes de ativar
