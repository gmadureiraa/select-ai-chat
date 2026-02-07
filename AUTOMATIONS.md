# Automações - Guia Completo

Sistema completo de automações para executar tarefas de IA de forma programada e integrada.

## Recursos Principais

### 🕐 Agendamento Avançado

- **Diário**: Execute todos os dias em um horário específico
- **Semanal**: Escolha os dias da semana e horário
- **Mensal**: Execute uma vez por mês
- Configuração de horário no formato 24h (ex: 09:00, 14:30)

### 📊 Fontes de Dados Externas

Configure múltiplas fontes de dados para a IA usar:

- **API REST**: Busque dados de APIs externas
  - Suporte para métodos GET e POST
  - Headers customizados
  - Body JSON para requisições POST
- **Webhook**: Receba dados via webhook
- **RSS Feed**: Monitore feeds RSS
- **Custom**: Fontes personalizadas

As fontes de dados são automaticamente buscadas antes da execução e incluídas no contexto da IA.

### ⚡ Ações Pós-Execução

Configure o que fazer com o resultado:

- **Salvar no banco**: Persistir resultado no banco de dados
- **Enviar email**: Enviar resultado para destinatários (requer configuração de serviço de email)
- **Chamar webhook**: Notificar sistemas externos via webhook
- **Salvar em arquivo**: Exportar resultado como arquivo

### 🤖 Modelos de IA Suportados

- GPT-5 (mais capaz)
- GPT-5 Mini (rápido e eficiente)
- GPT-4.1 (confiável)

## Como Usar

### 1. Criar uma Automação

1. Acesse a página de Automações
2. Clique em "Nova Automação"
3. Preencha as informações básicas:
   - Nome da automação
   - Descrição (opcional)
   - Cliente associado
   - Tarefa/prompt para a IA

### 2. Configurar Agendamento

- Escolha a frequência (diária, semanal, mensal)
- Para semanal: selecione os dias da semana
- Defina o horário de execução

### 3. Adicionar Fontes de Dados (Opcional)

1. Clique em "Adicionar Fonte"
2. Configure:
   - Nome da fonte
   - Tipo (API, webhook, RSS, custom)
   - URL
   - Método HTTP (GET/POST)
   - Headers (se necessário)
   - Body JSON (para POST)

### 4. Configurar Ações (Opcional)

1. Clique em "Adicionar Ação"
2. Escolha o tipo de ação
3. Configure parâmetros específicos:
   - Email: adicione destinatários
   - Webhook: adicione URL

### 5. Ativar e Executar

- Use o botão Play/Pause para ativar/desativar
- Clique em "Executar Agora" para teste manual
- A automação rodará automaticamente no horário configurado

## Exemplos de Uso

### 1. Relatório Diário de Vendas

```
Nome: Relatório de Vendas Diário
Frequência: Diariamente às 09:00
Fonte de Dados: API de vendas (GET /api/sales/yesterday)
Prompt: "Analise as vendas de ontem e crie um relatório executivo com insights e recomendações"
Ação: Enviar email para equipe@empresa.com
```

### 2. Monitoramento de Concorrentes

```
Nome: Análise Semanal de Concorrentes
Frequência: Semanalmente às segundas 08:00
Fontes de Dados: 
  - RSS Feed do Blog Concorrente A
  - RSS Feed do Blog Concorrente B
Prompt: "Analise as novidades dos concorrentes e identifique tendências e oportunidades"
Ação: Salvar no banco + Webhook para Slack
```

### 3. Geração de Conteúdo Mensal

```
Nome: Newsletter Mensal
Frequência: Mensalmente
Fonte de Dados: API Analytics (GET /api/analytics/monthly)
Prompt: "Crie uma newsletter profissional com os destaques do mês baseado nos dados"
Ações: 
  - Salvar no banco
  - Enviar email para lista de newsletter
```

## Configuração dos Cron Jobs (Agendamento Automático)

O sistema utiliza dois cron jobs para executar automaticamente:

1. **process-scheduled-posts** (a cada 5 minutos): Publica itens agendados cujo `scheduled_at` já passou
2. **process-automations** (a cada 15 minutos): Avalia gatilhos de schedule/RSS e cria conteúdo

### Checklist Pós-Deploy

Para que as automações funcionem automaticamente, siga estes passos:

#### 1. Configurar Segredos no Vault

Acesse o **Dashboard do Supabase > Project Settings > Vault** e crie os seguintes segredos:

| Nome do Segredo | Valor |
|-----------------|-------|
| `project_url` | `https://tkbsjtgrumhvwlxkmojg.supabase.co` |
| `cron_service_role_key` | Sua SERVICE_ROLE_KEY (encontre em API Settings) |

#### 2. Criar os Cron Jobs

Execute o seguinte SQL no **SQL Editor** do Supabase:

```sql
-- JOB 1: Publicar posts agendados (a cada 5 minutos)
SELECT cron.schedule(
  'process-scheduled-posts-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1) || '/functions/v1/process-scheduled-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- JOB 2: Processar automações (a cada 15 minutos)
SELECT cron.schedule(
  'process-automations-cron',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1) || '/functions/v1/process-automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

#### 3. Verificar Jobs

```sql
-- Ver jobs criados
SELECT * FROM cron.job;

-- Ver execuções recentes
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

#### 4. (Opcional) Testar Manualmente

Antes de aguardar o cron, teste as funções:
- Use o botão **"Testar Agora"** na UI de automações
- Ou execute via curl com a service_role_key

## Monitoramento

Cada execução gera registros em:
- `planning_automation_runs`: histórico de automações com status, duração, erros
- Logs da Edge Function (acessível via Dashboard > Functions)

### Status Possíveis
- `running`: em execução
- `completed`: concluído com sucesso
- `failed`: falhou (erro será registrado)
- `skipped`: condições do gatilho não atendidas

## Dicas

1. **Teste antes**: Use "Testar Agora" para validar antes de ativar
2. **Vault obrigatório**: Os cron jobs dependem dos segredos no Vault
3. **Fuso horário**: O agendamento usa horário UTC do servidor
4. **Monitore logs**: Verifique os logs das Edge Functions periodicamente
5. **Backoff automático**: Falhas de publicação têm retry com backoff exponencial (2min, 4min, 8min)
