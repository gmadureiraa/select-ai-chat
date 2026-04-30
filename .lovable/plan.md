## Problemas atuais

1. **Auto-imagens busca para todos os slides vazios** com queries pobres (6 primeiras palavras do texto), trazendo fotos genéricas e desconectadas.
2. **Atribuição "Pexels / autor"** aparece no slide e na barra de ações — não precisa, a licença Pexels já libera uso sem crédito.
3. **Não dá pra dizer "nem precisa de imagem nesse"** — auto-imagens trata todo slide vazio como alvo.
4. **Header da Sequência Viral está apertado**: 7 botões + título + badges numa linha só, em 1694px já corta/quebra. No SlideEditor, a barra de ações de imagem também fica espremida quando há "Preview + X" depois dos 3 botões.

## O que vou fazer

### 1. Auto-imagens mais inteligente e opt-out por slide

- Adicionar campo `image: { kind: "skip" }` no tipo `ImageSource` (slide marcado como "sem imagem de propósito" — auto-imagens ignora).
- No `SlideEditor`, novo botão **"Sem imagem"** na barra de ações que marca o slide como `skip`. Quando ativo, aparece etiqueta discreta "Sem imagem" no preview e auto-imagens pula.
- Auto-imagens passa a:
  - Pular slides `kind: "skip"` e slides que já têm imagem.
  - Pular automaticamente o slide **CTA** (último) — quase nunca precisa de foto.
  - Gerar a query via LLM (1 chamada Gemini Flash) que recebe `briefing + body do slide` e devolve **2-4 palavras-chave em inglês** (Pexels rende muito mais em inglês). Fallback para o método atual se a chamada falhar.
  - Buscar 3 candidatos por slide e pegar o primeiro que não seja duplicata de outro slide já preenchido (evita 8 fotos iguais de "laptop").

### 2. Remover atribuição Pexels

- No `SlideEditor`: remover o bloco de atribuição abaixo da barra de ações.
- No `TwitterSlide`: remover o overlay/legenda de atribuição da imagem.
- No diálogo de busca: remover o overlay de crédito do hover das miniaturas (mantém só o nome no `title` pra acessibilidade).
- Manter `attribution` e `sourceUrl` no tipo (não quebra dados salvos), só não renderizar.

### 3. UI mais limpa

**Header (`ViralSequenceTab`)**
- Reorganizar botões em duas linhas conceituais quando há slides: linha 1 (título + badges), linha 2 (ações: Preview · Auto-imagens · Zerar · Exportar · Salvar · Mandar pro Planejamento).
- Em telas largas (`xl:`), volta pra linha única; abaixo disso, segunda linha alinhada à direita.
- Encolher botões secundários para `size="xs"` visual (h-7, ícone-only no `lg:` quando útil) e mover **Zerar** para dentro do dropdown "Exportar" como item destacado, liberando espaço.

**SlideEditor**
- Quando o slide tem imagem: a linha "Preview" + "X remover" passa pra **segunda linha** abaixo dos botões IA/Buscar/Upload/Sem imagem, evitando o aperto atual.
- Aumentar o gap da barra para `gap-1.5` e dar `flex-wrap`.
- Reduzir padding interno do card de `p-3` pra `p-3 pt-2.5` e do preview de `p-4` pra `p-3` — menos vazio, slides maiores na grid.

### 4. Limpeza relacionada

- Remover toast "Pexels já libera..." e referências a "fonte" no diálogo de busca; manter só "Buscar imagem".
- Remover o seletor de fonte (Pexels/Openverse) do diálogo — Pexels é o default e o backend já tem fallback automático. Simplifica a UI.

## Arquivos a editar

- `src/components/kai/viral-sequence/types.ts` — adicionar variant `skip` em `ImageSource`.
- `src/components/kai/viral-sequence/SlideEditor.tsx` — botão "Sem imagem", remover atribuição, reorganizar barra, simplificar diálogo de busca.
- `src/components/kai/viral-sequence/TwitterSlide.tsx` — remover legenda de atribuição, suportar estado `skip` (não renderiza imagem).
- `src/components/kai/ViralSequenceTab.tsx` — header em 2 linhas, lógica nova de auto-imagens (LLM keywords + skip CTA + dedup).

Sem mudanças em edge functions nem migrations.
