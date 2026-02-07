

# Plano: Corrigir Loading Infinito ao Publicar/Agendar do Planejamento

## Diagnóstico

### O que investigamos

1. **Edge Function `late-post`** - Testada e funcionando perfeitamente. Ao chamar diretamente, publica com sucesso e retorna resposta em ~2 segundos.

2. **Credenciais do Defiverso** - Válidas. Twitter conectado via Late API com `late_account_id: 69874ac6c2419ab74f6a030d`.

3. **Item de Planejamento** - O item `600e160c-fce2-4fed-aa93-d812fc362120` foi publicado com sucesso (pela minha chamada de teste) e agora está com status `published`.

4. **Logs de Rede** - Não há chamada à `late-post` nos logs do frontend, apenas `late-verify-accounts` e `process-automations`.

### Causa Raiz Provável

O problema de "loading infinito" provavelmente ocorre porque:

1. **Requisição não está sendo disparada** - O botão dispara `setIsPublishing(true)` mas a chamada `lateConnection.publishContent()` falha silenciosamente antes de chegar ao servidor.

2. **Possíveis causas:**
   - O `item?.id` pode ser `undefined` se o card ainda não foi salvo
   - O `content` pode estar vazio (a validação existe mas pode haver edge case)
   - O `selectedClientId` pode estar incorreto
   - Erro de rede não tratado adequadamente

---

## Problemas Identificados

### 1. Publicar card não salvo
Se o usuário clica "Publicar Agora" em um card novo (não salvo), o `item?.id` é `undefined` e a publicação ocorre sem `planningItemId`, o que pode causar comportamento inesperado.

### 2. Falta de feedback durante erros
O bloco `catch` no `handlePublishNow` está vazio (apenas comenta "Error toast is handled by useLateConnection"), mas se o erro ocorrer antes da chamada de função (validação, estado), não há feedback.

### 3. Possível problema com conteúdo vazio
Ao abrir o dialog, o `content` é carregado do `effectiveItem`. Se o item veio de automação e o conteúdo está no campo `description` em vez de `content`, pode haver descompasso.

---

## Correções Propostas

### Parte 1: Melhorar `handlePublishNow`

```typescript
const handlePublishNow = async () => {
  // Validações mais explícitas
  if (!platform) {
    toast.error('Selecione um tipo de conteúdo com plataforma');
    return;
  }
  
  if (!selectedClientId) {
    toast.error('Selecione um cliente');
    return;
  }
  
  if (!canPublishNow) {
    toast.error('Conta não conectada ou inválida');
    return;
  }
  
  let finalContent = content;
  if (isTwitterThread) {
    finalContent = threadTweets.map(t => t.text).join('\n\n');
  }
  
  if (!finalContent.trim()) {
    toast.error('Adicione conteúdo para publicar');
    return;
  }
  
  // Se o item ainda não foi salvo, salvar primeiro
  let itemId = item?.id;
  if (!itemId) {
    toast.info('Salvando card antes de publicar...');
    try {
      // Salvar via handleSubmit logic ou direta
      const result = await onSave({
        title: title || 'Conteúdo sem título',
        content: finalContent,
        client_id: selectedClientId,
        column_id: columnId,
        platform,
        content_type: contentType,
        status: 'publishing',
        media_urls: mediaItems.map(m => m.url),
      });
      itemId = result?.id;
    } catch (saveError) {
      toast.error('Erro ao salvar card antes de publicar');
      return;
    }
  }
  
  setIsPublishing(true);
  try {
    await lateConnection.publishContent(
      platform as LatePlatform,
      finalContent,
      {
        mediaUrls: mediaItems.map(m => m.url),
        planningItemId: itemId,
        threadItems: isTwitterThread ? threadTweets : undefined,
      }
    );
    toast.success(`Publicado em ${platform}!`);
    onOpenChange(false);
  } catch (error) {
    console.error('Publish error:', error);
    // Feedback mais explícito
    toast.error(error instanceof Error ? error.message : 'Erro ao publicar');
  } finally {
    setIsPublishing(false);
  }
};
```

### Parte 2: Melhorar feedback no `useLateConnection`

Adicionar logs de debug e timeout para evitar loading infinito:

```typescript
const publishContent = useCallback(async (...) => {
  const timeoutId = setTimeout(() => {
    console.error('[late-post] Request timeout after 30s');
    setIsLoading(false);
    toast({
      title: "Tempo esgotado",
      description: "A publicação demorou muito. Verifique sua conexão.",
      variant: "destructive",
    });
  }, 30000);
  
  try {
    setIsLoading(true);
    console.log('[late-post] Starting publish...', { clientId, platform, hasContent: !!content });
    
    const { data, error } = await supabase.functions.invoke('late-post', { ... });
    
    clearTimeout(timeoutId);
    
    if (error) {
      console.error('[late-post] Error:', error);
      throw new Error(error.message);
    }
    
    console.log('[late-post] Success:', data);
    // ...
  } catch (error) {
    clearTimeout(timeoutId);
    // ...
  } finally {
    clearTimeout(timeoutId);
    setIsLoading(false);
  }
}, [...]);
```

### Parte 3: Garantir que conteúdo de automação seja carregado

No useEffect que carrega o item, garantir que `content` seja preenchido corretamente:

```typescript
// Se content está vazio mas description tem texto, usar description
const itemContent = effectiveItem.content || effectiveItem.description || '';
setContent(itemContent);
```

---

## Verificação de Agendamento

O agendamento já está implementado corretamente no `handleSubmit`:

1. Usuário define data/hora em "Mais opções" → Agendamento
2. Ao salvar, se `scheduledAt` está definido e `canPublishNow`:
   - O sistema salva o card primeiro
   - Depois chama `lateConnection.publishContent()` com `scheduledFor` e `publishNow: false`
   - O Late API agenda a publicação
3. Se o Late falhar, o card fica com `scheduled_at` no banco e o cron job (`process-scheduled-posts`) publica no horário

**Problema potencial:** A UI não mostra claramente se o conteúdo foi agendado no Late ou apenas salvo localmente.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/planning/PlanningItemDialog.tsx` | Melhorar validações, salvar antes de publicar se necessário, feedback mais explícito |
| `src/hooks/useLateConnection.ts` | Adicionar timeout de 30s, logs de debug, fallback de erro |

---

## Testes Recomendados

1. **Publicar card existente** - Abrir um card salvo → clicar "Publicar Agora" → deve publicar com sucesso

2. **Publicar card novo** - Criar novo card → preencher conteúdo → "Publicar Agora" → deve salvar e publicar

3. **Agendar conteúdo** - Definir data/hora → salvar → deve agendar no Late ou localmente

4. **Erro de rede** - Desconectar internet → publicar → deve mostrar erro após timeout

5. **Conta inválida** - Remover credencial → publicar → botão não deve aparecer

---

## Resultado Esperado

Após implementação:

1. **Publicação funciona sempre** - Com validações claras e salvamento automático se necessário
2. **Sem loading infinito** - Timeout de 30s com feedback
3. **Feedback claro** - Usuário sabe exatamente o que aconteceu (sucesso, erro, agendado)
4. **Agendamento transparente** - Indica se foi agendado no Late ou apenas salvo localmente

