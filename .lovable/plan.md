
# Plano: Melhorias Completas na Biblioteca de Conteúdo

## Problemas Identificados

1. **ContentPreviewDialog** mostra apenas thumbnail, não tem galeria de imagens
2. **Botão "Adicionar ao Canvas"** está presente mas não é necessário
3. **Sem opção de download** das imagens
4. **Newsletters** - não há lógica para puxar capas automaticamente
5. **Sem edição** de conteúdo da biblioteca
6. **Filtros não funcionam** - o `UnifiedContentGrid` tem filtros próprios de plataforma, mas o `LibraryFilters` da aba "Conteúdo" não está conectado
7. **Área de Estudo de Caso** - criar novo tipo de conteúdo com editor de texto rico

---

## Fase 1: Galeria de Imagens no Preview

### 1.1 Buscar Imagens do Post Original
**Arquivo:** `src/hooks/useUnifiedContent.ts`

Para posts Instagram, buscar também o campo `images`:
```typescript
// Na query de instagram_posts:
.select('id, caption, thumbnail_url, images, posted_at, ...')

// Na normalização:
const postImages = Array.isArray(post.images) ? post.images : [];
const allImages = postImages.map(path => getStorageUrl(path));
if (post.thumbnail_url && !allImages.includes(post.thumbnail_url)) {
  allImages.unshift(post.thumbnail_url);
}
items.push({
  ...
  images: allImages.length > 0 ? allImages : undefined,
  ...
});
```

### 1.2 Atualizar ContentPreviewDialog
**Arquivo:** `src/components/kai/library/ContentPreviewDialog.tsx`

Adicionar galeria navegável igual ao `PostContentDialog`:
```typescript
const [currentImageIndex, setCurrentImageIndex] = useState(0);

// Usar item.images se disponível
const images = item.images || (item.thumbnail_url ? [item.thumbnail_url] : []);

// Renderizar galeria com navegação (ChevronLeft/Right, dots)
{images.length > 0 && (
  <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
    <img src={images[currentImageIndex]} />
    {images.length > 1 && (
      // Botões de navegação + contador
    )}
  </div>
)}
```

---

## Fase 2: Remover Botão "Adicionar ao Canvas"

### 2.1 Remover da Props e Renderização
**Arquivo:** `src/components/kai/library/ContentPreviewDialog.tsx`

- Remover prop `onAddToCanvas`
- Remover o botão do footer

### 2.2 Atualizar Chamadas
**Arquivo:** `src/components/kai/library/UnifiedContentGrid.tsx`

- Remover `onAddToCanvas` do `ContentPreviewDialog`

---

## Fase 3: Download de Imagens

### 3.1 Adicionar Botão de Download no Preview
**Arquivo:** `src/components/kai/library/ContentPreviewDialog.tsx`

```typescript
import { Download, DownloadCloud } from "lucide-react";
import JSZip from "jszip";

// Função para baixar uma imagem
const downloadImage = async (url: string, filename: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
};

// Função para baixar todas como ZIP
const downloadAllImages = async () => {
  const zip = new JSZip();
  for (let i = 0; i < images.length; i++) {
    const response = await fetch(images[i]);
    const blob = await response.blob();
    zip.file(`imagem-${i + 1}.jpg`, blob);
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  // Download do ZIP
};

// Botões:
<Button onClick={() => downloadImage(images[currentImageIndex], 'imagem.jpg')}>
  <Download /> Baixar imagem
</Button>
{images.length > 1 && (
  <Button onClick={downloadAllImages}>
    <DownloadCloud /> Baixar todas ({images.length})
  </Button>
)}
```

---

## Fase 4: Edição de Conteúdo da Biblioteca

### 4.1 Criar Dialog de Edição
**Novo arquivo:** `src/components/kai/library/ContentEditDialog.tsx`

```typescript
interface ContentEditDialogProps {
  item: UnifiedContentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<CreateContentData>) => void;
}

export function ContentEditDialog({ item, open, onOpenChange, onSave }: ContentEditDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    content_url: '',
  });

  // Formulário com:
  // - Input para título
  // - Textarea/Editor para conteúdo
  // - Input para URL original
  // - Seletor de tipo de conteúdo
  // - Gerenciador de imagens (upload/remover)
}
```

### 4.2 Adicionar Botão de Editar
**Arquivo:** `src/components/kai/library/ContentPreviewDialog.tsx`

- Adicionar botão "Editar" que abre o `ContentEditDialog`
- Passar callback para salvar alterações via `useContentLibrary.updateContent`

### 4.3 Hook de Atualização para Posts Originais
**Arquivo:** `src/hooks/useUnifiedContent.ts`

Criar mutation para atualizar posts na tabela original:
```typescript
export function useUpdateUnifiedContent(clientId: string) {
  return useMutation({
    mutationFn: async ({ item, data }: { item: UnifiedContentItem, data: any }) => {
      // Atualizar na tabela correta baseado em item._source
      if (item._source === 'instagram_posts') {
        await supabase.from('instagram_posts').update(data).eq('id', item.id);
      } else if (item._source === 'client_content_library') {
        await supabase.from('client_content_library').update(data).eq('id', item.id);
      }
      // etc...
    },
  });
}
```

---

## Fase 5: Corrigir Filtros da Biblioteca

### 5.1 Problema Atual
O `KaiLibraryTab` passa os filtros para `LibraryFilters`, mas não repassa para `UnifiedContentGrid`. O `UnifiedContentGrid` tem seus próprios filtros internos.

### 5.2 Solução: Unificar Filtros
**Arquivo:** `src/components/kai/library/UnifiedContentGrid.tsx`

Aceitar filtros externos como props:
```typescript
interface UnifiedContentGridProps {
  clientId: string;
  typeFilter?: ContentTypeFilter;
  sortOption?: SortOption;
  viewMode?: ViewMode;
  searchQuery?: string;
}
```

### 5.3 Conectar em KaiLibraryTab
**Arquivo:** `src/components/kai/KaiLibraryTab.tsx`

```typescript
<UnifiedContentGrid
  clientId={clientId}
  typeFilter={typeFilter}
  sortOption={sortOption}
  viewMode={viewMode}
  searchQuery={searchQuery}
/>
```

---

## Fase 6: Capas de Newsletters

### 6.1 Newsletter já tem thumbnail_url
As newsletters já armazenam capas em `thumbnail_url` ou `metadata.images`. O problema é que nem todas têm.

### 6.2 Mostrar Capa no Card
**Arquivo:** `src/components/kai/library/ContentCard.tsx`

O card já usa `item.thumbnail_url`. Só precisamos garantir que newsletters tenham essa informação.

### 6.3 Atualizar ao Criar Newsletter
**Arquivo:** `src/components/kai/library/AddContentDialog.tsx`

Ao adicionar newsletter, permitir upload de capa:
```typescript
{contentType === 'newsletter' && (
  <div className="space-y-2">
    <Label>Capa da Newsletter</Label>
    <Input type="file" accept="image/*" onChange={handleCoverUpload} />
    {coverPreview && <img src={coverPreview} className="max-h-32 rounded" />}
  </div>
)}
```

---

## Fase 7: Área de Estudo de Caso (Editor de Texto)

### 7.1 Novo Tipo de Conteúdo
Adicionar `case_study` e `report` aos tipos de conteúdo:
```typescript
// src/types/contentTypes.ts
export type ContentTypeKey = 
  | 'carousel' 
  | 'newsletter' 
  | ... 
  | 'case_study'   // Novo
  | 'report'       // Novo
  | 'document';    // Novo
```

### 7.2 Criar Editor Rico
**Novo arquivo:** `src/components/kai/library/RichContentEditor.tsx`

Usar um editor de texto rico (já temos ReactMarkdown para exibição):
```typescript
import { Textarea } from "@/components/ui/textarea";

// Para MVP: usar Textarea com suporte a Markdown
// Futuramente: integrar TipTap ou similar

interface RichContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichContentEditor({ value, onChange }: RichContentEditorProps) {
  return (
    <div className="space-y-4">
      {/* Toolbar com formatação básica */}
      <div className="flex gap-2">
        <Button onClick={() => insertMarkdown('**', '**')}>Bold</Button>
        <Button onClick={() => insertMarkdown('_', '_')}>Italic</Button>
        <Button onClick={() => insertMarkdown('## ', '')}>Heading</Button>
        <Button onClick={handleImageUpload}>Imagem</Button>
      </div>
      
      <Textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[400px] font-mono"
      />
      
      {/* Preview em tempo real */}
      <div className="prose dark:prose-invert">
        <ReactMarkdown>{value}</ReactMarkdown>
      </div>
    </div>
  );
}
```

### 7.3 Dialog para Criar Estudo de Caso
**Arquivo:** `src/components/kai/library/AddContentDialog.tsx`

Quando tipo for `case_study` ou `document`, mostrar o editor rico:
```typescript
{(contentType === 'case_study' || contentType === 'document') && (
  <RichContentEditor
    value={content}
    onChange={setContent}
    placeholder="Escreva seu estudo de caso..."
  />
)}
```

### 7.4 Visualização Dedicada
**Arquivo:** `src/components/kai/library/ContentPreviewDialog.tsx`

Para estudos de caso, usar visualização expandida com suporte a imagens inline:
```typescript
{item.platform === 'content' && item._source === 'client_content_library' && (
  <div className="prose prose-lg dark:prose-invert max-w-none">
    <ReactMarkdown
      components={{
        img: ({ src, alt }) => (
          <img src={src} alt={alt} className="rounded-lg max-w-full" />
        ),
      }}
    >
      {item.content}
    </ReactMarkdown>
  </div>
)}
```

---

## Resumo de Arquivos

| Arquivo | Mudanças |
|---------|----------|
| `src/hooks/useUnifiedContent.ts` | Buscar campo `images`, criar mutation de update |
| `src/components/kai/library/ContentPreviewDialog.tsx` | Galeria, download, remover Canvas, botão editar |
| `src/components/kai/library/UnifiedContentGrid.tsx` | Aceitar filtros externos, remover onAddToCanvas |
| `src/components/kai/library/ContentCard.tsx` | Exibir contador de imagens |
| `src/components/kai/library/ContentEditDialog.tsx` | Novo - Dialog de edição |
| `src/components/kai/library/RichContentEditor.tsx` | Novo - Editor de texto rico |
| `src/components/kai/library/AddContentDialog.tsx` | Upload de capa, tipos novos |
| `src/components/kai/KaiLibraryTab.tsx` | Conectar filtros ao grid |
| `src/types/contentTypes.ts` | Adicionar case_study, report, document |

---

## Ordem de Implementação

1. **Galeria de Imagens** (impacto visual imediato)
2. **Remover botão Canvas** (simples)
3. **Download de imagens** (funcionalidade pedida)
4. **Corrigir filtros** (bug fix)
5. **Edição de conteúdo** (funcionalidade core)
6. **Capas de newsletters** (melhoria)
7. **Estudo de Caso/Editor** (nova funcionalidade)
