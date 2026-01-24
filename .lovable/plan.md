
# Plano: Finalização da Auditoria Completa da Experiência do Usuário

## Resumo dos Problemas Identificados

### 🔴 CRÍTICO: Bypass de Pagamento Ainda Existe
A rota `/signup` e `/create-workspace` ainda apontam para `CreateFirstWorkspace.tsx`, que:
- Usa `create_workspace_with_subscription` RPC que cria workspace **SEM passar pelo Stripe**
- Promete "1.000 tokens grátis" (linha 300) que não são implementados
- Mostra "3 perfis" (linha 154) quando deveria ser "1 perfil" para Canvas

### 🟡 Inconsistências nos Planos
- `CreateFirstWorkspace.tsx` linha 154: mostra "3 perfis" para Canvas
- Deveria usar `PLAN_CONFIG` centralizado que define 1 perfil para Canvas

### ✅ Canvas - Verificação Completa
O Canvas está bem estruturado com:
- **Nodes funcionais**: AttachmentNode, GeneratorNode, ContentOutputNode, MaterialChatNode, TextNode, StickyNode, ShapeNode
- **Templates quick**: 6 templates pré-configurados (Post Feed, Story/Reels, Carrossel, Thread, LinkedIn, Imagem 1:1)
- **Persistência**: Auto-save com debounce de 3s, carregamento automático do último canvas
- **Edge functions**: `generate-content-v2` e `chat-about-material` funcionando com Google AI Studio API Key configurada
- **Aliases de legado**: `contentOutput` e `prompt` mapeados para evitar erros em canvas salvos antigos

---

## Fase 1: Eliminar Bypass de Pagamento

### 1.1 Modificar App.tsx
Redirecionar `/signup` para `SimpleSignup` em vez de `CreateFirstWorkspace`:

```typescript
// DE:
<Route path="/signup" element={<CreateFirstWorkspace />} />
<Route path="/create-workspace" element={<CreateFirstWorkspace />} />

// PARA:
<Route path="/signup" element={<SimpleSignup />} />
<Route path="/create-workspace" element={<Navigate to="/signup" replace />} />
```

### 1.2 Deletar ou Deprecar CreateFirstWorkspace.tsx
- Mover para `/src/pages/_deprecated/` ou deletar
- Remover import do App.tsx

---

## Fase 2: Corrigir create-checkout para Trial Removal

### 2.1 Verificar supabase/functions/create-checkout/index.ts
Garantir que NÃO tem `trial_period_days`:
```typescript
subscription_data: {
  // SEM trial_period_days - pagamento imediato obrigatório
  metadata: {
    user_id: user.id,
    plan_type: planType,
  },
},
```

---

## Fase 3: Atualizar UpgradePlanDialog (se existir)
Buscar e corrigir qualquer componente que liste features dos planos para usar `PLAN_CONFIG`:
- Canvas: 1 perfil, 1 membro
- Pro: 10 perfis, 5 membros

---

## Fase 4: Validar Fluxo Completo

### Fluxo Esperado Após Correções:
1. **Landing Page** → Clique em "Começar" → `/signup`
2. **SimpleSignup** → Criar conta → `/no-workspace`
3. **NoWorkspacePage** → Clique em "Criar Workspace" → Abre `CreateWorkspaceDialog`
4. **CreateWorkspaceDialog** → Selecionar plano → Chama `create-checkout`
5. **Stripe Checkout** → Pagar → Callback → Workspace criado

---

## Fase 5: Canvas - Verificações Finais

### 5.1 Templates Funcionando
Os 6 quick templates já estão implementados corretamente:
- Post Feed, Story/Reels, Carrossel, Thread, LinkedIn Post, Imagem 1:1

### 5.2 Chat sobre Material (MaterialChatNode)
- Integração com `chat-about-material` edge function
- Usa `GOOGLE_AI_STUDIO_API_KEY` (já configurada)
- Indicadores visuais de conexão (Conectado/Desconectado)

### 5.3 Gerador de Conteúdo
- `generate-content-v2` suporta texto e imagem
- Busca contexto de marca do cliente (identity_guide, brand_assets)
- Geração de imagem usa Gemini 2.0 Flash Image Generation

### 5.4 Nodes Brancos - Já Corrigidos
- `TextNode.tsx` agora usa borda tracejada quando vazio
- Aliases de legado (`contentOutput`, `prompt`) mapeados

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/App.tsx` | Trocar `/signup` para SimpleSignup, redirect `/create-workspace` |
| `src/pages/CreateFirstWorkspace.tsx` | Deletar ou mover para deprecated |
| `src/components/workspace/UpgradePlanDialog.tsx` | Verificar se existe e corrigir features |

---

## Ordem de Execução

1. **App.tsx** - Redirecionar rotas /signup e /create-workspace
2. **CreateFirstWorkspace.tsx** - Deletar arquivo
3. **Verificar UpgradePlanDialog** - Se existir, usar PLAN_CONFIG
4. **Testar fluxo completo**: Landing → Signup → NoWorkspace → Stripe → Workspace
5. **Testar Canvas**: Templates, Chat, Geração de texto/imagem

---

## Canvas - Status Final

| Feature | Status | Notas |
|---------|--------|-------|
| Attachment Node | ✅ | YouTube, Instagram, upload, texto |
| Generator Node | ✅ | Texto + Imagem com brand context |
| Output Node | ✅ | Versões, comentários, planning |
| Material Chat | ✅ | IA sobre material conectado |
| Quick Templates | ✅ | 6 templates funcionais |
| Auto-save | ✅ | Debounce 3s, indicador visual |
| Legacy aliases | ✅ | contentOutput, prompt mapeados |
| Whiteboard tools | ✅ | Texto, Sticky, Shape, Pencil, Eraser |
