## Audit: estado atual do Jornal Cripto + Sequência Viral

**Cliente** (`cd25972a-...`):
- `avatar_url`: SVG genérico "JC" laranja (criado na rodada anterior, não é o personagem nem o jornalzinho).
- `social_media`: tem `website / newsletter / radar`. **Não tem campo de handle de Instagram.**
- `client_reference_library`: vazia (nenhum logo carregado ainda).

**Edge `generate-viral-carousel`**:
- `slideCount` default = 8. Cliente já passa por param, mas a UI/chat sempre força 8.
- Handle gerado por fallback: `@${client.name.toLowerCase().replace(/\s+/g,"")}` → renderiza como `@jornalcripto`. Quer `@ojornalcripto`.

**Componentes UI**:
- `TwitterSlide.tsx` está no padrão correto (1 layout, header + body + imagem abaixo).
- `types.ts` mantém `emptyCarousel` criando array fixo de 8 — precisa virar parametrizável pro modo "single slide".

---

## Plano de ajustes

### 1. Trocar avatar do Jornal Cripto pelo logo oficial

O usuário menciona "jornalzinho com laranja no fundo ou o personagem" — assets que ele já tem mas não estão no projeto. Vou:
- Criar `public/clients/jornal-cripto/avatar.svg` **novo**, redesenhado como ícone de jornalzinho dobrado (📰 estilizado) sobre fundo laranja `#F7931A` (cor Bitcoin), em SVG vetorial limpo, 200×200, cantos arredondados full (avatar circular).
- Subir via migration pro bucket `client-files/jornal-cripto/avatar.svg` (overwrite do atual "JC").
- Manter `clients.avatar_url` apontando pro mesmo path (já está correto).

> Se o usuário tiver o PNG/SVG real do personagem ou logo final, ele pode trocar depois pela aba do cliente. O ícone de jornalzinho fica como placeholder muito superior ao "JC".

### 2. Adicionar handle correto `@ojornalcripto`

`social_media` JSONB do cliente vai ganhar a chave `instagram_handle`. Migration:
```sql
UPDATE clients
SET social_media = social_media || '{"instagram_handle":"ojornalcripto"}'::jsonb
WHERE id = 'cd25972a-...';
```

E na edge `generate-viral-carousel` (linha 391-395), trocar fallback:
```ts
const igHandle = (client.social_media as any)?.instagram_handle;
handle: igHandle ? `@${igHandle}` : `@${client.name.toLowerCase().replace(/\s+/g,"")}`,
```

### 3. Suporte a "single slide mode" (1 slide ao invés de 8)

**Por que**: vai virar automação RSS → 1 post = 1 imagem com manchete + legenda. Não faz sentido carrossel de 8.

**Mudanças**:
- `generate-viral-carousel/index.ts`: aceita `slideCount: 1`. Ajustar `buildPrompt` pra reconhecer caso especial:
  - Quando `slideCount === 1`: prompt pede UM slide com manchete forte + 2-3 linhas de contexto + imagem da notícia. Sem CTA separado.
- `types.ts`: `emptyCarousel(clientId, profile, slideCount = 8)` parametrizável.
- `createViralCarousel` tool (chat): aceitar `slideCount` opcional no schema.
- `SlideEditor` / `SavedCarouselsSidebar`: já são dinâmicos pelo array, sem mudança.

### 4. Pequenos ajustes de design no `TwitterSlide.tsx`

Auditando o render atual (slide aberto na rota `?carouselId=6c7ba...`):
- Conferir spacing entre header/body/image (ref repo usa 32px gap).
- Garantir que a imagem da notícia tenha `object-cover` com aspect 16:9 (não esticar) e border 1px sutil.
- Ajustar tamanho do `@handle` e contador (1/1) pra cinza `#71767B` exato do Twitter.
- Letter-spacing do nome do perfil (-0.01em) pra ficar 1:1 com X/Twitter real.

Vou abrir o componente, comparar com o padrão do repo de referência e aplicar refinamentos pontuais — sem reestruturar.

### 5. Regenerar o carrossel de teste como **single slide**

Após deploy:
- Apagar o carousel atual de 8 slides do cliente (`6c7ba5ed-...`).
- Chamar `generate-viral-carousel` com:
  - `slideCount: 1`
  - briefing: pegar 1 notícia real do RSS do Jornal Cripto (`https://jornalcripto.com/feed/` ou newsletter), título + summary + imagem destacada.
  - `persistAs: "both"`.
- Validar visual final na aba Sequência Viral.

### 6. Memory updates

Salvar em `mem://features/automations/jornal-cripto-instagram-strategy`:
- Padrão = 1 slide por notícia (single tweet visual).
- Handle: `@ojornalcripto`.
- Avatar: jornalzinho laranja Bitcoin.

---

## Resumo do que fica entregue

1. Avatar novo (jornalzinho SVG laranja) no storage + override do antigo.
2. Handle `@ojornalcripto` salvo no `social_media` e renderizado nos slides.
3. `slideCount=1` suportado end-to-end (edge + tool do chat + UI).
4. Refinamentos de tipografia/spacing no `TwitterSlide` (1:1 com X real).
5. Novo teste: 1 slide com notícia real do RSS, visível na rota atual.
6. Memory atualizada.

Posso seguir?