

# Plano: Reverter e Melhorar Biblioteca de Conteúdo

## Objetivo
Restaurar a experiência anterior da biblioteca e adicionar as seções de Estudo de Caso e Relatórios que foram solicitadas.

---

## Fase 1: Restaurar Sistema de Filtros por Botões

### 1.1 Remover Filtro de Tipo Externo
**Arquivo:** `src/components/kai/KaiLibraryTab.tsx`

Remover a passagem de `typeFilter`, `sortOption`, `viewMode` e `searchQuery` para o `UnifiedContentGrid` - deixar o grid usar seus próprios filtros internos (os botões de plataforma).

**De:**
```typescript
<UnifiedContentGrid
  clientId={clientId}
  typeFilter={typeFilter}
  sortOption={sortOption}
  viewMode={viewMode}
  searchQuery={searchQuery}
  onSelectContent={...}
/>
```

**Para:**
```typescript
<UnifiedContentGrid
  clientId={clientId}
  onSelectContent={...}
/>
```

### 1.2 Restaurar Comportamento Original do Grid
**Arquivo:** `src/components/kai/library/UnifiedContentGrid.tsx`

- Garantir que os botões de plataforma (Todos, Favoritos, Instagram, YouTube, Twitter, LinkedIn, Newsletter, Outros) sejam sempre exibidos
- Remover a lógica condicional que esconde os filtros quando `externalTypeFilter` é fornecido
- Manter o campo de busca interno do grid

---

## Fase 2: Criar Estrutura de Abas para Biblioteca

### 2.1 Adicionar Novas Abas
**Arquivo:** `src/components/kai/KaiLibraryTab.tsx`

Modificar as tabs para incluir 4 seções:

```typescript
<TabsList>
  <TabsTrigger value="content">
    <Layers className="h-4 w-4" />
    Conteúdo
    <Badge>{unifiedContent?.length || 0}</Badge>
  </TabsTrigger>
  
  <TabsTrigger value="references">
    <Link2 className="h-4 w-4" />
    Refs
    <Badge>{references?.length || 0}</Badge>
  </TabsTrigger>
  
  <TabsTrigger value="case-studies">
    <BookOpen className="h-4 w-4" />
    Estudos de Caso
    <Badge>{caseStudies?.length || 0}</Badge>
  </TabsTrigger>
  
  <TabsTrigger value="reports">
    <FileBarChart className="h-4 w-4" />
    Relatórios
    <Badge>{reports?.length || 0}</Badge>
  </TabsTrigger>
</TabsList>
```

### 2.2 Filtrar Conteúdo por Tipo
- **Conteúdo:** Posts de Instagram, Twitter, LinkedIn, Newsletters (exceto case_study e report)
- **Estudos de Caso:** Itens com `content_type = 'case_study'`
- **Relatórios:** Itens com `content_type = 'report'`
- **Refs:** Referências existentes (mantém como está)

---

## Fase 3: Implementar Aba de Estudos de Caso

### 3.1 Criar Componente `CaseStudyGrid`
**Novo arquivo:** `src/components/kai/library/CaseStudyGrid.tsx`

Grid específico para estudos de caso:
- Cards maiores com preview do conteúdo
- Visualização de texto rico (Markdown)
- Botão para criar novo estudo de caso
- Opção de editar/excluir

### 3.2 Atualizar AddContentDialog para Estudos de Caso
Quando tipo for `case_study` ou `report`:
- Mostrar o editor rico (`RichContentEditor`)
- Permitir inserção de imagens inline
- Preview em tempo real do Markdown

### 3.3 Preview Especial para Estudos de Caso
**Arquivo:** `src/components/kai/library/ContentPreviewDialog.tsx`

Para itens com `content_type === 'case_study'` ou `content_type === 'report'`:
- Usar visualização expandida (largura maior)
- Renderizar conteúdo com ReactMarkdown
- Suporte a imagens inline no texto

---

## Fase 4: Implementar Aba de Relatórios

### 4.1 Reutilizar Estrutura de Estudos de Caso
A lógica é a mesma, apenas filtrando por `content_type = 'report'`

### 4.2 Cards Específicos
- Ícone de documento/gráfico
- Preview do conteúdo resumido
- Data de criação destacada

---

## Fase 5: Manter Funcionalidades de Download e Galeria

### 5.1 Galeria de Imagens
Manter a galeria navegável no preview, mas usar apenas `thumbnail_url` quando `images` estiver vazio

### 5.2 Download
Manter botões de download funcionando (já implementados)

---

## Fase 6: Limpar Filtros Externos Não Utilizados

### 6.1 Simplificar LibraryFilters
**Arquivo:** `src/components/kai/LibraryFilters.tsx`

Remover o dropdown de tipo de conteúdo - deixar apenas:
- Ordenação (Mais recente, Mais antigo, A-Z, Z-A)
- Modo de visualização (Grid/Lista)
- Seleção múltipla/exclusão

---

## Resumo de Mudanças

| Arquivo | Mudanças |
|---------|----------|
| `KaiLibraryTab.tsx` | Adicionar abas Estudos de Caso e Relatórios, remover passagem de filtros externos |
| `UnifiedContentGrid.tsx` | Restaurar filtros por botão de plataforma como default |
| `LibraryFilters.tsx` | Remover dropdown de tipo de conteúdo |
| `CaseStudyGrid.tsx` | Novo componente para estudos de caso |
| `AddContentDialog.tsx` | Suporte a case_study e report com editor rico |
| `ContentPreviewDialog.tsx` | Preview expandido para estudos de caso/relatórios |

---

## Resultado Final

A biblioteca terá 4 abas:
1. **Conteúdo** - Posts de redes sociais com filtros por botão (Instagram, Twitter, etc)
2. **Refs** - Referências existentes
3. **Estudos de Caso** - Documentos ricos com texto e imagens
4. **Relatórios** - Documentos de análise e relatórios

Cada aba com sua própria interface otimizada para o tipo de conteúdo.

