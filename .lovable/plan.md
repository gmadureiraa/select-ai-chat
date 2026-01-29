
# Plano: Corrigir Mobile e Notificações Push

## Diagnóstico Completo

### Problema 1: Notificações Push Não Chegam

Após investigar os logs da edge function `process-push-queue`, encontrei o erro crítico:

```
TypeError: Object prototype may only be an Object or null: undefined
    at Function.create (<anonymous>)
    at Object.b [as inherits] (https://esm.sh/node/util.mjs:1:274)
    at https://esm.sh/jws@4.0.1/es2022/jws.mjs:4:1272
```

**Causa**: A biblioteca `web-push` (via esm.sh) usa internamente `jws` que não é compatível com Deno. O módulo `util.inherits` do Node.js não funciona corretamente no ambiente Deno.

**Evidência**: A fila de notificações tem itens pendentes (`processed: false`) que nunca são processados porque a edge function crasha imediatamente ao iniciar.

### Problema 2: Mobile Travando ao Clicar

Analisando o código do `GlobalKAIPanel.tsx`:

```typescript
{/* Backdrop overlay - minimal */}
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm"
  onClick={onClose}
/>
```

Quando o painel está fechado, o `AnimatePresence` pode não remover completamente o backdrop do DOM em alguns casos, ou há re-renders que recriam o elemento. Isso bloqueia todos os cliques na tela.

**Evidência adicional**: O `SheetOverlay` em `sheet.tsx` já tem `data-[state=closed]:pointer-events-none` mas o `GlobalKAIPanel` não tem essa proteção.

---

## Soluções

### Solução 1: Substituir web-push por Implementação Nativa

A biblioteca `web-push` não funciona em Deno. Preciso implementar Web Push usando Web Crypto API nativa do Deno.

**Opção A (Recomendada)**: Usar a biblioteca `@negrel/webpush` que é compatível com Deno
**Opção B**: Implementar manualmente usando `jose` (JOSE/JWT para Deno) + Web Crypto

Vou usar a Opção B porque é mais confiável e não depende de bibliotecas externas que podem ter problemas similares.

### Solução 2: Garantir que Backdrop do kAI Não Bloqueie Interações

Adicionar `pointer-events-none` quando o painel estiver fechado e garantir que o backdrop seja completamente removido do DOM.

---

## Mudanças Técnicas

### Arquivo 1: `supabase/functions/process-push-queue/index.ts`

Reescrever completamente usando Web Crypto API nativa:

```typescript
// ANTES (não funciona em Deno):
import webPush from "https://esm.sh/web-push@3.6.7";

// DEPOIS (funciona em Deno):
import * as jose from "https://deno.land/x/jose@v5.2.2/index.ts";
```

A implementação usará:
- `jose` para criar tokens JWT/VAPID
- `crypto.subtle` nativo do Deno para assinaturas ECDSA
- `fetch` nativo para enviar as notificações

### Arquivo 2: `supabase/functions/send-push-notification/index.ts`

Aplicar a mesma correção (usa a mesma biblioteca problemática).

### Arquivo 3: `src/components/kai-global/GlobalKAIPanel.tsx`

Adicionar proteção de pointer-events:

```typescript
{/* Backdrop overlay */}
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.15 }}
  className={cn(
    "fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm",
    !isOpen && "pointer-events-none"  // <-- NOVO
  )}
  onClick={onClose}
  style={{ pointerEvents: isOpen ? 'auto' : 'none' }} // <-- Garantia extra
/>
```

Também vou garantir que o `AnimatePresence` tenha `mode="wait"` para evitar estados intermediários.

### Arquivo 4: `src/components/ui/sheet.tsx`

Já tem a proteção correta, mas vou revisar para garantir consistência.

---

## Implementação Web Push Nativa

A nova implementação seguirá este fluxo:

```text
1. Receber payload + subscription do banco
         ↓
2. Construir JWT VAPID (aud: origin, sub: mailto:...)
         ↓
3. Assinar com ECDSA P-256 (chave privada VAPID)
         ↓
4. Encriptar payload com subscription keys (p256dh + auth)
         ↓
5. Enviar POST para subscription.endpoint com headers:
   - Authorization: vapid t=<jwt>, k=<publicKey>
   - Content-Encoding: aes128gcm
   - TTL: 86400
```

### Código de Referência

```typescript
async function sendWebPushNative(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; statusCode?: number }> {
  // 1. Parse subscription endpoint to get origin
  const url = new URL(subscription.endpoint);
  
  // 2. Create VAPID JWT
  const jwt = await createVapidJwt(
    url.origin,
    "mailto:contato@kaleidos.cc",
    vapidPrivateKey
  );
  
  // 3. Encrypt payload
  const encryptedPayload = await encryptPayload(
    payload,
    subscription.p256dh,
    subscription.auth
  );
  
  // 4. Send push
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
    },
    body: encryptedPayload,
  });
  
  return {
    success: response.status >= 200 && response.status < 300,
    statusCode: response.status,
  };
}
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/process-push-queue/index.ts` | Reescrever | Usar jose + Web Crypto nativo |
| `supabase/functions/send-push-notification/index.ts` | Reescrever | Mesma correção |
| `src/components/kai-global/GlobalKAIPanel.tsx` | Modificar | Adicionar pointer-events protection |
| `src/components/kai-global/GlobalKAIAssistant.tsx` | Modificar | Garantir unmount correto do backdrop |

---

## Resultado Esperado

1. **Notificações Push funcionam**: Edge function não crasha mais, notificações são enviadas corretamente
2. **Mobile responsivo**: Nenhum elemento invisível bloqueia cliques
3. **Fila processada**: Os itens pendentes na `push_notification_queue` serão processados
4. **PWA funcional**: Notificações chegam mesmo com app em background

---

## Testes Após Implementação

1. Criar uma nova tarefa com você atribuído → verificar se notificação chega
2. Testar todos os cliques no mobile (filtros, botões, cards)
3. Abrir/fechar o painel kAI várias vezes → verificar se backdrop some completamente
4. Verificar logs da edge function `process-push-queue` → não deve ter mais erros
