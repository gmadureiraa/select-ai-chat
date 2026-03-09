

# Plano: Melhorias de Design e Interface -- Performance, Biblioteca e kAI Chat

## Diagnóstico

Após revisão completa do código, identifiquei disparidades significativas entre os dashboards e oportunidades de melhoria nas três áreas.

### Performance: Disparidades entre plataformas

O Instagram Dashboard (1003 linhas) é muito mais completo que LinkedIn (438), Twitter (475) e YouTube (432). Features presentes apenas no Instagram:

| Feature | Instagram | LinkedIn | Twitter | YouTube | Newsletter |
|---------|-----------|----------|---------|---------|------------|
| Relatório IA (PerformanceReportGenerator) | ✅ | -- | -- | ✅ | -- |
| Custom date range (calendário) | ✅ | -- | -- | -- | -- |
| Top Posts Grid (visual cards) | ✅ | -- | -- | -- | -- |
| Best Posts by Metric | ✅ | -- | -- | -- | -- |
| Posting Time Heatmap | ✅ | -- | -- | -- | -- |
| Post Averages Section | ✅ | -- | -- | -- | -- |
| Goals Panel | ✅ | -- | -- | (disabled) | -- |
| AI Insights Card | ✅ | -- | -- | -- | ✅ |
| Stories Section | ✅ | N/A | N/A | N/A | N/A |
| Sync to Library | ✅ | -- | -- | -- | -- |
| Last import timestamp | ✅ | -- | -- | -- | -- |

### Biblioteca: Funcional mas com UX gaps
- Busca só aparece nas abas "Refs" e "Visuais" -- deveria funcionar em todas
- Seleção em batch (checkboxes) só funciona na aba de referências
- Falta empty state mais informativo na aba "Conteúdo"
- Grid de visuais poderia ter lightbox para visualização ampliada

### kAI Chat: Sólido mas com polish pendente
- `KaiChatArea.tsx` (185 linhas) parece ser um componente legado/secundário -- o real é `KaiAssistantTab.tsx` com `EnhancedMessageBubble`
- Actions de assistant (Copy, ThumbsUp, RefreshCw) no KaiChatArea têm `opacity-0 group-hover:opacity-100` mas o `group` class está no parent `div`, pode não funcionar corretamente
- Botão de Paperclip no KaiChatArea não tem funcionalidade conectada
- Empty state do chat é bom, mas QuickSuggestions poderia ter mais variedade contextual

## Mudanças Propostas

### A. Performance -- Nivelar LinkedIn e Twitter com Instagram (maior impacto)

**LinkedInDashboard.tsx:**
- Adicionar botão "Gerar Análise" com `PerformanceReportGenerator` (já existe para Instagram/YouTube)
- Adicionar `TopPostsGrid` com os 3 melhores posts por engajamento
- Adicionar timestamp do último import (como Instagram)
- Adicionar seção `PostAveragesSection` com médias de impressões, engajamentos, cliques

**TwitterDashboard.tsx:**
- Adicionar botão "Gerar Análise" com `PerformanceReportGenerator`
- Adicionar `TopPostsGrid` com os 3 melhores tweets
- Adicionar timestamp do último import
- Adicionar seção de médias por tweet

**NewsletterDashboard.tsx:**
- Adicionar botão "Gerar Análise" com `PerformanceReportGenerator` (tem insights mas não o report generator completo)

### B. Biblioteca -- Search global e UX refinements

**KaiLibraryTab.tsx:**
- Mover barra de busca para fora das tabs (sempre visível, filtra qualquer aba ativa)
- Estender seleção em batch para a aba "Conteúdo" (com delete em massa)
- Melhorar empty states com ilustrações/descrições mais claras

### C. kAI Chat -- Polish de interação

**KaiAssistantTab.tsx:**
- Remover o `KaiChatArea.tsx` legado (não é usado pelo fluxo principal)
- Adicionar indicador de "tokens usados" sutil no header do chat
- Melhorar responsividade do ModeSelector em mobile (já existe mas pode estar cortado)

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/components/performance/LinkedInDashboard.tsx` | Adicionar Report Generator, Top Posts, médias, timestamp |
| `src/components/performance/TwitterDashboard.tsx` | Adicionar Report Generator, Top Posts, médias, timestamp |
| `src/components/performance/NewsletterDashboard.tsx` | Adicionar Report Generator |
| `src/components/kai/KaiLibraryTab.tsx` | Search global, batch selection em content |
| `src/components/kai/KaiChatArea.tsx` | Remover (legado não usado) |

## Prioridade de Execução

1. LinkedIn + Twitter dashboards (maior gap visual vs Instagram)
2. Newsletter dashboard (report generator)
3. Biblioteca (search + batch)
4. Chat cleanup

