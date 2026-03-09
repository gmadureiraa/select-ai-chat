

## Diagnóstico: Por que as automações não estão postando

### Problema 1: LinkedIn - Itens criados mas nunca publicados
As 3 automações de LinkedIn (Artigo de Opinião, Building in Public, Case & Prova Social) estão **funcionando corretamente** na geração de conteúdo e imagens. O problema é que todas estão com `auto_publish: false`. Os itens são criados com status "idea" no planejamento e ficam lá esperando publicação manual. Nenhum deles jamais é publicado automaticamente.

### Problema 2: Threads - Nenhuma automação configurada
As credenciais do Threads (conta `madureira0x`) estão válidas, mas **não existe nenhuma automação** direcionada ao Threads.

### Problema 3: Bug no retry de imagem
No `process-automations`, linha ~1322, o retry de geração de imagem referencia a variável `resolvedImagePrompt` que **não existe** no escopo (o nome correto é `fullImagePrompt`). Isso faz o retry falhar silenciosamente.

### Problema 4: Qualidade do conteúdo LinkedIn repetitivo
Os posts gerados para LinkedIn estão todos girando em torno do mesmo tema ("clareza vs complexidade em Web3"). Falta diversidade temática e o sistema de variação (que existe para tweets) não está implementado para LinkedIn.

---

## Plano de Implementação

### 1. Corrigir bug do retry de imagem no process-automations
- Substituir `resolvedImagePrompt` por `fullImagePrompt` na linha do retry

### 2. Criar sistema de variação para LinkedIn (anti-repetição)
Adicionar categorias editoriais para LinkedIn similares ao `GM_VARIATION_CATEGORIES` dos tweets:
- **Artigo de Opinião**: Análise contrarian de tendência, dados concretos, framework próprio
- **Building in Public**: Bastidores reais, números, aprendizados honestos, erros
- **Case & Prova Social**: Resultados de clientes, métricas antes/depois, processo

Cada automação LinkedIn receberá um `variation_index` rotativo com sub-temas específicos para evitar repetição.

### 3. Melhorar prompts LinkedIn com estratégia de conteúdo
Enriquecer os prompts usando o guia de conteúdo do Madureira (`public/clients/madureira/guia-conteudo.md`):
- Incorporar os 5 pilares de conteúdo como rotação temática
- Usar tom de voz definido: técnico mas didático, direto, visionário
- Adicionar instruções de formatação específicas para LinkedIn (quebras de linha, storytelling, CTA)

### 4. Habilitar auto_publish para LinkedIn (com revisão inteligente)
Alterar as 3 automações de LinkedIn para `auto_publish: true` para que os posts sejam publicados automaticamente após geração.

### 5. Criar automações para Threads
Criar 2-3 automações de Threads para o perfil Madureira:
- **Threads Diário** (daily): Repurpose do melhor tweet do dia ou insight rápido
- **Threads Semanal** (weekly): Versão expandida de um tweet de alta performance

### 6. Melhorar geração de imagem para LinkedIn
- Ajustar o aspect ratio para LinkedIn: `1.91:1` (landscape) em vez de `1:1`
- Enriquecer prompts de imagem com contexto profissional/corporativo
- Usar modelo `google/gemini-3-pro-image-preview` para maior qualidade nas imagens de LinkedIn

---

### Arquivos a modificar
1. `supabase/functions/process-automations/index.ts` - Fix retry bug, adicionar variação LinkedIn, melhorar prompts
2. Database: Atualizar `planning_automations` para habilitar auto_publish nas automações LinkedIn e criar novas automações Threads

