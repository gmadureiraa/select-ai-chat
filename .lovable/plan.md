
# Plano de Implementação

## Visão Geral

Este plano aborda as três questões pendentes:
1. **Erro de React** (`Cannot read properties of null (reading 'useRef')`) - Causado por múltiplas instâncias de `TooltipProvider`
2. **Login com Google** - Adicionar autenticação OAuth com Google via Lovable Cloud
3. **Bug no mobile** - Elementos não clicáveis após entrar no app

---

## 1. Correção do Erro de React (TooltipProvider)

### Diagnóstico
O erro ocorre porque existem múltiplas instâncias de `<TooltipProvider>` aninhadas que conflitam com o provider global em `App.tsx`. Isso cria múltiplas instâncias do contexto React, causando o erro "null dispatcher".

### Arquivos a Modificar
Remover `<TooltipProvider>` dos seguintes arquivos (já existe um global em `App.tsx`):

| Arquivo | Ação |
|---------|------|
| `src/components/performance/NewsletterMetricsTable.tsx` | Remover TooltipProvider wrapper |
| `src/components/performance/PostAveragesSection.tsx` | Remover TooltipProvider wrapper |
| `src/components/kai/tools/BriefingTemplates.tsx` | Remover TooltipProvider wrapper |
| `src/components/chat/AddToPlanningButton.tsx` | Remover TooltipProvider wrapper |
| `src/components/kai/canvas/nodes/ContentOutputNode.tsx` | Remover 2 TooltipProvider wrappers |
| `src/components/planning/PlanningBoard.tsx` | Remover 2 TooltipProvider wrappers |
| `src/components/ui/sidebar.tsx` | Remover TooltipProvider wrapper (linha 110) |

### Padrão de Mudança
```text
Antes:
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>...</TooltipTrigger>
    <TooltipContent>...</TooltipContent>
  </Tooltip>
</TooltipProvider>

Depois:
<Tooltip>
  <TooltipTrigger>...</TooltipTrigger>
  <TooltipContent>...</TooltipContent>
</Tooltip>
```

---

## 2. Login com Google

### Abordagem
Utilizarei o sistema gerenciado do Lovable Cloud que já possui Google OAuth configurado automaticamente. Não é necessário configurar credenciais próprias.

### Passos Técnicos

1. **Configurar Google OAuth** usando a ferramenta `supabase--configure-social-auth`
   - Isso gerará automaticamente o módulo em `src/integrations/lovable/`
   - Instalará o pacote `@lovable.dev/cloud-auth-js`

2. **Atualizar `Login.tsx`**:
   - Adicionar botão "Entrar com Google"
   - Importar `lovable` de `@/integrations/lovable/index`
   - Implementar handler:
   ```typescript
   const handleGoogleLogin = async () => {
     const { error } = await lovable.auth.signInWithOAuth("google", {
       redirect_uri: window.location.origin,
     });
     if (error) toast.error(error.message);
   };
   ```

3. **Atualizar `SimpleSignup.tsx`**:
   - Adicionar mesmo botão de Google
   - Permitir criar conta via Google

### UI do Botão
```text
[ícone Google] Entrar com Google
```
- Estilo: outline, full-width
- Separador visual "ou" entre o botão Google e o formulário email/senha

---

## 3. Bug no Mobile (Elementos Não Clicáveis)

### Diagnóstico
O problema está relacionado a conflitos de z-index e overlays que bloqueiam interações:

1. **MobileHeader** (`z-50`) pode conflitar com outros elementos
2. **GlobalKAIPanel backdrop** (`z-40`) quando aberto bloqueia tudo
3. **FloatingKAIButton** (`z-50`) pode sobrepor áreas clicáveis
4. **Possible touch-action issues** em elementos com animações

### Correções

| Componente | Problema | Solução |
|------------|----------|---------|
| `FloatingKAIButton.tsx` | Posição fixa no canto inferior direito pode conflitar | Adicionar `safe-area-inset-bottom` para iOS |
| `GlobalKAIPanel.tsx` | Backdrop impede cliques mesmo quando fechado | Garantir que backdrop só renderiza quando `isOpen=true` |
| `Kai.tsx` | Mobile header usa `pt-14` mas pode haver overflow | Verificar e ajustar container overflow |
| Service Worker | Cache antigo pode estar servindo versões inconsistentes | Já tratado anteriormente |

### Mudanças Específicas

**FloatingKAIButton.tsx**:
```typescript
// Adicionar safe area para iOS
className="fixed bottom-6 right-6 z-50 pb-safe"
```

**MobileHeader.tsx**:
- Garantir que não há elementos invisíveis bloqueando toques
- Verificar se todos os botões têm área de toque adequada (mínimo 44x44px)

**ContentCanvas.tsx** (se aplicável):
- Verificar se overlays de drag/empty state têm `pointer-events-none` correto

---

## Sequência de Implementação

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Remover TooltipProviders duplicados (7 arquivos)        │
├─────────────────────────────────────────────────────────────┤
│ 2. Configurar Google OAuth via supabase--configure-social  │
├─────────────────────────────────────────────────────────────┤
│ 3. Atualizar Login.tsx e SimpleSignup.tsx com botão Google │
├─────────────────────────────────────────────────────────────┤
│ 4. Ajustar z-index e touch areas no mobile                 │
├─────────────────────────────────────────────────────────────┤
│ 5. Testar fluxo completo em mobile e desktop               │
└─────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

1. **App carrega sem erros** - Sem mais crashes de "null useRef"
2. **Login com Google funcional** - Botão visível em Login e Signup
3. **Mobile responsivo** - Todos os elementos clicáveis e funcionais
4. **Hard refresh necessário** após deploy para limpar cache do navegador
