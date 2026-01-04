# 📦 Fluxo e Estrutura da Biblioteca de Conteúdo

**Objetivo:** Especificação de como o sistema deve usar a biblioteca de conteúdo (content library e reference library) como referência para criar novo conteúdo.

---

## 🎯 VISÃO GERAL

A biblioteca de conteúdo contém:
- **Content Library:** Conteúdo criado anteriormente (posts, newsletters, etc)
- **Reference Library:** Referências textuais (exemplos, templates, etc)
- **Visual References:** Referências visuais (imagens, estilos, etc)

Este documento especifica **como o sistema deve usar** essas bibliotecas automaticamente.

---

## 🔄 FLUXO DE USO DA BIBLIOTECA

### 1. Consulta Automática da Content Library

**Quando o sistema cria conteúdo:**

1. **Sistema DEVE consultar automaticamente:**
   - `content_library` do cliente
   - Filtrar por formato relevante (se formato específico)
   - Buscar conteúdo similar ao sendo criado

2. **Sistema DEVE analisar:**
   - Estilo de escrita do conteúdo existente
   - Tom de voz usado
   - Estrutura e abordagem
   - Qualidade e padrões estabelecidos

3. **Sistema DEVE usar como referência:**
   - Inspirar-se no estilo (NUNCA copiar)
   - Replicar qualidade e abordagem
   - Manter consistência com conteúdo existente
   - Adaptar padrões estabelecidos

---

### 2. Consulta Automática da Reference Library

**Quando o sistema cria conteúdo:**

1. **Sistema DEVE consultar:**
   - `reference_library` do cliente
   - Referências relevantes ao tema/formato

2. **Sistema DEVE usar:**
   - Como inspiração de estrutura
   - Como referência de estilo
   - Para manter consistência

---

### 3. Consulta Automática de Visual References (Design Agent)

**Quando Design Agent gera imagem:**

1. **Design Agent DEVE consultar:**
   - `visual_references` do cliente
   - `brand_assets` do cliente
   - Filtrar por tipo relevante (se especificado)

2. **Design Agent DEVE analisar:**
   - Estilo visual das referências
   - Paletas de cores usadas
   - Composições e layouts
   - Padrões visuais estabelecidos

3. **Design Agent DEVE criar prompt:**
   - Baseado nas referências visuais
   - Incluindo estilo identificado
   - Aplicando paleta de cores
   - Mantendo consistência visual
   - Resultando em imagem indistinguível do estilo do cliente

---

## ⚠️ REGRAS OBRIGATÓRIAS DO SISTEMA

### 1. NUNCA Copiar Conteúdo

**Sistema NUNCA deve:**
- ❌ Copiar texto exato da content library
- ❌ Reutilizar conteúdo existente diretamente
- ❌ Duplicar conteúdo anterior

**Sistema SEMPRE deve:**
- ✅ Inspirar-se no estilo
- ✅ Replicar qualidade e abordagem
- ✅ Manter consistência
- ✅ Criar conteúdo novo e original

---

### 2. Manter Consistência

**Sistema DEVE:**
- ✅ Analisar conteúdo existente para identificar padrões
- ✅ Replicar abordagem estabelecida
- ✅ Manter tom de voz consistente
- ✅ Seguir estrutura similar (quando apropriado)
- ✅ Manter qualidade equivalente

**Exemplo:**

**Content Library tem posts no LinkedIn:**
- Tom profissional mas acessível
- Estrutura: Pergunta → Desenvolvimento → Call-to-action
- Abordagem: Educacional com insights práticos

**Sistema cria novo post no LinkedIn:**
- Usa mesmo tom (profissional mas acessível)
- Usa estrutura similar (pergunta → desenvolvimento → CTA)
- Mantém abordagem educacional
- **MAS cria conteúdo completamente novo**

---

### 3. Usar como Referência de Estilo

**Sistema DEVE usar content library para:**

1. **Identificar tom de voz:**
   - Analisar como cliente escreve
   - Identificar padrões de linguagem
   - Notar estilo de comunicação

2. **Identificar estrutura:**
   - Como conteúdo é organizado
   - Padrões de abertura/fechamento
   - Uso de listas, parágrafos, etc

3. **Identificar qualidade:**
   - Nível de profundidade
   - Abordagem utilizada
   - Padrões de qualidade

4. **Aplicar ao novo conteúdo:**
   - Replicar tom identificado
   - Seguir estrutura similar
   - Manter qualidade equivalente
   - Criar conteúdo novo

---

### 4. Visual References para Design Agent

**Quando Design Agent gera imagem:**

1. **Design Agent DEVE:**
   - Consultar visual references do cliente
   - Analisar estilo visual
   - Identificar paleta de cores
   - Notar composições usadas

2. **Design Agent DEVE criar prompt que:**
   - Aplica estilo visual identificado
   - Usa paleta de cores do cliente
   - Mantém consistência visual
   - Resulta em imagem alinhada com identidade visual

3. **Design Agent DEVE:**
   - Nunca copiar imagem existente
   - Sempre criar nova imagem
   - Sempre manter consistência visual
   - Sempre aplicar identidade do cliente

---

## 🔗 INTEGRAÇÃO COM AGENTES

### Content Writer + Content Library

**Fluxo obrigatório:**

1. Content Writer recebe solicitação
2. Content Writer carrega:
   - `identity_guide` (tom de voz oficial)
   - `content_library` (referência de estilo real)
   - `reference_library` (se disponível)
3. Content Writer analisa content library:
   - Identifica padrões de estilo
   - Nota abordagem estabelecida
   - Observa qualidade e estrutura
4. Content Writer cria conteúdo:
   - Combina `identity_guide` + padrões de `content_library`
   - Replica qualidade e abordagem
   - Mantém consistência
   - Cria conteúdo novo e original
5. Content Writer salva:
   - Novo conteúdo na content library
   - Futuros conteúdos usarão este como referência

---

### Design Agent + Visual References

**Fluxo obrigatório:**

1. Design Agent recebe solicitação de imagem
2. Design Agent carrega:
   - `brand_assets` (cores, logos oficiais)
   - `visual_references` (estilo visual estabelecido)
   - `identity_guide` (contexto)
3. Design Agent analisa visual references:
   - Identifica estilo visual
   - Nota paleta de cores
   - Observa composições e layouts
4. Design Agent cria prompt:
   - Baseado em visual references
   - Aplicando estilo identificado
   - Usando paleta de cores
   - Mantendo consistência
5. Design Agent gera imagem:
   - Nova imagem no estilo do cliente
   - Consistente com referências
   - Alinhada com identidade visual

---

## 📋 PROCESSO DE CONSULTA

### Passo 1: Carregar Biblioteca

**Sistema deve:**
- Carregar content library do cliente
- Carregar reference library (se disponível)
- Carregar visual references (se aplicável)
- Filtrar por relevância (formato, tema, etc)

### Passo 2: Analisar Padrões

**Sistema deve:**
- Identificar padrões de estilo
- Notar tom de voz usado
- Observar estrutura e abordagem
- Identificar padrões visuais (se aplicável)

### Passo 3: Aplicar ao Novo Conteúdo

**Sistema deve:**
- Replicar padrões identificados
- Manter consistência
- Criar conteúdo novo
- Garantir qualidade equivalente

### Passo 4: Salvar na Biblioteca

**Sistema deve:**
- Salvar novo conteúdo automaticamente
- Associar ao cliente correto
- Marcar formato correto
- Futuros conteúdos usarão como referência

---

## ⚠️ ERROS COMUNS QUE O SISTEMA DEVE EVITAR

### 1. Copiar Conteúdo Existente

**❌ ERRADO:**
```
Reutilizar texto exato da content library
```

**✅ CORRETO:**
```
Inspirar-se no estilo, replicar abordagem, criar conteúdo novo
```

### 2. Ignorar Content Library

**❌ ERRADO:**
```
Criar conteúdo sem consultar content library
```

**✅ CORRETO:**
```
Sempre consultar content library para manter consistência
```

### 3. Não Manter Consistência

**❌ ERRADO:**
```
Criar conteúdo em tom/estilo diferente do existente
```

**✅ CORRETO:**
```
Analisar content library, identificar padrões, replicar consistência
```

---

## 📚 REFERÊNCIAS

- Content Writer: `docs/agentes/CONTENT_WRITER.md`
- Design Agent: `docs/agentes/DESIGN_AGENT.md`
- Regras gerais: `docs/estrutura/regras-guias/REGRAS-GERAIS-AGENTES.md`

---

## 📋 RESUMO DO FLUXO

1. **Sistema cria conteúdo** → Consulta bibliotecas automaticamente
2. **Sistema analisa** padrões de estilo e abordagem
3. **Sistema identifica** tom, estrutura, qualidade estabelecida
4. **Sistema replica** padrões e mantém consistência
5. **Sistema cria** conteúdo novo e original
6. **Sistema salva** na biblioteca para futuras referências

---

## 🔄 CICLO VIRTUOSO

1. **Primeiro conteúdo:** Sistema usa apenas `identity_guide`
2. **Conteúdo é salvo** na content library
3. **Próximos conteúdos:** Sistema usa `identity_guide` + `content_library`
4. **Biblioteca cresce** com conteúdo consistente
5. **Consistência melhora** com mais referências
6. **Qualidade aumenta** com mais exemplos

**Resultado:** Sistema aprende e melhora continuamente, mantendo consistência crescente.

---

**Nota:** A biblioteca é usada como **referência de estilo**, não como fonte de conteúdo a copiar. O sistema sempre cria conteúdo **novo e original**, mantendo **consistência** com o existente.

