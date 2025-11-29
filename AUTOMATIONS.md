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

## Configuração do Cron Job

Para executar automaticamente, configure um cron job no Supabase:

```sql
select cron.schedule(
  'run-automations',
  '*/15 * * * *', -- A cada 15 minutos
  $$
  select net.http_post(
    url:='https://seu-projeto.supabase.co/functions/v1/run-automation',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer SUA_ANON_KEY"}'::jsonb,
    body:=concat('{"automationId": "', id, '"}')::jsonb
  ) as request_id
  from automations
  where is_active = true
  and (
    (schedule_type = 'daily' and extract(hour from now()) = extract(hour from schedule_time::time))
    or (schedule_type = 'weekly' and extract(dow from now())::text = any(schedule_days) and extract(hour from now()) = extract(hour from schedule_time::time))
  );
  $$
);
```

## Monitoramento

Cada execução gera um registro em `automation_runs` com:
- Status (running, completed, failed)
- Resultado
- Duração em ms
- Erros (se houver)

Acesse o histórico de execuções para monitorar o desempenho.

## Dicas

1. **Teste antes**: Use "Executar Agora" para testar antes de ativar
2. **Fontes confiáveis**: Certifique-se que as APIs externas são estáveis
3. **Prompts claros**: Seja específico no prompt para melhores resultados
4. **Monitore custos**: Automações frequentes podem gerar custos de API
5. **Webhooks seguros**: Use HTTPS e valide origens em seus webhooks
