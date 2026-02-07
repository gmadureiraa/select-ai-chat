-- Atualizar kai_documentation para tweet com regras de emoji mais restritivas
UPDATE kai_documentation
SET content = '## REGRAS OBRIGATÓRIAS PARA TWEET

### ESTRUTURA
- **Máximo 280 caracteres** (incluindo espaços)
- Uma mensagem clara, impactante e direta
- **SEM HASHTAGS** - hashtags são datadas e prejudicam alcance

### FORMATO DE ENTREGA
```
[Texto do tweet - máx 280 chars, sem hashtags, sem emojis decorativos]
```

### REGRA DE EMOJI (CRÍTICO)
- **PADRÃO**: ZERO emojis no corpo do tweet
- **EXCEÇÃO**: máximo 1 emoji no CTA final, SE absolutamente relevante
- **NA DÚVIDA**: NÃO use emoji
- **PROIBIDO**: Emojis decorativos (💡🔥✨🚀💰📈💼🎯 etc.) em qualquer parte

### PROIBIÇÕES ABSOLUTAS
- ❌ HASHTAGS (NUNCA use hashtags, são consideradas spam em 2024+)
- ❌ Exceder 280 caracteres (CRÍTICO)
- ❌ Emojis decorativos no corpo do texto (💡🔥✨🚀💰📈💼🎯)
- ❌ Linguagem corporativa ou genérica
- ❌ Começar com "Você sabia que..." ou similares
- ❌ Tweets vazios sem valor real (apenas afirmações genéricas)
- ❌ Mencionar o nome do cliente como hashtag (#gabrielmadureira, etc)
- ❌ Frases como "Aqui está", "Segue", "Criei para você"

### TÉCNICAS QUE FUNCIONAM
- ✅ Gancho forte na primeira frase
- ✅ Números específicos ("3 erros" em vez de "alguns erros")
- ✅ Opinião ou take polêmico que gera discussão
- ✅ Perguntas diretas que provocam reflexão
- ✅ Insight único baseado em experiência real
- ✅ Estrutura com quebras de linha para ritmo',
    updated_at = now()
WHERE doc_key = 'tweet' AND doc_type = 'format';

-- Atualizar kai_documentation para thread com regras de emoji mais restritivas
UPDATE kai_documentation
SET content = '## REGRAS OBRIGATÓRIAS PARA THREAD

### ESTRUTURA
- **Tweet 1**: Gancho irresistível que promete valor
- **Tweets 2-9**: Uma ideia por tweet, máximo 280 caracteres
- **Tweet final**: CTA + resumo do valor entregue

### FORMATO DE ENTREGA
```
Tweet 1/10:
[Gancho prometendo o que a pessoa vai aprender/ganhar]

Tweet 2/10:
[Primeiro ponto - uma ideia]

[...]

Tweet 10/10:
[CTA: Curta, salve, siga para mais]
```

### REGRA DE EMOJI (CRÍTICO)
- **PADRÃO**: ZERO emojis no corpo dos tweets
- **EXCEÇÃO**: máximo 1 emoji no tweet final (CTA), SE relevante
- **NA DÚVIDA**: NÃO use emoji
- **PROIBIDO**: Emojis decorativos (💡🔥✨🚀💰📈💼🎯 etc.)

### PROIBIÇÕES ABSOLUTAS
- ❌ Tweets que excedem 280 caracteres
- ❌ Múltiplas ideias no mesmo tweet
- ❌ Ganchos vagos
- ❌ Emojis decorativos no corpo (💡🔥✨🚀💰📈💼🎯)
- ❌ HASHTAGS (nunca use)

### TÉCNICAS QUE FUNCIONAM
- ✅ Numerar os tweets (1/10, 2/10...)
- ✅ Conectores entre tweets ("Mas tem mais...")
- ✅ Listas dentro dos tweets',
    updated_at = now()
WHERE doc_key = 'thread' AND doc_type = 'format';