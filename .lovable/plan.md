

# Plano: 3 Automações Twitter para o Defiverso

## Situação Atual
- Já existe uma automação de tweet por newsletter (`d0dcb7ab`) mas precisa ser melhorada
- Defiverso client: `c1227fa7-f9c4-4f8c-a091-ae250919dc07`
- Twitter conectado via Late API (profile_id: `6966a0caadfdd3aef943cbd3`)
- YouTube do Lucas: channel_id `UC8oofAsuieQv3imZGvaUDOQ`
- Beehiiv RSS: `https://rss.beehiiv.com/feeds/UQC5Rb8a1M.xml`

## Automações a Criar/Atualizar

### 1. Atualizar automação existente — Tweet de Newsletter
**Ação:** UPDATE na automação `d0dcb7ab` com prompt melhorado

- Manter RSS trigger no Beehiiv
- Prompt: tweet chamativo sobre o assunto + "Leia completo na newsletter 👇" + link
- `auto_generate_image: false` (usar imagem da newsletter HTML via RSS extractor)
- O sistema já extrai imagens do HTML via `extractImagesFromHTML` — a primeira imagem do RSS será usada automaticamente como capa
- `auto_publish: true` para postar sozinho

### 2. Nova automação — Tweet de Vídeo do YouTube
**Ação:** INSERT nova automação RSS

- RSS: `https://www.youtube.com/feeds/videos.xml?channel_id=UC8oofAsuieQv3imZGvaUDOQ`
- Trigger: RSS (detecta novo vídeo automaticamente)
- Prompt: tweet chamativo sobre o vídeo + link do YouTube
- `auto_generate_image: false` (usa thumbnail do YouTube via RSS media)
- `auto_publish: true`
- Client: Defiverso (posta no Twitter do Defiverso)

### 3. Nova automação — GM Diário com Imagem
**Ação:** INSERT nova automação Schedule

- Trigger: daily às 08:00
- `auto_generate_image: true` com `image_style: 'vibrant'`
- Image prompt template: instruir a IA a criar imagem no estilo visual da capa da newsletter do Defiverso (cores escuras, estética crypto/DeFi, elementos espaciais/alienígena 👽)
- `auto_publish: true`

## Implementação

1. **SQL via insert tool** — update da automação existente + insert das 2 novas
2. **Nenhuma mudança de código** — o `process-automations` já suporta tudo (RSS com imagens, schedule com geração de imagem, auto-publish via Late API)

