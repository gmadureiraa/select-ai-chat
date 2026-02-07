
# Plano: Corrigir Conexão Twitter - Remover Trigger de Auditoria Órfão

## Diagnóstico

### Causa Raiz Identificada
O erro `relation "public.social_credentials_audit_log" does not exist` ocorre porque:

1. A migration `20260207090904` removeu a tabela `social_credentials_audit_log`
2. O trigger `audit_social_credentials_trigger` **não foi removido junto**
3. Quando você tenta conectar o Twitter do Defiverso:
   - OAuth funciona ✅
   - Late API retorna os dados da conta ✅
   - Edge function tenta fazer upsert na tabela `client_social_credentials` ✅
   - **Trigger dispara e tenta inserir na tabela de auditoria que não existe** ❌

### Por que Gabriel Madureira funciona?
A conexão dele foi feita antes da migration ou os dados não foram atualizados desde então.

---

## Solução

### Migration para Limpar Objetos Órfãos

Criar uma migration que:

1. **Remove o trigger órfão** `audit_social_credentials_trigger`
2. **Remove as funções órfãs** `audit_credential_changes()` e `log_credential_access()`

```sql
-- Remove o trigger que tenta inserir na tabela deletada
DROP TRIGGER IF EXISTS audit_social_credentials_trigger ON public.client_social_credentials;

-- Remove as funções que não têm mais utilidade
DROP FUNCTION IF EXISTS public.audit_credential_changes();
DROP FUNCTION IF EXISTS public.log_credential_access(UUID, UUID, TEXT, JSONB);
```

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| Nova migration | Criar para dropar trigger e funções |

---

## Verificação Pós-Implementação

Após aplicar a migration:

1. Tentar conectar Twitter do Defiverso novamente
2. Verificar se a conexão é salva com sucesso
3. Confirmar que o trigger não existe mais:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'audit_social_credentials_trigger';
   ```

---

## Impacto

- **Risco**: Baixo - apenas remove código morto
- **Funcionalidade perdida**: Nenhuma - a tabela de destino já não existe
- **Benefício**: Conexões OAuth voltam a funcionar normalmente

---

## Tempo Estimado

~2 minutos para criar e aplicar a migration
