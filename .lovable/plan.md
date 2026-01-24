
# Plano: Melhorias na Biblioteca, Acessos, Suporte e Cards do Canvas

## Resumo das Solicitações

1. **Adicionar referências visuais na biblioteca** (aba "Visuais" já existe no Canvas Library Drawer)
2. **Verificar acessos por tipo de usuário e assinatura**
3. **Adicionar botão de suporte WhatsApp em Configurações** (landing já tem)
4. **Melhorar interface da biblioteca no Canvas** - mostrar cards com imagem/capa como preview
5. **Cards de biblioteca no Canvas devem ser totalmente legíveis**

---

## Fase 1: Melhorar Interface da Biblioteca no Canvas (CanvasLibraryDrawer)

### 1.1 Cards de Conteúdo com Preview Visual
O `CanvasLibraryDrawer.tsx` já usa o `ContentCard`, mas os cards podem ser melhorados para mostrar:
- **Thumbnail/capa do conteúdo** (já implementado parcialmente)
- **Preview visual maior** nos modos "medium" e "large"

**Arquivo:** `src/components/kai/canvas/CanvasLibraryDrawer.tsx`

**Mudanças:**
```typescript
// Usar ContentCard com onPreview habilitado
<ContentCard
  item={item}
  size={cardSize}
  onSelect={() => handleSelectContent(item)}
  onPreview={() => setPreviewItem(item)} // Já existe
/>
```

O `ContentCard` já suporta exibição de thumbnails - verificar se `thumbnail_url` está sendo populado corretamente nos dados unificados.

---

## Fase 2: Cards de Biblioteca Legíveis no Canvas (AttachmentNode)

### 2.1 Expandir Preview de Conteúdo da Biblioteca
Atualmente, o `AttachmentNode` para tipo `library` mostra apenas 3 linhas (`line-clamp-3`). Precisamos:

**Arquivo:** `src/components/kai/canvas/nodes/AttachmentNode.tsx`

**Mudanças:**
```typescript
{/* LIBRARY content - with full view option */}
{output.type === 'library' && (
  <div className="space-y-2">
    {/* Title badge */}
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium truncate flex-1">{output.libraryTitle || output.fileName}</span>
      {output.libraryPlatform && (
        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded capitalize">
          {output.libraryPlatform}
        </span>
      )}
    </div>
    
    {/* Library images carousel - MELHORAR */}
    {output.libraryImages && output.libraryImages.length > 0 && (
      <div className="relative rounded-lg overflow-hidden bg-black/5">
        <img 
          src={output.libraryImages[currentImageIndex] || output.libraryImages[0]} 
          alt="Preview"
          className="w-full h-40 object-cover" // Aumentar de h-32 para h-40
        />
        {/* ... navegação ... */}
      </div>
    )}
    
    {/* Content preview - MOSTRAR MAIS TEXTO */}
    <div className="bg-muted rounded-md p-2 max-h-48 overflow-y-auto">
      <p className="text-xs whitespace-pre-wrap">{output.content}</p> {/* Remover line-clamp-3 */}
    </div>
    
    {/* View full content button - JÁ EXISTE */}
    <Button
      variant="ghost"
      size="sm"
      className="w-full h-7 text-[10px] gap-1 text-primary hover:text-primary/80 hover:bg-primary/10"
      onClick={() => setShowTranscription(true)}
    >
      <Expand className="h-3 w-3" />
      Ver conteúdo completo
    </Button>
  </div>
)}
```

### 2.2 Aumentar Largura do Node de Biblioteca
O card atual tem `w-80` (320px). Para conteúdo de biblioteca:
- Aumentar para `w-96` (384px) quando for tipo `library`
- Ou fazer o node expandível

---

## Fase 3: Adicionar Botão de Suporte WhatsApp nas Configurações

### 3.1 Criar Seção de Suporte em SettingsTab
**Arquivo:** `src/components/settings/SettingsTab.tsx`

**Adicionar seção após "Zona de Perigo":**
```typescript
import { MessageCircle, HelpCircle } from "lucide-react";
import { SALES_CONTACT } from "@/lib/plans";

// Adicionar nova seção após renderProfileSection()
const renderSupportCard = () => (
  <Card>
    <CardHeader>
      <div className="flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-muted-foreground" />
        <CardTitle>Suporte</CardTitle>
      </div>
      <CardDescription>Precisa de ajuda? Fale com nossa equipe</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          variant="outline" 
          onClick={() => window.open(SALES_CONTACT.whatsapp, "_blank")}
          className="gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
        <Button 
          variant="ghost" 
          onClick={() => window.open("mailto:contato@kaleidos.ai")}
          className="gap-2"
        >
          <Mail className="h-4 w-4" />
          Email
        </Button>
      </div>
    </CardContent>
  </Card>
);

// Adicionar na renderProfileSection() após o card de Zona de Perigo:
{renderSupportCard()}
```

---

## Fase 4: Verificar Acessos por Tipo de Usuário e Assinatura

### 4.1 Verificação de Roles (useWorkspace)
O hook `useWorkspace.ts` já implementa as permissões corretamente:

| Role | Permissões |
|------|------------|
| **Owner/Admin** | Acesso total: Tools, Team, Clients, Delete |
| **Member** | Criar/editar, sem delete, sem Tools, sem Team |
| **Viewer** | Apenas leitura: Performance, Biblioteca, Assistente (read-only) |

### 4.2 Verificação de Subscription
Preciso verificar se as restrições por plano estão funcionando:

- **Canvas (Starter)**: 1 perfil, 1 membro, sem Performance, sem Planning
- **Pro**: 10 perfis, 5 membros, acesso total

**Arquivos a verificar:**
- `src/hooks/useSubscription.ts` ou equivalente
- `WorkspaceContext.tsx` - já busca dados de subscription

### 4.3 Pontos de Verificação no Código
1. **Criação de perfis**: Verificar limite `max_clients`
2. **Adição de membros**: Verificar limite `max_members`
3. **Acesso a features Pro**: Verificar `subscription.type !== 'starter'`

---

## Fase 5: Landing Page - Confirmar Suporte (já existe)

A landing page já tem:
- **Footer**: WhatsApp em "Empresa > Contato" e "Suporte > WhatsApp"
- **FAQ Section**: Link "Fale conosco pelo WhatsApp"
- **Help Page**: Botão de WhatsApp

✅ Não precisa de mudanças na landing page.

---

## Fase 6: Referências Visuais na Biblioteca Principal

### 6.1 Situação Atual
- `KaiLibraryTab.tsx` tem 4 abas: Conteúdo, Refs, Estudos de Caso, Relatórios
- **Não tem aba de Visuais** (só tem no Canvas Library Drawer)

### 6.2 Adicionar Aba "Visuais" em KaiLibraryTab
**Arquivo:** `src/components/kai/KaiLibraryTab.tsx`

```typescript
import { useClientVisualReferences } from "@/hooks/useClientVisualReferences";
import { Image } from "lucide-react";

// Adicionar hook
const { references: visualReferences } = useClientVisualReferences(clientId);

// Adicionar TabsTrigger
<TabsTrigger value="visuals" className="gap-2 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-600">
  <Image className="h-4 w-4" />
  <span className="hidden sm:inline">Visuais</span>
  <Badge variant="secondary" className="ml-1 bg-purple-500/20 text-purple-600 font-bold">
    {visualReferences?.length || 0}
  </Badge>
</TabsTrigger>

// Adicionar TabsContent com grid de imagens
<TabsContent value="visuals" className="mt-4 flex-1 overflow-y-auto">
  {visualReferences?.length === 0 ? (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center py-8 text-muted-foreground">
          <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma referência visual</p>
          <Button variant="outline" className="mt-4" onClick={handleAddButtonClick}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Visual
          </Button>
        </div>
      </CardContent>
    </Card>
  ) : (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {visualReferences?.map((ref) => (
        <div key={ref.id} className="group rounded-lg border overflow-hidden">
          <div className="aspect-square bg-muted">
            <img src={ref.image_url} alt={ref.title || ""} className="w-full h-full object-cover" />
          </div>
          <div className="p-2">
            <p className="text-xs font-medium truncate">{ref.title || "Sem título"}</p>
            <Badge variant="outline" className="text-[10px] mt-1">{ref.reference_type}</Badge>
          </div>
        </div>
      ))}
    </div>
  )}
</TabsContent>
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/components/kai/canvas/nodes/AttachmentNode.tsx` | Expandir preview de biblioteca, remover line-clamp, aumentar altura de imagem |
| `src/components/kai/canvas/CanvasLibraryDrawer.tsx` | Garantir que ContentCard mostra thumbnails corretamente |
| `src/components/settings/SettingsTab.tsx` | Adicionar card de Suporte com WhatsApp |
| `src/components/kai/KaiLibraryTab.tsx` | Adicionar aba "Visuais" com grid de imagens |

---

## Ordem de Execução

1. **AttachmentNode** - Melhorar legibilidade de cards de biblioteca no canvas
2. **CanvasLibraryDrawer** - Verificar exibição de thumbnails nos cards
3. **SettingsTab** - Adicionar botão de suporte WhatsApp
4. **KaiLibraryTab** - Adicionar aba de referências visuais
5. **Testar acessos** - Verificar permissões por role e subscription

---

## Testes Necessários

1. Adicionar conteúdo da biblioteca ao canvas → verificar se card é legível
2. Navegar pela biblioteca no canvas → verificar se thumbnails aparecem
3. Acessar Configurações → verificar se botão de suporte está presente
4. Acessar Biblioteca → verificar se aba "Visuais" aparece com imagens
5. Testar como Viewer → confirmar acesso restrito
6. Testar com plano Canvas → confirmar limites de perfis
