

# Correção: Contas Late API Sendo Desconectadas Automaticamente

## Diagnóstico

Analisei o fluxo completo e identifiquei a causa raiz do problema:

### O que está acontecendo

1. **Verificação Automática**: Quando você acessa a aba de Integrações do cliente, o hook `useClientPlatformStatus` dispara automaticamente a função `late-verify-accounts` a cada 5 minutos
2. **Lógica de Status Incorreta**: A função verifica se `matchingAccount.status === 'connected'`, mas a Late API pode retornar um formato diferente de status
3. **Resultado**: As contas conectadas recentemente são marcadas como "desconectadas" erroneamente

### Evidências nos Logs

```
Found 2 accounts in Late API for profile 6967b6dec88dd74a801be92f
status: "invalid" - message: "Conta desconectada"
```

A API encontrou as contas (não são deletadas), mas a lógica de verificação está interpretando o status incorretamente.

---

## Solução Proposta

### 1. Adicionar Logging Detalhado

Primeiro, precisamos ver exatamente o que a Late API retorna para corrigir a lógica:

| Campo | Valor Esperado | O que verificamos |
|-------|----------------|-------------------|
| `status` | `'connected'`? | ✓ Verificando |
| `connected` | `true`? | ✓ Verificando |
| `isConnected` | `true`? | ❌ Não verificamos |
| `active` | `true`? | ❌ Não verificamos |

### 2. Corrigir a Lógica de Verificação

Atualizar `late-verify-accounts/index.ts` para:
- Adicionar logging do objeto `matchingAccount` completo
- Expandir a lógica de detecção de "conectado" para considerar mais campos
- Tratar conta como conectada se existir na API (presença = conectado)

### 3. Ajustar Comportamento da Verificação Automática

Opção conservadora: Se a conta existe na Late API, assumir que está conectada. Só marcar como inválida se:
- A conta não existir mais na API (deleted)
- Houver erro explícito de autenticação ao tentar publicar

---

## Implementação

### Arquivo: `supabase/functions/late-verify-accounts/index.ts`

**Mudanças:**

1. Adicionar log detalhado da resposta da API:
```typescript
console.log("Account from Late API:", JSON.stringify(matchingAccount));
```

2. Mudar lógica para assumir conectado se existir:
```typescript
// Se a conta existe na API Late, assume que está conectada
// A API remove contas desconectadas automaticamente
const isConnected = !!matchingAccount;
```

3. Ou expandir verificação para mais campos:
```typescript
const isConnected = 
  matchingAccount.status === 'connected' || 
  matchingAccount.status === 'active' ||
  matchingAccount.connected === true ||
  matchingAccount.isConnected === true ||
  matchingAccount.active === true ||
  // Se não tem campo de status, assume conectado (presença = conectado)
  (!matchingAccount.status && !matchingAccount.hasOwnProperty('connected'));
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Contas desconectadas erroneamente | Verificação correta de status |
| Sem visibilidade do problema | Logs detalhados para debug |
| Verificação agressiva | Abordagem conservadora |

---

## Seção Técnica

### Arquivos a Modificar

1. **`supabase/functions/late-verify-accounts/index.ts`**
   - Linha 149: Adicionar log do objeto account completo
   - Linha 189: Corrigir lógica de `isConnected`

### Testes Necessários

1. Conectar conta Twitter/LinkedIn
2. Verificar logs da Late API no primeiro acesso
3. Aguardar 5 minutos e verificar se permanece conectado
4. Testar publicação para confirmar que funciona

### Fallback

Se mesmo após correção a Late API estiver reportando contas como desconectadas:
- Desabilitar verificação automática temporariamente
- Investigar diretamente no dashboard Late API
- Contatar suporte Late se necessário

