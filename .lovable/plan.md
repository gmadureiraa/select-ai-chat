

# Plano: Dashboard de Custos de IA nas Configurações

## Dados Atuais

O sistema tem **606 logs de uso** desde Dez/2025, mas **nenhum está associado a um client_id** — todos são NULL. O custo total acumulado é ~**R$ 24.50** (~$4.30 USD), distribuído assim:

| Função | Chamadas | Custo (R$) |
|--------|----------|------------|
| Multi-agent Writer | 72 | R$ 10.53 |
| Multi-agent Editor | 58 | R$ 7.74 |
| Multi-agent Researcher | 61 | R$ 1.61 |
| Chat response | 146 | R$ 0.98 |
| CSV validation | 39 | R$ 1.16 |
| Geração de imagem | 17 | R$ 0.49 |
| Outros | ~170 | R$ 1.99 |
| **Total** | **606** | **~R$ 24.50** |

## O que será feito

### 1. Nova seção "Uso de IA" nas Configurações
Adicionar tab "Uso de IA" no `SettingsNavigation.tsx` com:
- **Resumo geral**: custo total do mês, chamadas totais, tokens consumidos
- **Breakdown por função**: tabela com chat, geração de conteúdo, imagens, CSV, etc.
- **Breakdown por modelo**: gemini-2.5-flash vs pro vs lite
- **Gráfico de evolução mensal**: barras ou linha mostrando custo/mês
- **Projeção**: baseado no uso dos últimos 30 dias, projetar custo mensal

### 2. Associar client_id nos logs futuros
Atualizar o `kai-simple-chat` edge function para salvar `client_id` no `ai_usage_logs` quando o chat está no contexto de um cliente. Isso permitirá breakdown por cliente no futuro.

### 3. Componente `AIUsageSettings.tsx`
Novo componente com:
- Cards de KPI no topo (custo total mês, chamadas, tokens, projeção)
- Tabela detalhada por edge_function com custo em BRL e USD
- Tabela por modelo
- Histórico mensal (últimos 6 meses)

## Arquivos a criar/modificar
1. **`src/components/settings/AIUsageSettings.tsx`** — Novo componente com dashboard de custos
2. **`src/components/settings/SettingsNavigation.tsx`** — Adicionar seção "Uso de IA"
3. **`src/components/settings/SettingsTab.tsx`** — Renderizar nova seção
4. **`supabase/functions/kai-simple-chat/index.ts`** — Passar client_id ao logAIUsage

