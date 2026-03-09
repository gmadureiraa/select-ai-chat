

# Plano: Automações LinkedIn para Defiverso

## O que será criado

Duas automações de auto-publicação no LinkedIn do Defiverso:

### 1. LinkedIn — Novo Vídeo YouTube (RSS)
- **Trigger:** RSS do YouTube (mesmo feed já usado: `UC8oofAsuieQv3imZGvaUDOQ`)
- **Auto-publish:** Sim
- **Prompt:** Post LinkedIn curto anunciando o vídeo, com gancho baseado na transcrição real do vídeo, link no final
- **Tom:** Técnico mas acessível, direto, com emojis contextuais (padrão Defiverso)

### 2. LinkedIn — Newsletter do Dia (RSS)
- **Trigger:** RSS do Beehiiv (mesmo feed: `UQC5Rb8a1M.xml`)
- **Auto-publish:** Sim
- **Prompt:** Post LinkedIn que **lê a newsletter via Firecrawl**, extrai 1-2 pontos mais interessantes, desenvolve uma opinião/análise curta sobre o tema, e convida a ler a edição completa com link
- **Tom:** Analítico, provocador, "GM humanos do criptoverso" style

## Execução

2 INSERTs na tabela `planning_automations` — apenas dados, sem mudança de código. O pipeline existente (`process-automations`) já suporta:
- Transcrição de YouTube para contexto
- Leitura de conteúdo RSS (title, description, content, link)
- Publicação via Late API no LinkedIn
- Voice profile do Defiverso para tom de voz

## Dados das automações

| Campo | YouTube → LinkedIn | Newsletter → LinkedIn |
|-------|-------------------|----------------------|
| `trigger_type` | rss | rss |
| `trigger_config.url` | YouTube feed (mesmo) | Beehiiv feed (mesmo) |
| `platform` | linkedin | linkedin |
| `content_type` | social_post | social_post |
| `auto_publish` | true | true |
| `auto_generate_content` | true | true |
| `target_column_id` | Publicado | Publicado |

