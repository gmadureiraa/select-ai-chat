# Mobile Nav + ThemeToggle

Mudanças do agente MOBILE-NAV (branch `combo-viral-integration`).

## Resumo

1. **MobileBottomNav** novo — barra de navegação inferior fixa, mobile only
2. **ThemeToggle** plugado em 4 lugares (sidebar desktop, mobile header, login, signup)
3. **Sidebar mobile** — confirmado: já usa `Sheet` (drawer) em mobile via `Kai.tsx` (não precisou mexer)

## Arquivos criados

- `src/components/kai/MobileBottomNav.tsx`
- `MOBILE-NAV.md` (este arquivo)

## Arquivos modificados

- `src/pages/Kai.tsx`
  - importa `MobileBottomNav`
  - adiciona `pb-16` no `<main>` quando mobile (espaço pra bottom nav não cobrir conteúdo)
  - renderiza `<MobileBottomNav />` ao final do shell quando `isMobile`
- `src/components/kai/MobileHeader.tsx`
  - importa `ThemeToggle`
  - renderiza `<ThemeToggle />` antes do `<NotificationBell />`
- `src/components/kai/KaiSidebar.tsx`
  - importa `ThemeToggle`
  - renderiza toggle no footer entre Notifications e Collapse Toggle
  - respeita estado `collapsed` (mostra só ícone quando colapsada)
- `src/pages/Login.tsx`
  - importa `ThemeToggle`
  - renderiza no canto top-right (`absolute top-4 right-4`)
- `src/pages/SimpleSignup.tsx`
  - mesma coisa do Login

## MobileBottomNav — detalhes

5 items na ordem da spec:

| # | Item | Tab destino | Ícone |
|---|---|---|---|
| 1 | Início | `home` | `Home` |
| 2 | Planejamento | `planning` | `CalendarDays` |
| 3 | kAI (centro destacado) | `assistant` | `MessageCircle` |
| 4 | Radar | `viral-radar-page` | `Radar` |
| 5 | Mais | dropdown | `MoreHorizontal` |

**"Mais"** abre um `DropdownMenu` (shadcn) com tabs secundárias:

- Tarefas (`tasks`)
- Performance (`performance`)
- Biblioteca (`library`)
- Biblioteca Viral (`viral-library`)
- Viral Hunter (`viral`)
- Carrossel (`viral-carrossel`)
- Reels (`viral-reels-page`)
- Configurações (`settings`)

### Decisões

- **Item central destacado**: bg-primary + ring branca (parece flutuando acima
  da barra). `relative -top-2` + `ring-4 ring-background` pra criar a borda.
- **Active state**: derivado de `useSearchParams().get("tab")`. Mostra
  bg-accent no botão + cor primary no ícone/label. Tab default é `home`.
- **`Mais` ativo**: quando a tab corrente está em `MORE_ITEMS`, "Mais" também
  fica destacado (caso o user esteja navegando em uma tab secundária).
- **Safe-area-inset-bottom**: aplicado via inline style pra suportar iPhones
  com home indicator. Tailwind 3.x não tem util pronta pra isso.
- **`md:hidden`**: classe nativa Tailwind. Em desktop a sidebar full toma o
  papel. Em mobile, sidebar vira drawer + bottom nav assume nav primária.
- **Navegação**: `navigate(/kaleidos?tab=...)`. `client` é preservado via
  `URLSearchParams` (não dropa quem o user já selecionou).
- **min-h-[44px]**: tap target acessível por padrão Apple HIG / WCAG.

### Por que não criar um tab `"more"` real

A spec sugeriu `tab: "more"` no item Mais, mas isso quebraria a redirect
logic do `Kai.tsx` (tab `more` cairia no fallback `HomeDashboard` ou no
redirect pro `planning`). Decidi por dropdown puro — UX padrão de apps
mobile (Twitter, Instagram, etc.).

## ThemeToggle — detalhes

Componente já existia em `src/components/ui/theme-toggle.tsx`, ninguém usava
fora do `SettingsTab.tsx` (que tem seu próprio seletor de tema). Plugado em:

1. **`KaiSidebar.tsx` (footer)** — entre `NotificationBell` e o Collapse Toggle.
   Quando sidebar colapsada, fica centralizado e mostra só ícone.
2. **`MobileHeader.tsx`** — direita, antes do bell e avatar. Tem `shrink-0`
   pra não ser comido pelo flex grow do clientName.
3. **`Login.tsx`** — `absolute top-4 right-4` no `<main>`. Funciona em
   light/dark theme.
4. **`SimpleSignup.tsx`** — idem.

ThemeProvider (next-themes) já estava no `App.tsx`:
`<ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="kai-theme">`.

## Responsividade — Part 3

KaiSidebar **já tinha lógica mobile correta** em `src/pages/Kai.tsx:529-549`:

```tsx
{isMobile && (
  <>
    <MobileHeader onMenuClick={() => setMobileMenuOpen(true)} ... />
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetContent side="left" className="p-0 w-72">
        <KaiSidebar ... isMobile={true} />
      </SheetContent>
    </Sheet>
  </>
)}
```

Desktop usa `<KaiSidebar />` direto (fixa). Mobile envolve no `<Sheet>` (drawer).
`isMobile` vem de `useIsMobile()` (hook de `src/hooks/use-mobile.tsx`,
breakpoint 768px). Sem trabalho extra.

## Validação

- `bun run build` — passa (6.79s, sem warnings)
- `bunx tsc --noEmit -p tsconfig.app.json` — clean (0 erros)

## Não-objetivos

- Nenhuma rota nova foi adicionada (tudo via `?tab=`)
- Nenhuma lógica de business tocada
- Nenhum arquivo em `api/` modificado
- Sem commit (branch `combo-viral-integration` deixada com working tree
  modificado — caller decide)
