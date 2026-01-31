
# Contexto IA como Aba Final do Perfil + Geração Inteligente

## Visão Geral

Reorganizar o perfil do cliente para que o **Contexto de IA** seja a última aba (a "estrela final"), gerado automaticamente a partir de TODAS as fontes de dados do cliente. Este contexto será o **documento central** que a IA consulta para criar qualquer conteúdo.

## Estrutura Atual vs. Nova

| Posição | Atual | Nova |
|---------|-------|------|
| Aba 1 | Perfil (com Contexto IA inline) | Perfil |
| Aba 2 | Presença Digital | Presença Digital |
| Aba 3 | Referências | Referências |
| Aba 4 | Integrações | Integrações |
| Aba 5 | - | **Contexto IA** |

## Arquitetura de Geração do Contexto

O novo Contexto IA será gerado combinando TODAS as fontes:

```
┌─────────────────────────────────────────────────────────────────┐
│                    GERAÇÃO DO CONTEXTO IA                        │
└─────────────────────────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ PERFIL      │      │ DIGITAL     │      │ BIBLIOTECA  │
│ • Nome      │      │ • Websites  │      │ • Conteúdos │
│ • Descrição │      │   scraped   │      │ • Referências│
│ • Segmento  │      │ • Redes     │      │ • Documentos│
│ • Tom       │      │   sociais   │      │ • Visuais   │
│ • Público   │      │   (links)   │      │ (extraídos) │
│ • Objetivos │      └─────────────┘      └─────────────┘
└─────────────┘              │                      │
       │                     │                      │
       └─────────────────────┴──────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │      🤖 GEMINI 2.0 FLASH      │
              │  (Processa + Estrutura tudo)  │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   CONTEXTO IA ESTRUTURADO     │
              │   (Markdown completo salvo    │
              │    em identity_guide)         │
              └───────────────────────────────┘
```

## Fontes de Dados a Processar

| Fonte | Tabela/Campo | O que Extrair |
|-------|--------------|---------------|
| Descrição manual | `clients.description` | Texto do usuário |
| Tags/Posicionamento | `clients.tags` | segment, tone, audience, objectives, etc. |
| Redes Sociais | `clients.social_media` | Links e handles |
| Websites | `client_websites.scraped_markdown` | Conteúdo scrapeado |
| Documentos | `client_documents.extracted_content` | PDFs, DOCs transcritos |
| Biblioteca Conteúdo | `client_content_library.content` | Posts, artigos (favoritos) |
| Biblioteca Refs | `client_reference_library.content` | Referências externas |
| Instagram Posts | `instagram_posts.caption` | Legendas com melhor performance |
| YouTube Videos | `youtube_videos.transcript` | Transcrições |

## Implementação

### 1. Nova Aba "Contexto IA" (ClientEditTabsSimplified.tsx)

```
┌────────────────────────────────────────────────────────────────┐
│  Perfil  │  Digital  │  Referências  │  Integrações  │ 🧠 IA  │
└────────────────────────────────────────────────────────────────┘
                                                            ↑
                                                      Nova aba
```

**Conteúdo da aba:**
- Card de status mostrando quais fontes estão disponíveis
- Botão "Gerar Contexto Completo" (chama edge function)
- Textarea editável com o `identity_guide` gerado
- Indicador de última atualização

### 2. Nova Edge Function: `generate-client-context`

Função dedicada que:
1. Busca TODOS os dados do cliente de todas as tabelas
2. Faz scrape de redes sociais via links (se não tiver conteúdo)
3. Monta um mega-prompt para o Gemini
4. Gera um documento estruturado em Markdown
5. Salva em `clients.identity_guide`

**Estrutura do contexto gerado:**

```markdown
# [Nome do Cliente] - Contexto Operacional para IA

## 1. IDENTIDADE E POSICIONAMENTO
[Extraído da descrição + tags]

## 2. PÚBLICO-ALVO E PERSONAS
[Baseado em tags.audience + análise de conteúdo]

## 3. TOM DE VOZ E LINGUAGEM
### Tom: [Formal/Informal/Técnico/Didático]
### Características:
- [Lista de características]
### Palavras-chave: [keywords]
### Evitar: [anti-patterns]

## 4. PRESENÇA DIGITAL
### Website: [resumo do conteúdo scrapeado]
### Redes Sociais: [análise das redes]

## 5. CONTEÚDO DE REFERÊNCIA
### Top Performers:
[Análise dos posts com melhor performance]

### Estilo de Escrita:
[Padrões identificados nos conteúdos]

## 6. DIRETRIZES DE CRIAÇÃO
[Regras inferidas do histórico]

## 7. FONTES UTILIZADAS
[Lista de documentos, websites, conteúdos processados]
```

### 3. Atualizar kai-content-agent

Modificar para dar prioridade máxima ao `identity_guide`:

```typescript
// ANTES: contexto fragmentado
if (client?.identity_guide) {
  contextPrompt += `### Guia de Identidade\n${client.identity_guide}\n\n`;
}
if (client?.context_notes) {
  contextPrompt += `### Contexto Adicional\n${client.context_notes}\n\n`;
}

// DEPOIS: contexto unificado como BASE
if (client?.identity_guide) {
  contextPrompt = `## 🎯 CONTEXTO PRINCIPAL DO CLIENTE\n
*Este é o documento mestre. SIGA RIGOROSAMENTE estas diretrizes.*

${client.identity_guide}

---

`;
}
```

### 4. UI da Aba de Contexto

```
┌─────────────────────────────────────────────────────────────────┐
│  🧠 Contexto de IA                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📊 Fontes de Dados Disponíveis                          │   │
│  │                                                         │   │
│  │  ✓ Descrição e posicionamento                          │   │
│  │  ✓ 3 websites indexados                                │   │
│  │  ✓ 5 documentos transcritos                            │   │
│  │  ✓ 12 conteúdos na biblioteca                          │   │
│  │  ⚠ Sem posts do Instagram sincronizados               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────┐  ┌───────────────────────────┐   │
│  │ 🔄 Regenerar Contexto    │  │ ⏰ Última geração:        │   │
│  │    com todas as fontes   │  │    15/03/2024 às 14:30    │   │
│  └──────────────────────────┘  └───────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ # Gabriel Madureira - Contexto Operacional              │   │
│  │                                                         │   │
│  │ ## 1. IDENTIDADE E POSICIONAMENTO                       │   │
│  │ Estrategista Full-Stack para Marcas Web3...             │   │
│  │                                                         │   │
│  │ ## 2. PÚBLICO-ALVO                                      │   │
│  │ Empreendedores e criadores no ecossistema Web3...       │   │
│  │                                                         │   │
│  │ [... documento completo editável ...]                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/generate-client-context/index.ts` | CRIAR | Nova edge function de geração |
| `src/components/clients/ClientEditTabsSimplified.tsx` | MODIFICAR | Adicionar 5ª aba + remover contexto inline |
| `src/components/clients/AIContextTab.tsx` | CRIAR | Componente da nova aba |
| `supabase/functions/kai-content-agent/index.ts` | MODIFICAR | Priorizar identity_guide |
| `src/hooks/useClientContext.ts` | CRIAR | Hook para gerenciar contexto |

## Fluxo de Geração Detalhado

```
USUÁRIO CLICA "REGENERAR CONTEXTO"
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. COLETA DE DADOS (Edge Function)                          │
│                                                             │
│    SELECT * FROM clients WHERE id = ?                       │
│    SELECT scraped_markdown FROM client_websites             │
│    SELECT extracted_content FROM client_documents           │
│    SELECT content FROM client_content_library (favorites)   │
│    SELECT content FROM client_reference_library             │
│    SELECT caption FROM instagram_posts (top 5 by engagement)│
│    SELECT transcript FROM youtube_videos (top 5 by views)   │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. ENRIQUECIMENTO (Opcional - se tiver links não scrapeados)│
│                                                             │
│    Para cada rede social com link mas sem conteúdo:         │
│    → Chamar firecrawl-scrape                                │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. MONTAGEM DO MEGA-PROMPT                                  │
│                                                             │
│    "Analise TODO o material abaixo e gere um documento      │
│     de contexto estruturado seguindo o template..."         │
│                                                             │
│    + descrição + tags + websites + docs + biblioteca + ...  │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. GERAÇÃO COM GEMINI 2.0 FLASH                             │
│                                                             │
│    Temperature: 0.3 (mais factual)                          │
│    Max tokens: 8192                                         │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SALVAR EM identity_guide                                 │
│                                                             │
│    UPDATE clients SET identity_guide = ?, updated_at = NOW()│
└─────────────────────────────────────────────────────────────┘
          │
          ▼
      EXIBIR NA UI
```

## Como a IA Usa o Contexto

### Antes (fragmentado):
```
kai-content-agent busca:
  ├── clients.identity_guide (pode estar vazio)
  ├── clients.context_notes (duplicado)
  ├── client_content_library (5 itens)
  ├── client_reference_library (5 itens)
  ├── instagram_posts (5 top)
  └── youtube_videos (5 top)
```

### Depois (unificado):
```
kai-content-agent busca:
  └── clients.identity_guide ← DOCUMENTO MESTRE
      (já contém análise de TUDO, estruturado e pronto)
      
  + Opcionalmente: exemplos recentes para refresh
```

**Benefícios:**
- Contexto mais consistente e completo
- Menos queries no banco
- IA tem visão holística do cliente
- Usuário pode editar/refinar o documento
- Histórico de quando foi gerado

## Seção Técnica

### Estrutura da Edge Function `generate-client-context`

```typescript
interface ContextSources {
  profile: {
    name: string;
    description: string;
    tags: Record<string, string>;
    social_media: Record<string, string>;
  };
  websites: Array<{ url: string; content: string }>;
  documents: Array<{ name: string; content: string }>;
  contentLibrary: Array<{ title: string; content: string; type: string }>;
  referenceLibrary: Array<{ title: string; content: string }>;
  instagramPosts: Array<{ caption: string; engagement: number }>;
  youtubeVideos: Array<{ title: string; transcript: string; views: number }>;
}

// Limite de caracteres por fonte para não estourar contexto
const LIMITS = {
  websites: 3000,      // por website
  documents: 2000,     // por documento
  content: 1500,       // por conteúdo
  references: 1000,    // por referência
  instagram: 500,      // por post
  youtube: 2000,       // por vídeo (transcrição)
  totalPrompt: 50000,  // total do prompt
};
```

### Template do Prompt de Geração

```typescript
const systemPrompt = `Você é um especialista em estratégia de marca e marketing digital.

Analise TODAS as informações fornecidas sobre o cliente e gere um documento de contexto COMPLETO e ESTRUTURADO em Markdown.

Este documento será usado pela IA para criar todo o conteúdo do cliente, então seja:
- ESPECÍFICO: Use exemplos reais do material fornecido
- PRÁTICO: Foque em diretrizes acionáveis
- FIEL: Preserve o tom de voz identificado nos materiais
- COMPLETO: Cubra todas as seções do template

TEMPLATE OBRIGATÓRIO:
[... estrutura do documento ...]`;
```

### Atualização do kai-content-agent

```typescript
// Dar máxima prioridade ao identity_guide
if (client?.identity_guide) {
  contextPrompt = `## 🎯 CONTEXTO OPERACIONAL DO CLIENTE

*DOCUMENTO MESTRE - Siga TODAS as diretrizes abaixo rigorosamente.*

${client.identity_guide}

---
## MATERIAL ADICIONAL DE REFERÊNCIA
`;
} else {
  // Fallback para geração dinâmica (cliente sem contexto gerado)
  contextPrompt = `## Cliente: ${client?.name}\n...`;
}
```

## Estimativa de Implementação

| Tarefa | Tempo |
|--------|-------|
| Nova edge function `generate-client-context` | 45 min |
| Componente `AIContextTab.tsx` | 30 min |
| Modificar `ClientEditTabsSimplified.tsx` | 20 min |
| Hook `useClientContext.ts` | 15 min |
| Atualizar `kai-content-agent` | 15 min |
| Testes e ajustes | 25 min |
| **Total** | ~2h 30min |
