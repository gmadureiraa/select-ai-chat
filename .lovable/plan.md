
# Plano: Corrigir Capas de Newsletter + Polimento para Lançamento

## Problema 1: Capas de Newsletter Exibindo Placeholder

### Diagnóstico
As newsletters do Defiverso mostram o placeholder "DEFIVERSO" porque:
- `thumbnail_url` = NULL para todas as newsletters
- `images_in_metadata` = NULL também
- Origem: Importadas via **sync de métricas/RSS**, não via **Beehiiv API** (que extrai `thumbnail_url`)

### Solução: Atualizar sync-rss-to-library para Extrair Thumbnail Real

**Arquivo:** `supabase/functions/sync-rss-to-library/index.ts`

O RSS do Beehiiv contém a capa no campo `<enclosure>` ou `<media:thumbnail>`. Modificar o parser:

```typescript
// Adicionar extração de thumbnail específica para Beehiiv
const enclosure = itemXml.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i)?.[1];
const mediaThumbnail = itemXml.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1];

// Priorizar: enclosure > mediaThumbnail > first image > null
const thumbnail = enclosure || mediaThumbnail || item.allImages?.[0] || null;
```

### Solução Alternativa: Scraping Retroativo das Capas

Criar uma edge function `update-newsletter-covers` que:
1. Busca newsletters com `thumbnail_url IS NULL`
2. Para cada uma, faz scraping do `content_url` (ex: `https://news.defiverso.com/p/...`)
3. Extrai a tag `<meta property="og:image">` que contém a capa real
4. Atualiza o registro na `client_content_library`

```typescript
// Extrair og:image do HTML da página
const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)?.[1];
if (ogImage) {
  await supabase
    .from("client_content_library")
    .update({ thumbnail_url: ogImage })
    .eq("id", newsletter.id);
}
```

---

## Problema 2: Fallback Atual Exibe Markdown Cru

Na imagem você vê `![](https://media.beehiiv.com/...)` - isso é Markdown sendo exibido como texto em vez da imagem.

**Arquivo:** `src/components/kai/library/ContentCard.tsx`

O `item.content` contém Markdown com links de imagem. Podemos extrair a primeira imagem como fallback:

```typescript
// Se não tem thumbnail_url, tentar extrair do content
const extractedImage = !item.thumbnail_url 
  ? item.content?.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/)?.[1]
  : null;

const displayThumbnail = item.thumbnail_url || extractedImage;
```

---

## Áreas Adicionais para Polimento (Lançamento)

### 3. Onboarding Flow
- Revisar textos do `OnboardingFlow.tsx` para refletir features atuais
- Garantir que novos usuários entendam a estrutura (Chat, Performance, Biblioteca, Canvas)

### 4. Estados Vazios
- Verificar empty states em todas as abas (ex: "Estudos de Caso: 0")
- Adicionar CTAs claros para guiar usuários a criar conteúdo

### 5. Responsividade Mobile
- Testar Canvas em mobile (pode precisar ajustes)
- Verificar tabelas de performance em telas pequenas

### 6. Hardcoded Client Paths
**Arquivo:** `src/hooks/useImportContent.ts`
- Remover paths hardcoded para `layla-foz` e `defiverso`
- Usar configuração dinâmica do cliente no banco

### 7. Loading States Consistentes
- Padronizar feedback durante operações longas (geração de relatório, sync RSS)
- Adicionar skeleton loaders onde apropriado

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `sync-rss-to-library/index.ts` | Extrair thumbnail de `<enclosure>` ou `<media:thumbnail>` |
| `ContentCard.tsx` | Fallback para extrair imagem do Markdown no content |
| **NOVO** `update-newsletter-covers/index.ts` | Scraping retroativo de og:image para newsletters existentes |
| `useUnifiedContent.ts` | Priorizar extração de imagem do content se thumbnail vazio |

---

## Ordem de Execução

1. **Imediato:** Modificar `ContentCard.tsx` para extrair imagem do Markdown (corrige exibição atual)
2. **Imediato:** Atualizar `sync-rss-to-library` para capturar thumbnail do RSS corretamente
3. **Retroativo:** Criar e rodar `update-newsletter-covers` para corrigir registros existentes
4. **Polimento:** Revisar onboarding, empty states e responsividade

---

## Resultado Esperado

✅ Newsletters exibem capas reais (og:image)  
✅ Novos syncs já vêm com thumbnail correto  
✅ Fallback inteligente extrai imagem do Markdown  
✅ App polido para demonstração e vendas
