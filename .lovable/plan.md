
# Plano de Melhorias: Notificações, Canvas Threads e Late API

## Visão Geral

Após análise completa do código, identifiquei **4 áreas principais** que precisam de ajustes:

---

## 1. 🔌 Twitter/LinkedIn Desconectando (Gabriel Madureira)

### Diagnóstico
Os dados mostram que ambas as contas (Twitter e LinkedIn) do Gabriel Madureira estão marcadas como `is_valid: false` com erro "Conta desconectada no Late API":

```
Twitter: @madureira0x - is_valid: false
LinkedIn: Gabriel Madureira - is_valid: false
```

### Causa Provável
A Late API revoga tokens OAuth periodicamente quando:
1. **Token expirado** - Twitter especialmente tem tokens de curta duração
2. **Permissões revogadas** - Usuário removeu acesso no app
3. **Inatividade** - Tokens podem expirar sem uso

### Solução
1. **Adicionar refresh automático de tokens** no `late-verify-accounts`
2. **Criar endpoint de reconexão simplificada** que mantém o profile_id existente
3. **Notificar usuário proativamente** quando conta ficar inválida

---

## 2. 🧵 Canvas - Geração de Thread não Funciona Corretamente

### Problema Atual
A IA gera a thread como texto contínuo (1102 caracteres num único tweet) em vez de separar cada tweet individualmente.

### Causa Raiz
1. O `generate-content-v2` gera texto em bloco com formato `1/ texto \n\n 2/ texto`
2. O resultado não é parseado para separar em array de tweets
3. O `ThreadEditor` espera receber um array `ThreadTweet[]` mas recebe string única

### Solução
1. **Atualizar `generate-content-v2`** para retornar threads como array estruturado:
   ```json
   {
     "content": "...", // texto completo para backward compatibility
     "thread_tweets": [
       { "text": "1/ Primeiro tweet...", "media_urls": [] },
       { "text": "2/ Segundo tweet...", "media_urls": [] }
     ]
   }
   ```

2. **Parser de thread** na resposta do Canvas para converter automaticamente

3. **Melhorar prompt de thread** para forçar formato estruturado

---

## 3. 🔔 Notificações de Tarefas (Atribuição + Due Date)

### Situação Atual
- Não existe trigger para notificar quando alguém é atribuído a uma tarefa
- Não existe cron job para notificar sobre due dates no início do dia
- Configurações de notificação são apenas on/off geral

### Implementação Necessária

#### A. Trigger de Atribuição
```sql
-- Trigger quando assigned_to é alterado
CREATE FUNCTION notify_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND 
     (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    INSERT INTO notifications (user_id, workspace_id, type, title, ...)
    VALUES (NEW.assigned_to, NEW.workspace_id, 'assignment', ...);
  END IF;
  RETURN NEW;
END;
$$;
```

#### B. Cron Job para Due Dates
- Executar diariamente às 9h (horário de trabalho, não meia-noite)
- Buscar tarefas com `due_date = TODAY` e `status NOT IN ('published', 'done')`
- Criar notificações para `assigned_to` (ou `created_by` se não atribuída)

#### C. Preferências de Notificação Granulares
Adicionar coluna `notification_preferences` na tabela `profiles`:
```json
{
  "push_enabled": true,
  "assignment_notifications": true,  // padrão: true
  "due_date_notifications": true,    // padrão: true
  "publish_notifications": true,     // padrão: true
  "mention_notifications": true      // padrão: true
}
```

---

## 4. 📐 Formatos do Gerador do Canvas

### Situação Atual
O `GeneratorNode.tsx` tem apenas 5 formatos + 4 plataformas:

```typescript
const FORMAT_OPTIONS = [
  { value: 'post', label: 'Post' },
  { value: 'carrossel', label: 'Carrossel' },
  { value: 'thread', label: 'Thread' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'reels', label: 'Roteiro Reels' },
];
```

### Nova Estrutura (Apenas Formato, Sem Plataforma)
```typescript
const FORMAT_OPTIONS = [
  // Instagram
  { value: 'carousel', label: 'Carrossel Instagram' },
  { value: 'static_image', label: 'Estático Único Instagram' },
  
  // Twitter/X
  { value: 'tweet', label: 'Tweet' },
  { value: 'thread', label: 'Thread Twitter' },
  { value: 'x_article', label: 'Artigo X' },
  
  // LinkedIn
  { value: 'linkedin_post', label: 'Post LinkedIn' },
  
  // Newsletter
  { value: 'newsletter', label: 'Newsletter' },
  
  // Vídeo
  { value: 'short_video', label: 'Roteiro Reels' },
  { value: 'long_video', label: 'Roteiro YouTube' },
];
```

**Remover o seletor de plataforma** - a plataforma será derivada automaticamente do formato usando `CONTENT_TO_PLATFORM`.

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/generate-content-v2/index.ts` | Retornar threads como array estruturado |
| `src/components/kai/canvas/nodes/GeneratorNode.tsx` | Novos formatos, remover seletor de plataforma |
| `src/components/settings/NotificationSettings.tsx` | Toggles granulares por tipo de notificação |
| `supabase/functions/late-verify-accounts/index.ts` | Melhorar diagnóstico de desconexão |
| **Nova função:** `process-due-date-notifications` | Cron job diário às 9h |
| **Nova migração SQL** | Trigger de atribuição + notification_preferences |

---

## Ordem de Implementação

| Prioridade | Item | Complexidade |
|------------|------|--------------|
| 1 | Formatos do Canvas | Baixa |
| 2 | Thread como array estruturado | Média |
| 3 | Trigger de atribuição | Média |
| 4 | Cron de due dates | Média |
| 5 | Preferências de notificação | Média |
| 6 | Melhorias Late API | Alta |

---

## Detalhes Técnicos

### Thread Parser (Canvas)
```typescript
function parseThreadFromText(text: string): ThreadTweet[] {
  // Regex para detectar padrões como "1/", "1.", "1)"
  const tweetPattern = /(?:^|\n)(\d+)[\/\.\)]\s*/g;
  const parts = text.split(tweetPattern).filter(Boolean);
  
  const tweets: ThreadTweet[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i + 1]) {
      tweets.push({
        id: `tweet-${i}`,
        text: parts[i + 1].trim().substring(0, 280),
        media_urls: []
      });
    }
  }
  
  return tweets.length > 0 ? tweets : [{ id: 'tweet-1', text: text, media_urls: [] }];
}
```

### Cron Schedule (Due Date)
```sql
-- Executar diariamente às 9h (horário local)
SELECT cron.schedule(
  'due-date-notifications',
  '0 9 * * *',  -- 9h da manhã
  $$SELECT net.http_post(...)$$
);
```

### Preferências Default
Todas as notificações vêm **ativadas por padrão**, permitindo ao usuário desativar individualmente.
