
# Automação com Geração de Texto + Imagem (Briefings Separados)

## Visão Geral

Implementar suporte a **geração simultânea de texto e imagem** nas automações, com **briefings separados** para cada tipo de conteúdo. Isso permitirá criar posts de "Bom Dia" ou "Boa Noite" que incluam:
1. **Texto personalizado** (gerado pela IA com base no briefing de texto)
2. **Imagem temática** (gerada pela IA com base no briefing de imagem)

## Arquitetura Atual

| Componente | Responsabilidade | Status |
|------------|------------------|--------|
| `planning_automations` | Armazena configuração da automação | ✅ Existe |
| `AutomationDialog.tsx` | UI para criar/editar automações | ✅ Existe |
| `process-automations` | Executa automações | ✅ Existe |
| `kai-content-agent` | Gera texto via Gemini | ✅ Existe |
| `generate-content-v2` | Gera imagem via Gemini | ✅ Existe |

**Lacuna identificada:** Não há suporte para briefing de imagem separado nem geração automática de imagem nas automações.

---

## Implementação

### 1. Atualizar Schema do Banco de Dados

Adicionar novos campos à tabela `planning_automations`:

```sql
ALTER TABLE planning_automations 
ADD COLUMN auto_generate_image boolean DEFAULT false,
ADD COLUMN image_prompt_template text,
ADD COLUMN image_style text DEFAULT 'photographic';
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `auto_generate_image` | boolean | Se true, gera imagem automaticamente |
| `image_prompt_template` | text | Briefing separado para a imagem |
| `image_style` | text | Estilo visual: photographic, illustration, minimalist, vibrant |

### 2. Atualizar Interface (AutomationDialog.tsx)

Adicionar nova seção após "Gerar conteúdo automaticamente":

```
┌────────────────────────────────────────────────────────────┐
│ 🎨 Gerar imagem automaticamente                    [Toggle]│
├────────────────────────────────────────────────────────────┤
│ Briefing da imagem:                                        │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ Crie uma imagem minimalista de {bom dia/boa noite}   │  │
│ │ com elementos de café, sol nascendo, e cores         │  │
│ │ vibrantes. Tema: {{title}}                           │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                            │
│ Estilo visual:  [Fotográfico ▼]                           │
│   ○ Fotográfico   ○ Ilustração   ○ Minimalista   ○ Vibrante│
│                                                            │
│ ☑ Sem texto na imagem                                     │
└────────────────────────────────────────────────────────────┘
```

**Variáveis disponíveis no briefing de imagem:**
- `{{title}}` - Título do item
- `{{content}}` - Contexto do conteúdo (resumido)
- `{{time_of_day}}` - "manhã", "tarde" ou "noite" (baseado no horário da execução)

### 3. Atualizar Edge Function (process-automations)

Adicionar lógica para gerar imagem após gerar texto:

```typescript
// Após gerar conteúdo de texto...
if (automation.auto_generate_image && automation.image_prompt_template) {
  console.log(`Generating image for item ${newItem.id}...`);
  
  const imagePrompt = replaceTemplateVariables(
    automation.image_prompt_template,
    triggerData,
    automation.name
  );
  
  const imageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-content-v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      type: 'image',
      inputs: [{
        type: 'text',
        content: imagePrompt
      }],
      config: {
        format: 'post',
        aspectRatio: '1:1',
        noText: automation.image_no_text ?? true,
        style: automation.image_style || 'photographic'
      },
      clientId: automation.client_id
    }),
  });
  
  if (imageResponse.ok) {
    const imageResult = await imageResponse.json();
    if (imageResult.imageUrl) {
      mediaUrls.push(imageResult.imageUrl);
      console.log(`Image generated: ${imageResult.imageUrl}`);
    }
  }
}
```

### 4. Fluxo de Execução

```text
┌─────────────────────────────────────────────────────────────┐
│                    AUTOMAÇÃO DISPARADA                       │
│                   (schedule/rss/webhook)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              1. CRIAR PLANNING ITEM (CARD)                   │
│                     Título + Descrição                       │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ auto_generate   │  │ auto_generate   │  │ Nenhuma geração │
│ _content: true  │  │ _image: true    │  │ automática      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         ▼                    ▼                    │
┌─────────────────┐  ┌─────────────────┐          │
│ kai-content-    │  │ generate-       │          │
│ agent           │  │ content-v2      │          │
│ (briefing texto)│  │ (briefing img)  │          │
└─────────────────┘  └─────────────────┘          │
         │                    │                    │
         ▼                    ▼                    │
┌─────────────────────────────────────────────────┤
│          3. ATUALIZAR PLANNING ITEM              │
│    content + media_urls (texto + imagem gerada)  │
└──────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               4. AUTO-PUBLISH (se habilitado)                │
│                    Late API → Plataforma                     │
└─────────────────────────────────────────────────────────────┘
```

### 5. Exemplo de Uso: GM Diário

**Configuração da Automação:**

| Campo | Valor |
|-------|-------|
| Nome | GM Diário Gabriel |
| Gatilho | Agenda: Diário às 7:00 |
| Perfil | Gabriel Madureira |
| Tipo de Conteúdo | Tweet |
| **Gerar Texto** | ✅ Ativo |
| Briefing Texto | `Crie um tweet de GM curto e autêntico. Tom Web3, building in public. Referência ao {{time_of_day}}.` |
| **Gerar Imagem** | ✅ Ativo |
| Briefing Imagem | `Imagem minimalista de café e teclado ao amanhecer. Cores quentes, luz suave. Sem texto.` |
| Estilo | Fotográfico |
| Sem texto na imagem | ✅ |
| Auto-publish | ✅ (Twitter) |

**Resultado Esperado:**
```
Tweet:
"GM fam ☀️
Café quente, tela acesa, código rodando.
Mais um dia construindo em público. 
Qual seu projeto hoje?"

+ Imagem gerada automaticamente (café + teclado + luz dourada)
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/migrations/xxx_add_image_generation_to_automations.sql` | Adicionar colunas |
| `src/hooks/usePlanningAutomations.ts` | Atualizar interface e types |
| `src/components/planning/AutomationDialog.tsx` | Adicionar UI de briefing de imagem |
| `supabase/functions/process-automations/index.ts` | Adicionar lógica de geração de imagem |

---

## Detalhes Técnicos

### Interface Atualizada (TypeScript)

```typescript
export interface PlanningAutomation {
  // ... campos existentes
  auto_generate_content: boolean;
  prompt_template: string | null;
  // NOVOS CAMPOS
  auto_generate_image: boolean;
  image_prompt_template: string | null;
  image_style: 'photographic' | 'illustration' | 'minimalist' | 'vibrant' | null;
  image_no_text: boolean;
}
```

### Variável Dinâmica `{{time_of_day}}`

```typescript
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'manhã';
  if (hour >= 12 && hour < 18) return 'tarde';
  return 'noite';
}

// No replaceTemplateVariables:
variables['{{time_of_day}}'] = getTimeOfDay();
```

### Estilos de Imagem

| Estilo | Descrição para Prompt |
|--------|----------------------|
| `photographic` | `Professional photography style, ultra realistic, natural lighting` |
| `illustration` | `Digital illustration, artistic style, clean vector-like aesthetic` |
| `minimalist` | `Minimalist design, clean composition, lots of white space, simple elements` |
| `vibrant` | `Vibrant colors, high contrast, bold and energetic visual style` |

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Automação gera apenas texto | Texto + Imagem com briefings independentes |
| Precisa adicionar imagem manualmente | Imagem gerada automaticamente |
| Prompt único para tudo | Briefings otimizados para cada tipo |
| Sem contexto de horário | Variável `{{time_of_day}}` disponível |

---

## Estimativa

| Tarefa | Tempo |
|--------|-------|
| Migração do banco | 5 min |
| Atualizar hooks e types | 10 min |
| UI do AutomationDialog | 25 min |
| Lógica em process-automations | 20 min |
| Testes e ajustes | 15 min |
| **Total** | ~1h 15min |
