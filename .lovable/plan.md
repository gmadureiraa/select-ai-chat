

# Plano: Corrigir YouTube RSS + Melhorar Qualidade das Imagens Defiverso

## Problema 1: YouTube RSS não dispara

**Causa raiz:** O parser RSS (`parseRSSFeed`) usa regex `/<item>` para extrair itens, mas o feed do YouTube usa formato **Atom** com tags `<entry>`, não `<item>`. Resultado: 0 itens encontrados, automação nunca dispara.

A única execução (28/02) foi provavelmente manual.

**Solução:** Atualizar `parseRSSFeed` no `process-automations/index.ts` para suportar feeds Atom (`<entry>`, `<title>`, `<link href="..."/>`, `<published>`, `<yt:videoId>`). Manter compatibilidade com RSS padrão (`<item>`).

## Problema 2: Imagens de baixa qualidade

**Causa raiz:** 
- A tabela `client_visual_references` está **vazia** para o Defiverso — logo, nenhuma referência visual é passada ao modelo
- O `image_prompt_template` do GM é textual mas genérico, sem ancoragem visual real
- Sem referências, o Gemini gera imagens genéricas "de espaço" sem identidade

**Solução:**
1. **Inserir referências visuais** na `client_visual_references` usando as capas reais da newsletter (URLs do Beehiiv que já aparecem nos `media_urls` dos planning_items)
2. **Reescrever o `image_prompt_template`** do GM Defiverso com instruções muito mais específicas sobre o estilo visual: cores exatas, composição, estilo de ilustração digital
3. Com as referências visuais populadas, o sistema já passará as imagens como input ao Gemini para style-matching

## Implementação

1. **Editar `parseRSSFeed`** em `process-automations/index.ts` — adicionar parsing de `<entry>` (Atom/YouTube) além de `<item>` (RSS)
2. **SQL INSERT** em `client_visual_references` — adicionar 2-3 capas reais da newsletter como referências visuais primárias
3. **SQL UPDATE** no GM Diário Defiverso — reescrever `image_prompt_template` com estilo visual preciso baseado nas capas reais
4. **Redeploy** da edge function e teste manual da automação YouTube

