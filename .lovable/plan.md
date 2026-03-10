

# Fix: Duas Variáveis Indefinidas Quebrando Automações

Os logs mostram dois `ReferenceError` que impedem a automação "GM Diário Defiverso" de completar:

## Bug 1: `formatContract is not defined` — `unified-content-api`

**Causa**: `buildFormatContract` é importado mas nunca chamado. A variável `formatContract` é usada nos steps 4 (Repair) e 5 (Review) sem existir.

**Fix**: Após obter o `normalizedFormat` (linha ~208), declarar:
```typescript
const formatContract = buildFormatContract(normalizedFormat);
```

## Bug 2: `isLinkedIn is not defined` — `process-automations`

**Causa**: `isLinkedIn` é usada 12 vezes na seção de geração de imagem (linhas ~1509-1548) mas nunca declarada. `derivedPlatform` já existe e contém a plataforma correta.

**Fix**: No início do bloco de geração de imagem (antes da linha 1499), declarar:
```typescript
const isLinkedIn = derivedPlatform === 'linkedin';
```

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/unified-content-api/index.ts` | Adicionar `const formatContract = buildFormatContract(normalizedFormat)` após linha 208 |
| `supabase/functions/process-automations/index.ts` | Adicionar `const isLinkedIn = derivedPlatform === 'linkedin'` antes do bloco de image generation |

Ambos são fixes de uma linha que desbloqueiam o pipeline inteiro.

