# Plano: Corrigir Loading Infinito ao Publicar/Agendar do Planejamento

## ✅ IMPLEMENTADO

### Correções Aplicadas

#### 1. `useLateConnection.ts` - Timeout de 30s + Logging
- Adicionado timeout de 30 segundos para evitar loading infinito
- Se a requisição demorar mais de 30s, mostra toast de erro "Tempo esgotado"
- Adicionado logging detalhado para debug (`[late-post] Starting publish...`)
- Prevenção de toasts duplicados se timeout já disparou

#### 2. `PlanningItemDialog.tsx` - Validações Explícitas + Auto-Save
- Validações explícitas antes de publicar:
  - `platform` definida
  - `selectedClientId` definido
  - `canPublishNow` válido
  - Conteúdo não vazio
- **Auto-save**: Se o card não foi salvo (`item?.id` é undefined), salva automaticamente antes de publicar
- Fallback de conteúdo: Se `content` está vazio mas `description` tem texto, usa `description`
- Logging para debug no console

### Arquivos Modificados
- `src/hooks/useLateConnection.ts` - Timeout + logging
- `src/components/planning/PlanningItemDialog.tsx` - Validações + auto-save + description fallback

### Resultado Esperado
1. **Sem loading infinito** - Timeout de 30s com feedback claro
2. **Publicação funciona sempre** - Auto-save se necessário
3. **Feedback explícito** - Toasts claros para cada cenário de erro
4. **Conteúdo de automação** - Description é usado como fallback para content

### Testes Recomendados
1. Publicar card salvo → deve funcionar
2. Publicar card novo → deve salvar e publicar
3. Desconectar internet → timeout em 30s com mensagem
4. Card de automação → content/description é carregado corretamente
