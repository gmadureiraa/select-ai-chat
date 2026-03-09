

# Plano: Refinamento de Design e Interface do Planejamento

## Problemas Identificados

1. **Dialog muito longo e sem hierarquia visual** -- tudo está empilhado verticalmente num scroll infinito, sem agrupamento claro
2. **Checkboxes de plataforma sem ícones** -- só texto, sem indicadores visuais das redes (os ícones definidos em `ALL_PUBLISH_PLATFORMS` como strings emoji não são usados)
3. **Cards no Kanban não mostram múltiplas plataformas** -- o card só mostra um `platformDot` e um ícone, sem indicar as `target_platforms` do metadata
4. **Seção de mídia com label duplicado** -- "Mídia (0)" + "Mídia (0/4)" aparecem juntos
5. **Botão "Publicar Agora" poderia ser mais proeminente** com indicação visual das plataformas destino
6. **Falta feedback visual de plataformas conectadas** no card (dots coloridos por plataforma selecionada)

## Mudanças

### A. PlanningItemDialog -- Layout e polish
- Reorganizar o grid de plataformas com **ícones Lucide reais** (Twitter, Linkedin, Instagram, Youtube, etc.) ao invés de emojis/texto puro
- Adicionar visual de "chip" selecionado com cor da plataforma (sky para Twitter, pink para Instagram, etc.)
- Remover label duplicado de mídia
- Melhorar botão "Publicar Agora" com indicadores visuais das plataformas selecionadas (mini-ícones)
- Ajustar espaçamentos e transições

### B. PlanningItemCard -- Mostrar multi-plataforma
- Ler `metadata.target_platforms` e exibir dots/ícones de cada plataforma no footer do card ao invés de apenas uma
- Limitar a 3 ícones + "+N" quando muitas plataformas

### C. ALL_PUBLISH_PLATFORMS -- Ícones reais
- Substituir emojis por referências a ícones Lucide para uso nos dois componentes

### D. Pequenos ajustes visuais gerais
- Melhorar o hover/seleção dos checkboxes de plataforma com cores branded
- Garantir que o status "conectada" (dot verde) fique mais visível
- Ajustar o grid de 3 colunas para ser responsivo (2 cols em mobile)

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/types/contentTypes.ts` | Adicionar `icon` como componente Lucide e `color` por plataforma |
| `src/components/planning/PlanningItemDialog.tsx` | Redesenhar seção de plataformas com ícones e cores, limpar mídia duplicada |
| `src/components/planning/PlanningItemCard.tsx` | Mostrar múltiplas plataformas do metadata no footer |

