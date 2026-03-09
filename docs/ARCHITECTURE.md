# 🏗️ Arquitetura do Sistema Kaleidos
> Última atualização: 09 de Março de 2026

## Visão Geral

O Kaleidos é uma plataforma SaaS de criação de conteúdo com IA, construída com **React + Vite + TypeScript** no frontend e **Supabase (Lovable Cloud)** no backend. A arquitetura é orientada a workspaces multi-tenant com controle de acesso granular por cliente.

---

## 📐 Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Estado | TanStack React Query + Zustand-like hooks |
| Roteamento | React Router v7 (workspace-based) |
| Backend | Supabase (Postgres + Edge Functions + Auth + Storage) |
| IA | Lovable AI (Gemini, GPT) via módulo `_shared/llm.ts` |
| Publicação Social | Late API (getlate.dev) |
| Scraping | Firecrawl |
| Pagamentos | Stripe |

---

## 🗂️ Estrutura do Projeto

```
src/
├── pages/              # Páginas principais (Kai, Settings, Login, etc.)
├── components/
│   ├── kai/            # Hub principal (chat, canvas, library, performance, docs)
│   ├── planning/       # Kanban + Calendário + Automações
│   ├── engagement/     # Hub de engajamento Twitter
│   ├── onboarding/     # Fluxo de onboarding
│   ├── automations/    # Configuração de automações
│   ├── clients/        # Gestão de clientes
│   ├── library/        # Content Library + Reference Library
│   ├── performance/    # Dashboards de métricas
│   ├── settings/       # Configurações do workspace
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom hooks (useClients, useChat, usePlanning, etc.)
├── types/              # TypeScript types
└── integrations/
    └── supabase/       # Auto-generated client + types

supabase/
├── functions/          # 70+ Edge Functions
│   ├── _shared/        # Módulos compartilhados (LLM, validação, formatos)
│   ├── kai-simple-chat/    # Motor principal do kAI Chat (2600+ linhas)
│   ├── unified-content-api/ # Pipeline de geração de conteúdo
│   ├── kai-content-agent/   # Agente de criação de conteúdo (streaming)
│   ├── kai-planning-agent/  # Agente de planejamento
│   ├── kai-metrics-agent/   # Agente de métricas
│   ├── late-post/           # Publicação via Late API
│   └── ...
└── migrations/         # SQL migrations
```

---

## 🔐 Modelo de Acesso

### Hierarquia
```
Workspace (tenant)
├── Owner (dono)
├── Admin (gerência)
├── Member (colaborador)
├── Viewer (somente leitura)
└── Clients (marcas/projetos)
    ├── Content Library
    ├── Reference Library
    ├── Visual References
    ├── Documents
    ├── Social Credentials
    ├── Conversations (kAI Chat)
    └── Planning Items
```

### RLS (Row Level Security)
- Todas as tabelas usam RLS baseado em `workspace_id`
- Funções `SECURITY DEFINER` para checks de permissão:
  - `is_workspace_member(user_id, workspace_id)`
  - `can_modify_data(user_id)` — owner/admin/member
  - `can_delete_in_workspace(user_id)` — owner/admin
  - `is_viewer_role(user_id)` — restringe escrita
- Viewer não pode criar/editar conteúdo

### Tokens & Billing
- Cada workspace tem `workspace_tokens` com saldo
- Cada chamada de IA debita tokens via `debit_workspace_tokens()`
- Planos: Free → Pro → Enterprise
- Stripe para checkout e portal do cliente

---

## 🧠 Módulos Compartilhados (`_shared/`)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `llm.ts` | Chamadas LLM com retry + fallback entre providers |
| `format-constants.ts` | FORMAT_MAP, PLATFORM_MAP, CONTENT_TYPE_LABELS |
| `format-schemas.ts` | Schemas de validação por formato |
| `format-rules.ts` | Regras de formato do workspace |
| `content-validator.ts` | Validação estrutural do conteúdo gerado |
| `quality-rules.ts` | Regras universais de qualidade + frases proibidas |
| `knowledge-loader.ts` | Carrega contexto do cliente (identity, library, voice) |
| `ai-usage.ts` | Logging de uso de IA |
| `tokens.ts` | Gerenciamento de tokens do workspace |

---

## 🔄 Fluxos Principais

### 1. Geração de Conteúdo
```
Usuário → kAI Chat / Canvas / Automação
  → Detecta formato + intenção
  → Carrega contexto (identity guide, library, voice profile)
  → unified-content-api OU kai-content-agent
  → Pipeline: Writer → Validate → Repair → Review
  → Conteúdo final + metadados
```

### 2. Publicação Social
```
Planning Item → "Publicar"
  → late-post (Edge Function)
  → Late API (getlate.dev)
  → Plataforma (Instagram, Twitter, LinkedIn, etc.)
  → Status atualizado no planning_items
```

### 3. Automações
```
Trigger (RSS/Agenda/Webhook)
  → process-automations / process-recurring-content
  → Gera conteúdo via unified-content-api (se AI habilitada)
  → Cria card no Planning
  → Auto-publish (opcional) via late-post
```

### 4. Métricas
```
Cron Jobs → collect-daily-metrics / weekly-metrics-update
  → fetch-instagram-metrics / fetch-youtube-metrics / fetch-late-metrics
  → Armazena em instagram_posts, linkedin_posts, youtube_videos
  → Dashboard de Performance
```

---

## 📊 Tabelas Principais do Banco

| Tabela | Descrição |
|--------|-----------|
| `workspaces` | Tenants do sistema |
| `workspace_members` | Membros com roles |
| `clients` | Marcas/projetos dentro do workspace |
| `conversations` / `messages` | Histórico do chat principal |
| `kai_chat_conversations` / `kai_chat_messages` | Histórico do kAI Chat |
| `client_content_library` | Biblioteca de conteúdo |
| `client_reference_library` | Referências externas |
| `planning_items` | Cards do Kanban/Calendário |
| `kanban_columns` | Colunas do Kanban |
| `scheduled_posts` | Posts agendados |
| `automations` / `automation_runs` | Automações e execuções |
| `format_rules` | Regras de formato customizadas |
| `global_knowledge` | Base de conhecimento global |
| `ai_usage_logs` | Logs de uso de IA |
| `workspace_tokens` / `token_transactions` | Sistema de créditos |
| `instagram_posts` / `linkedin_posts` | Métricas de redes sociais |
| `engagement_opportunities` | Oportunidades de engajamento Twitter |

---

## 🌐 Roteamento

O app usa roteamento baseado em workspace slug:

```
/                          → Landing Page
/login                     → Login
/:workspaceSlug/           → Hub kAI (página principal)
/:workspaceSlug/planning   → Planejamento (Kanban/Calendário)
/:workspaceSlug/settings   → Configurações
/:workspaceSlug/docs       → Documentação interna
/:workspaceSlug/help       → Central de ajuda
```

O componente `WorkspaceRouter` resolve o slug e injeta o workspace context em toda a árvore de componentes.

---

## 🔔 Notificações

- **In-app**: Tabela `notifications` com tipos (publish_reminder, automation_complete, etc.)
- **Push**: Service Worker + Web Push via `push_notification_queue`
- **Email**: Queue `email_notification_queue` processada por edge function
- Preferências por usuário em `profiles.notification_preferences`

---

*Última atualização: Março 2025*
