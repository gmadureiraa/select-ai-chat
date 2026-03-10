

# Criar Cliente Jornal Cripto + 2 Automações

## 1. Criar Cliente "Jornal Cripto"

Vou criar o perfil programaticamente no banco de dados com todas as informações extraídas do site e do README existente:

- **Nome**: Jornal Cripto
- **Descrição**: Portal de notícias, análises e educação sobre criptomoedas e mercado cripto. Desenvolvido pela Kaleidos, com +5.000 leitores e cobertura de Bitcoin, DeFi, NFTs e Macro.
- **Website**: https://jornalcripto.com/
- **Tags**: Segmento: Cripto/Blockchain, Tom: Informativo e educativo, Público: Investidores e entusiastas cripto
- **Social Media**: website: https://jornalcripto.com/

Após criação, vou salvar a análise AI com os dados do README (tom de voz, público-alvo, temas).

## 2. Automação RSS — Novas Notícias

Criar automação com:
- **Nome**: Notícia Nova
- **Trigger**: RSS Feed (`https://fqmzonmgkshcajuhmepl.supabase.co/functions/v1/rss-feed`)
- **Plataformas**: Twitter/X, LinkedIn, Threads
- **Geração IA**: Ativada — adapta o título/resumo da notícia para cada plataforma
- **Prompt template**: Contexto de notícia cripto, incluir link da matéria, tom informativo
- **Auto-publish**: Ativado (após você fazer as conexões)

## 3. Automação Diária — Preço do Bitcoin

Criar automação com:
- **Nome**: Preço do Bitcoin
- **Trigger**: Schedule diário às 07:00
- **Plataformas**: Twitter/X, LinkedIn, Threads
- **Geração IA**: Ativada — buscar preço do Bitcoin via API pública e gerar texto contextualizado
- **Geração de Imagem**: Ativada — imagem com preço atualizado
- **Prompt template**: Incluir variável `{{time_of_day}}`, preço do BTC, variação 24h
- **Auto-publish**: Ativado

### Nota técnica sobre preço do Bitcoin
O `process-automations` precisará buscar o preço do Bitcoin em tempo real via API pública (CoinGecko) no prompt template. Vou incluir instruções no prompt para que a IA busque dados atualizados via grounding/web search, ou posso adicionar uma chamada direta à API do CoinGecko no edge function para injetar o preço no contexto.

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/process-automations/index.ts` | Adicionar suporte a variável `{{btc_price}}` que busca preço via CoinGecko API para automações schedule |
| Banco de dados | INSERT do cliente + 2 automações via código |

O cliente e as automações serão criados via mutations existentes no código (useClients + usePlanningAutomations), executados pelo frontend ao carregar. Alternativamente, posso inserir diretamente no banco via SQL.

