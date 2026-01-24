

# Plano: Melhorias de UX para Plano Canvas + Animações Landing Page

## Resumo do que precisa ser feito

Baseado no seu feedback, identifiquei 4 áreas principais:

---

## 1. ÍCONES DE CADEADO PARA PLANO CANVAS

### 1.1 Sidebar - Funcionalidades bloqueadas

**Arquivo:** `src/components/kai/KaiSidebar.tsx`

**Problema atual:** Os itens bloqueados mostram apenas `disabled={true}` com opacidade reduzida, mas sem ícone de cadeado visual.

**Solução:** Adicionar ícone `Lock` ao lado do label quando `disabled={true}`:

```typescript
// Modificar NavItem para aceitar prop showLock
interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  collapsed?: boolean;
  disabled?: boolean;
  showLock?: boolean; // NOVO
}

function NavItem({ icon, label, active, onClick, collapsed, disabled, showLock }: NavItemProps) {
  // ...
  {!collapsed && (
    <span className="flex-1 text-left truncate flex items-center gap-2">
      {label}
      {showLock && <Lock className="h-3 w-3 text-muted-foreground/60" />}
    </span>
  )}
}
```

**Itens que precisam de cadeado:**
- Planejamento (linha 283-290) - quando `!hasPlanning`
- Performance (linha 304-313) - quando `!canAccessPerformance`
- Biblioteca (linha 327-336) - quando `!canAccessLibrary`
- Perfis (linha 351-360) - quando `!canAccessProfiles`

---

### 1.2 Integrações no Editar Perfil

**Arquivo:** `src/components/clients/ClientEditTabsSimplified.tsx`

**Problema:** A aba "Integrações" aparece para todos os planos, mas deveria mostrar cadeado para Canvas.

**Solução:** 
1. Importar `usePlanFeatures` hook
2. Verificar se `isPro` é false
3. Mostrar cadeado na aba e bloquear conteúdo

```typescript
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { Lock } from "lucide-react";

// Dentro do componente
const { isPro } = usePlanFeatures();

// Na TabsTrigger de integrations (linha 220-223)
<TabsTrigger 
  value="integrations" 
  className={cn("text-xs gap-1", !isPro && "opacity-50")}
  disabled={!isPro}
>
  <Plug className="h-3.5 w-3.5" />
  Integrações
  {!isPro && <Lock className="h-3 w-3 ml-1 text-muted-foreground" />}
</TabsTrigger>

// No TabsContent (linha 406-408)
<TabsContent value="integrations" className="mt-4">
  {isPro ? (
    <SocialIntegrationsTab clientId={client.id} />
  ) : (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Lock className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="font-semibold mb-2">Integrações PRO</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Conecte redes sociais e publique diretamente com o plano PRO.
      </p>
      <Button onClick={() => navigate('/settings?section=billing')}>
        Fazer upgrade
      </Button>
    </div>
  )}
</TabsContent>
```

---

## 2. REMOVER QUESTÃO DO FAQ

**Arquivo:** `src/components/landing/FAQSection.tsx`

**Problema:** A primeira pergunta menciona "7 dias grátis" no trial.

**Ação:** Remover a pergunta "Quanto custa e como funciona o trial?" (linhas 18-22) do array `faqs`, já que não oferecemos mais trial gratuito.

```typescript
// REMOVER este item do array faqs:
{
  question: "Quanto custa e como funciona o trial?",
  answer: "Oferecemos 7 dias grátis...",
  category: "pricing",
}
```

---

## 3. MELHORAR ANIMAÇÕES DA HERO SECTION (Cards "Na Prática")

**Arquivo:** `src/components/landing/NewHeroSection.tsx`

**Objetivo:** Aproveitar as animações incríveis do `InputTypesGrid.tsx` (waveform de áudio, scan de PDF, URL loading, etc.) nos cards da Hero.

### Animações a importar/adaptar:

1. **AnimatedWaveform** (audio) - linhas 112-131 do InputTypesGrid
2. **UrlPreview** (browser loading) - linhas 134-170 do InputTypesGrid  
3. **YoutubePreview** (play + progress bar) - linhas 173-204 do InputTypesGrid
4. **PdfPreview** (scan effect) - linhas 207-238 do InputTypesGrid
5. **TextPreview** (typing cursor) - linhas 241-265 do InputTypesGrid
6. **ImagePreview** (scan effect) - linhas 268-285 do InputTypesGrid
7. **FloatingParticles** - linhas 288-311 do InputTypesGrid

### Onde aplicar:

No `HeroCanvasDemo` (linhas 175-600+), dentro dos nodes de Attachment:

```typescript
// No Attachment Node, quando animationStep >= 2:
// - Para scenario tipo 'url': usar UrlPreview
// - Para scenario tipo 'audio': usar AnimatedWaveform  
// - Para scenario tipo 'pdf': usar PdfPreview com scan
// - Para scenario tipo 'image+text': usar ImagePreview com scan

// Exemplo para áudio:
{scenario.attachment.type === 'audio' && animationStep >= 2 && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="px-2"
  >
    <AnimatedWaveform />
    <div className="text-[8px] text-muted-foreground mt-1">
      {scenario.attachment.extraction?.duration}
    </div>
  </motion.div>
)}
```

### Adicionar FloatingParticles ao container:
```typescript
<div className="relative w-full aspect-[16/9] bg-background rounded-lg overflow-hidden">
  <FloatingParticles color="bg-primary" />
  {/* ... resto do conteúdo */}
</div>
```

---

## 4. ARQUIVOS A MODIFICAR

| Arquivo | Mudanças |
|---------|----------|
| `src/components/kai/KaiSidebar.tsx` | Adicionar prop `showLock` ao NavItem e ícones Lock nos itens bloqueados |
| `src/components/clients/ClientEditTabsSimplified.tsx` | Bloquear aba Integrações com cadeado para Canvas |
| `src/components/landing/FAQSection.tsx` | Remover pergunta sobre trial de 7 dias |
| `src/components/landing/NewHeroSection.tsx` | Importar/adaptar animações do InputTypesGrid (waveform, scan, etc.) |

---

## 5. ORDEM DE IMPLEMENTAÇÃO

### Fase 1 - Cadeados (Prioridade Alta)
1. Modificar NavItem na KaiSidebar para mostrar Lock
2. Adicionar cadeado e bloqueio na aba Integrações

### Fase 2 - FAQ
3. Remover pergunta sobre trial

### Fase 3 - Animações Hero
4. Extrair componentes de animação do InputTypesGrid para arquivo compartilhado
5. Aplicar animações nos nodes da HeroCanvasDemo

