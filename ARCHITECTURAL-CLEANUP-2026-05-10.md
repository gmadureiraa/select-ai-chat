# Architectural cleanup — 2026-05-10

3 limpezas que pesavam no overview do app. Cada uma virou um commit
isolado pra facilitar revert se precisar. `bun run build` validado
após cada commit.

Branch: `combo-viral-integration`.

---

## Tarefa 1 — Dedup Clientes

**O que estava**

A tela de clientes tinha dois caminhos pra mesma renderização:

- `src/components/clients/ClientsManagementTool.tsx` — montado dentro
  do `Kai.tsx` quando `?tab=clients`.
- `src/components/clients/ClientsListPage.tsx` — montado pela rota
  dedicada `/kaleidos/clients` (Route element em `App.tsx`).

Os dois mostravam grid de clientes + busca + dialog de edit, com
discrepâncias mínimas (ClientsListPage usa `ClientOnboardingWizard`
de 5 steps; ClientsManagementTool usa `ClientDialog` simples).
Mantinham bookmarks e UX inconsistentes.

**O que ficou**

Decisão: ficar com `ClientsListPage` (rota dedicada → mais
bookmarkable, mais simples de linkar). `?tab=clients` agora é
redirecionado pra `/kaleidos/clients`, preservando o `clientId` via
query string. `ClientsManagementTool` permanece no repo como
referência mas não é mais importado nem montado em rota nenhuma.

**Arquivos editados**

- `src/pages/Kai.tsx` — `useNavigate` + early-redirect no useEffect
  de route protection. Removido `case "clients"` do `renderContent` e
  removido import lazy de `ClientsManagementTool`. `clients` removido
  de `toolTabs`.
- `src/components/kai/KaiSidebar.tsx` — NavItem `Perfis` agora
  navega direto pra `/kaleidos/clients` (com `?client=<id>` quando
  selectedClientId existe) em vez de chamar `onTabChange("clients")`.
  Active state inclui `useLocation` pra detectar a rota dedicada.

**Migration / redirect**

- `?tab=clients` → `Navigate to "/kaleidos/clients"` (replace).
  Permission gate `canViewClients` continua valendo: viewer sem
  permissão cai em `tab=planning`.
- Bookmarks antigos `?tab=clients&client=<id>` continuam funcionando
  (clientId é preservado na URL final).
- `KaiSidebar` Perfis agora chama `navigate()` direto.

**Commit:** `c656d84d` — *dedup clientes: tab=clients redireciona pra rota dedicada /kaleidos/clients*

---

## Tarefa 2 — AutomationsTab quebrar em sub-tabs

**O que estava**

`src/components/automations/AutomationsTab.tsx` (1.262 linhas)
misturava 3 conceitos sob 2 tabs (Planning vs Workflows AI):

1. **Gatilhos cron-like** — automations com `trigger_type=schedule`
   (diário, semanal, mensal — recorrência periódica).
2. **Recorrência via feed** — automations com `trigger_type=rss`
   (novo item no feed → cria card) e `trigger_type=webhook` (chamada
   externa → cria card).
3. **Atalhos de IA** — `ai_workflows` (agentes Madureira-style com
   cron próprio + prompt versionado + run history).

Os 3 conviviam num filtro `triggerFilter` raso, com stats globais
misturando os tipos. Confuso pro user que queria configurar uma
automação específica.

**O que ficou**

3 sub-tabs canônicas com `Tabs` do shadcn:

- **Agendamentos** (`schedule`) — só `trigger_type=schedule`. Filtro
  de tipo de trigger oculto (escopo único). Stats mostram contagem
  "Agendadas" diretamente.
- **Feeds & Webhooks** (`feeds`) — `trigger_type IN (rss, webhook)`.
  Filtro de tipo permite escolher entre os dois. Stats mostram
  "RSS + Webhooks" combinado.
- **Workflows AI** (`workflows`) — seção já existente, agora
  isolada visualmente com sua própria copy contextual.

Cada sub-tab tem `TabHeader` com eyebrow/title/description próprios
pra fazer sentido sozinha. Botão "Nova automação" só aparece nas duas
primeiras (workflows são editados via dialog admin).

**Arquivos editados**

- `src/components/automations/AutomationsTab.tsx` — tipo `MainTab`
  com union `'schedule' | 'feeds' | 'workflows'`. Computa
  `tabAutomations` filtrando por escopo da sub-tab antes do
  `clientFilter/triggerFilter`. Componente novo
  `PlanningAutomationsList` compartilha o render entre as duas
  sub-tabs de planning. Stats reduzidos de 4 cards pra 3
  (Total / Ativas / contagem por escopo). Skeleton de loading
  ajustado (`grid-cols-3`).

**Migration / redirect**

- Estado interno `activeMainTab` migrou de `'planning'` (default
  antigo) pra `'schedule'` (novo default). Sem URL persistente,
  então quem entrava direto na tab `automations` agora aterrissa em
  Agendamentos em vez de Planning. Workflows continuam acessíveis na
  3ª sub-tab.
- A URL `?tab=automations` continua válida.

**Commit:** `9735d70c` — *automacoes: split em 3 sub-tabs (Agendamentos / Feeds & Webhooks / Workflows AI)*

---

## Tarefa 3 — ClientEditTabs reduzir 9 abas pra 3 grupos

**O que estava**

`src/components/clients/ClientEditTabsSimplified.tsx` (694 linhas)
tinha 9 tabs horizontais dentro do dialog de edit cliente:

1. Perfil (Sobre)
2. Digital (redes sociais)
3. Referências (docs + refs + visuals merged)
4. Integrações
5. Viral
6. Contexto IA
7. MCP
8. Notif
9. Analytics

Em mobile usava scroll horizontal; em desktop ocupava `grid-cols-9`.
Sem agrupamento visual, dificultando navegação e priorização.

**O que ficou**

Pattern de `SettingsTab` + `SettingsNavigation`: sidebar lateral
agrupada em 3 grupos + main com section ativa.

- **Identidade** — Sobre, Redes, Contexto IA  *(quem é o cliente)*
- **Conteúdo** — Referências, Integrações  *(o que alimenta os geradores)*
- **Performance & Configs** — Viral, Analytics, Notificações, MCP

Cada section monta lazy (só a active renderiza), evitando montar
componentes pesados como `AIContextTab` ou `ClientAnalyticsTab` quando
não estão visíveis.

**Arquivos editados / criados**

- `src/components/clients/ClientEditNavigation.tsx` *(novo)* —
  espelha `SettingsNavigation`. Desktop = sidebar vertical 192px
  agrupada por (Identidade · Conteúdo · Performance & Configs).
  Mobile = chips horizontais flat com scroll. Indicador de
  completude (verde/âmbar/vermelho com done/total) por item da nav,
  via prop `completion`.
- `src/components/clients/ClientEditTabsSimplified.tsx` —
  substituiu o bloco `<Tabs defaultValue="profile">` (9 tabs +
  TabsContent) por sidebar nav + render condicional por
  `activeSection`. `TabCompletionDot` removido daqui (migrou pra
  ClientEditNavigation). Imports lucide limpos. Inputs receberam `id`
  + `htmlFor` corretos no Label. Ícones decorativos com
  `aria-hidden="true"`. Fields mobile-first via `grid-cols-1 sm:grid-cols-2`.
- `src/components/clients/ClientEditDialog.tsx` — `DialogContent`
  width subiu de `max-w-3xl` pra `max-w-5xl` pra acomodar sidebar
  lateral + main.

**Migration / redirect**

- Estado `activeSection` é local (não persistido em URL — mesma
  abordagem da versão antiga com Tabs). Default: `"profile"`.
- Permissões/role intactas — não mexi em `canManageBilling`,
  `canViewClients`, etc.
- Renomeação interna de IDs: `notifications`/`mcp`/`analytics`/`viral`
  permanecem com mesmos valores que tinham nas tabs (pra evitar
  divergência semântica caso a URL persistir no futuro).

**Commit:** `39e7c508` — *perfil cliente: 9 tabs viraram sidebar com 3 grupos (Identidade / Conteudo / Performance)*

---

## Validação

`bun run build` rodou clean após cada um dos 3 commits. Tokens
semânticos (`bg-card`, `bg-muted`, `text-muted-foreground`,
`focus-visible:ring-ring`) preservados. PT-BR em todas as copies.
Permissões de role não tocadas. Não toquei em
`src/components/planning/` nem em
`src/components/kai/viral-radar-original/` (outros agentes).
Nenhum componente foi deletado — só reorganizei/redirecionei.
