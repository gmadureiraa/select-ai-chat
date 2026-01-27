
# Plano: Implementar Busca Automática de Contexto na Criação de Conteúdo

## Objetivo
Fazer o kAI Chat buscar automaticamente exemplos da biblioteca de conteúdo e referências do cliente ao criar qualquer tipo de conteúdo, eliminando a dependência de @mentions manuais.

---

## Mudanças Necessárias

### Arquivo: `supabase/functions/kai-simple-chat/index.ts`

#### 1. Adicionar função para buscar exemplos da biblioteca de conteúdo

```typescript
async function fetchLibraryExamples(
  supabase: any,
  clientId: string,
  contentType: string | null,
  limit: number = 5
): Promise<string> {
  // Buscar exemplos do mesmo formato na biblioteca de conteúdo
  let query = supabase
    .from("client_content_library")
    .select("title, content, content_type, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  
  // Filtrar por tipo de conteúdo se detectado
  if (contentType) {
    query = query.eq("content_type", contentType);
  }
  
  const { data: examples } = await query.limit(limit);
  
  if (!examples || examples.length === 0) return "";
  
  let context = `\n## Exemplos da Biblioteca de Conteúdo (siga este estilo)\n`;
  examples.forEach((ex: any, i: number) => {
    context += `\n### Exemplo ${i + 1}: ${ex.title} (${ex.content_type})\n`;
    context += `${ex.content?.substring(0, 1500) || ""}${ex.content?.length > 1500 ? '...' : ''}\n`;
  });
  
  return context;
}
```

#### 2. Adicionar função para buscar referências relevantes

```typescript
async function fetchReferenceExamples(
  supabase: any,
  clientId: string,
  referenceType: string | null,
  limit: number = 3
): Promise<string> {
  let query = supabase
    .from("client_reference_library")
    .select("title, content, reference_type")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  
  if (referenceType) {
    query = query.eq("reference_type", referenceType);
  }
  
  const { data: refs } = await query.limit(limit);
  
  if (!refs || refs.length === 0) return "";
  
  let context = `\n## Referências do Cliente (inspiração e benchmarks)\n`;
  refs.forEach((ref: any, i: number) => {
    context += `\n### Referência ${i + 1}: ${ref.title}\n`;
    context += `${ref.content?.substring(0, 1000) || ""}${ref.content?.length > 1000 ? '...' : ''}\n`;
  });
  
  return context;
}
```

#### 3. Chamar as novas funções quando detectar criação de conteúdo

Modificar a seção de preparação de contexto (~linha 1726):

```typescript
let libraryExamplesContext = "";
let referenceExamplesContext = "";

if (contentCreation.isContentCreation) {
  // Buscar exemplos da biblioteca de conteúdo (mesmo formato)
  libraryExamplesContext = await fetchLibraryExamples(
    supabase,
    clientId,
    contentCreation.detectedFormat,
    5
  );
  
  // Buscar referências do cliente (mesmo tipo ou genéricas)
  referenceExamplesContext = await fetchReferenceExamples(
    supabase,
    clientId,
    contentCreation.detectedFormat,
    3
  );
  
  // Buscar top performers do Instagram (manter para métricas)
  // ... código existente ...
}
```

#### 4. Adicionar ao system prompt

```typescript
// Adicionar exemplos da biblioteca ANTES das instruções
if (libraryExamplesContext) {
  systemPrompt += `\n${libraryExamplesContext}`;
}

if (referenceExamplesContext) {
  systemPrompt += `\n${referenceExamplesContext}`;
}
```

#### 5. Melhorar as instruções de criação de conteúdo

Atualizar as instruções para enfatizar o uso dos exemplos:

```typescript
systemPrompt += `
## Instruções para Criação de Conteúdo
Você está criando conteúdo para o cliente. SIGA RIGOROSAMENTE:

1. **Exemplos da Biblioteca**: REPLIQUE o estilo, estrutura e tom dos exemplos acima
2. **Referências**: Use as referências como inspiração, mas adapte ao estilo do cliente
3. **Tom de voz**: EXATAMENTE como definido no Guia de Identidade
4. **Regras do formato**: Siga as regras obrigatórias (limites, estrutura)
5. **Zero emojis** no corpo do texto (apenas CTA final se necessário)
6. **Linguagem direta**: Verbos de ação, números específicos
7. **PROIBIDO**: "Entenda", "Aprenda", "Descubra", frases genéricas

PRIORIDADE: Exemplos da Biblioteca > Referências > Top Performers Instagram
`;
```

---

## Mapeamento de Tipos de Conteúdo

Garantir que o mapeamento de formatos funcione para buscar na biblioteca:

| Formato Detectado | content_type na Biblioteca |
|-------------------|---------------------------|
| carrossel | carousel |
| newsletter | newsletter |
| post_instagram | instagram_post |
| linkedin | linkedin_post |
| tweet | tweet |
| thread | thread |
| reels | reels |
| stories | stories |
| artigo | x_article |
| blog | blog_post |

---

## Resultado Esperado

### Antes:
```
Usuário: "Crie uma newsletter sobre produtividade"
IA: [conteúdo genérico sem seguir padrão do cliente]
```

### Depois:
```
Usuário: "Crie uma newsletter sobre produtividade"

Sistema carrega automaticamente:
1. ✅ identity_guide do cliente
2. ✅ 5 newsletters existentes da biblioteca
3. ✅ 3 referências de newsletters salvas
4. ✅ Regras de formato de newsletter
5. ✅ Top performers do Instagram (como métrica)

IA: [conteúdo seguindo exatamente o estilo das newsletters anteriores]
```

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/kai-simple-chat/index.ts` | Adicionar funções de busca + integrar no fluxo |

---

## Ordem de Implementação

1. Criar `fetchLibraryExamples()` - Buscar exemplos da biblioteca de conteúdo
2. Criar `fetchReferenceExamples()` - Buscar referências do cliente
3. Integrar chamadas no fluxo de criação de conteúdo
4. Adicionar contextos ao system prompt
5. Atualizar instruções de criação para priorizar exemplos
6. Deploy e testar com diferentes formatos

---

## Seção Técnica

### Limites de Contexto
- Exemplos da biblioteca: max 5 itens, 1500 chars cada = ~7500 chars
- Referências: max 3 itens, 1000 chars cada = ~3000 chars
- Total adicional: ~10500 chars (dentro do limite seguro)

### Query Otimizada
Buscar em paralelo para melhor performance:
```typescript
const [libraryExamples, referenceExamples, topPosts] = await Promise.all([
  fetchLibraryExamples(supabase, clientId, contentCreation.detectedFormat, 5),
  fetchReferenceExamples(supabase, clientId, contentCreation.detectedFormat, 3),
  fetchTopPerformers(supabase, clientId),
]);
```

### Fallback
Se não houver exemplos do formato específico, buscar exemplos genéricos do cliente para manter consistência de tom.
