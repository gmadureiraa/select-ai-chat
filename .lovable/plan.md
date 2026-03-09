

# Plano: Publicação Multi-plataforma no Card de Planejamento

## Problema Atual
O card de planejamento deriva a plataforma automaticamente do tipo de conteúdo (`tweet` → Twitter, `carousel` → Instagram, etc.). Isso impede publicar o mesmo conteúdo em múltiplas redes. O botão "Publicar Agora" envia para uma única plataforma.

## O que será feito

### 1. Adicionar seleção multi-plataforma no PlanningItemDialog
- Substituir a derivação automática de plataforma por um **grupo de checkboxes** com todas as plataformas disponíveis (Instagram, Twitter/X, LinkedIn, YouTube Shorts, TikTok, Threads, Facebook, Newsletter, Blog)
- O tipo de conteúdo continua existindo para definir o formato, mas a plataforma de publicação é escolhida separadamente
- O campo `platform` do `planning_items` continuará armazenando a plataforma principal; as plataformas extras serão salvas no `metadata.target_platforms`

### 2. Atualizar o botão "Publicar Agora" para multi-plataforma
- Ao clicar "Publicar Agora", o sistema itera sobre todas as plataformas selecionadas e chama `publishContent` para cada uma
- Mostra progresso indicando quais plataformas foram publicadas com sucesso/falha
- Se apenas uma plataforma selecionada, comportamento idêntico ao atual

### 3. Manter compatibilidade com agendamento
- Ao agendar (`scheduledAt`), as plataformas selecionadas ficam salvas no metadata para que o sistema de auto-publish consiga publicar em todas

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/planning/PlanningItemDialog.tsx` | Adicionar estado `selectedPlatforms: string[]`, renderizar checkboxes de plataforma, loop de publicação multi-plataforma |
| `src/types/contentTypes.ts` | Adicionar constante `ALL_PLATFORMS` com todas as plataformas disponíveis para seleção |
| `supabase/functions/process-automations/index.ts` | Verificar `metadata.target_platforms` no auto-publish agendado para publicar em múltiplas plataformas |

## Detalhes da UI

O grupo de checkboxes aparecerá logo abaixo do seletor de formato/conteúdo tipo, com layout em grid de 3 colunas:
```
☑ Instagram  ☑ Twitter/X  ☑ LinkedIn
☐ TikTok     ☐ YouTube    ☑ Threads
☐ Facebook   ☐ Newsletter ☐ Blog
```

Cada checkbox mostrará indicador de status (conta conectada ou não) baseado no `useClientPlatformStatus`.

## Lógica de publicação multi-plataforma

```typescript
// Loop sequencial para cada plataforma selecionada
for (const targetPlatform of selectedPlatforms) {
  try {
    await lateConnection.publishContent(targetPlatform, finalContent, {
      mediaUrls, planningItemId, threadItems
    });
    successPlatforms.push(targetPlatform);
  } catch (err) {
    failedPlatforms.push(targetPlatform);
  }
}
// Toast de resumo: "Publicado em 3/4 plataformas"
```

