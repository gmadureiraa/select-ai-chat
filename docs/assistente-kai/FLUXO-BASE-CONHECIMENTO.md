# 📚 Fluxo e Estrutura da Base de Conhecimento

**Objetivo:** Especificação de como o sistema deve usar a base de conhecimento (global_knowledge) para enriquecer conteúdo.

---

## 🎯 VISÃO GERAL

A base de conhecimento (`global_knowledge`) contém informações estratégicas, melhores práticas e diretrizes. Este documento especifica **como o sistema deve consultar e usar** essa base de conhecimento automaticamente.

---

## 🔄 FLUXO DE USO DA BASE DE CONHECIMENTO

### 1. Consulta Automática

**Quando o sistema cria conteúdo:**

1. **Sistema DEVE consultar automaticamente:**
   - `global_knowledge` (conhecimento global)
   - Conhecimento específico do cliente (se disponível)
   - Filtrar por relevância ao tema/conteúdo sendo criado

2. **Sistema DEVE buscar:**
   - Conhecimento relevante ao tema
   - Insights estratégicos aplicáveis
   - Melhores práticas da indústria
   - Frameworks e metodologias úteis
   - Diretrizes técnicas relevantes

3. **Sistema DEVE filtrar:**
   - Apenas conhecimento relevante
   - Ignorar informações não relacionadas
   - Priorizar conhecimento mais aplicável

---

### 2. Integração com Conteúdo

**Processo obrigatório:**

1. **Extrair insights:**
   - Identificar insights aplicáveis da knowledge base
   - Extrair diretrizes úteis
   - Notar melhores práticas relevantes
   - Identificar frameworks aplicáveis

2. **Adaptar ao tom do cliente:**
   - **NUNCA** usar texto genérico diretamente
   - **SEMPRE** adaptar insights ao tom de voz do cliente
   - **SEMPRE** integrar naturalmente no conteúdo
   - **SEMPRE** manter personalidade do cliente

3. **Integrar no conteúdo:**
   - Combinar insights da knowledge base com identidade do cliente
   - Enriquecer conteúdo com informações estratégicas
   - Aplicar melhores práticas
   - Manter consistência com tom do cliente

---

## ⚠️ REGRAS OBRIGATÓRIAS DO SISTEMA

### 1. Hierarquia de Prioridade

**Quando múltiplas fontes estão disponíveis:**

1. **Identidade do Cliente** (PRIORIDADE MÁXIMA)
   - `identity_guide`
   - `copywriting_guide`
   - Tom de voz e personalidade

2. **Knowledge Base** (Enriquecimento)
   - Insights e diretrizes
   - Melhores práticas
   - **SEMPRE adaptar ao tom do cliente**

3. **Formato** (Estrutura)
   - Estrutura técnica
   - Regras do formato

**Sistema NUNCA deve:**
- ❌ Substituir identidade do cliente por conhecimento genérico
- ❌ Usar tom genérico da knowledge base
- ❌ Comprometer identidade por conhecimento

---

### 2. Adaptação Obrigatória

**Sistema DEVE sempre:**

1. **Extrair insight da knowledge base:**
   - Ler informação relevante
   - Entender conceito/insight

2. **Adaptar ao tom do cliente:**
   - Transformar insight genérico em conteúdo personalizado
   - Aplicar tom de voz do cliente
   - Manter personalidade do cliente

3. **Integrar naturalmente:**
   - Não forçar insights
   - Integrar de forma natural
   - Manter fluidez do conteúdo

**Exemplo:**

**Knowledge Base diz:**
> "Newsletters devem ter CTAs claros e diretos"

**Cliente tem tom:** Conversacional e amigável

**Sistema adapta:**
> "E aí, que tal experimentar isso?" [CTA claro mas no tom conversacional do cliente]

---

### 3. NUNCA Copiar Texto Diretamente

**Sistema NUNCA deve:**
- ❌ Copiar texto exato da knowledge base
- ❌ Usar fraseologia genérica
- ❌ Ignorar tom do cliente
- ❌ Forçar insights não relevantes

**Sistema SEMPRE deve:**
- ✅ Extrair conceito/insight
- ✅ Adaptar ao tom do cliente
- ✅ Reescrever no estilo do cliente
- ✅ Integrar naturalmente

---

### 4. Filtragem por Relevância

**Sistema DEVE:**
- ✅ Usar apenas conhecimento relevante ao tema
- ✅ Ignorar informações não relacionadas
- ✅ Priorizar conhecimento mais aplicável
- ✅ Filtrar por categoria quando apropriado

**Sistema NUNCA deve:**
- ❌ Forçar insights não relevantes
- ❌ Incluir conhecimento irrelevante
- ❌ Usar conhecimento que não enriquece o conteúdo

---

## 🔗 INTEGRAÇÃO COM AGENTES

### Content Writer + Knowledge Base

**Fluxo obrigatório:**

1. Content Writer recebe solicitação
2. Content Writer carrega contexto:
   - `identity_guide` do cliente (PRIORIDADE MÁXIMA)
   - `content_library` (referência)
   - `global_knowledge` (quando disponível e relevante)
3. Content Writer consulta knowledge base:
   - Busca conhecimento relevante
   - Filtra por relevância
   - Identifica insights aplicáveis
4. Content Writer cria conteúdo:
   - Usa identidade do cliente como base
   - Enriquece com insights da knowledge base (adaptados)
   - Aplica melhores práticas (adaptadas)
   - Mantém tom do cliente
5. Content Writer entrega:
   - Conteúdo finalizado
   - Enriquecido com conhecimento estratégico
   - Mantendo identidade do cliente

---

### Researcher + Knowledge Base

**Fluxo obrigatório:**

1. Researcher recebe solicitação de pesquisa
2. Researcher consulta knowledge base:
   - Busca informações relevantes
   - Filtra por tema
   - Identifica dados e insights
3. Researcher analisa:
   - Sintetiza informações
   - Identifica padrões
   - Gera insights
4. Researcher entrega:
   - Informações verificáveis
   - Contexto relevante
   - Insights aplicáveis

---

### Strategist + Knowledge Base

**Fluxo obrigatório:**

1. Strategist recebe solicitação de estratégia
2. Strategist consulta knowledge base:
   - Busca frameworks e metodologias
   - Identifica estratégias comprovadas
   - Encontra melhores práticas
3. Strategist adapta:
   - Aplica frameworks ao contexto do cliente
   - Adapta estratégias ao cliente
   - Combina com identidade do cliente
4. Strategist entrega:
   - Estratégia estruturada
   - Baseada em frameworks comprovados
   - Adaptada ao cliente

---

## 📋 PROCESSO DE CONSULTA

### Passo 1: Identificar Relevância

**Sistema deve:**
- Analisar tema/conteúdo sendo criado
- Identificar categorias relevantes
- Buscar conhecimento relacionado
- Filtrar por relevância

### Passo 2: Extrair Insights

**Sistema deve:**
- Ler conhecimento relevante
- Identificar insights aplicáveis
- Extrair diretrizes úteis
- Notar melhores práticas

### Passo 3: Adaptar ao Cliente

**Sistema deve:**
- Pegar insight/conceito genérico
- Transformar no tom do cliente
- Aplicar personalidade do cliente
- Reescrever no estilo do cliente

### Passo 4: Integrar no Conteúdo

**Sistema deve:**
- Combinar com identidade do cliente
- Integrar naturalmente
- Manter fluidez
- Enriquecer sem comprometer identidade

---

## ⚠️ ERROS COMUNS QUE O SISTEMA DEVE EVITAR

### 1. Copiar Texto Diretamente

**❌ ERRADO:**
```
Usar texto exato da knowledge base sem adaptação
```

**✅ CORRETO:**
```
Extrair insight, adaptar ao tom do cliente, integrar naturalmente
```

### 2. Ignorar Tom do Cliente

**❌ ERRADO:**
```
Usar tom genérico da knowledge base
```

**✅ CORRETO:**
```
Adaptar insights ao tom específico do cliente
```

### 3. Forçar Insights

**❌ ERRADO:**
```
Incluir insights da knowledge base mesmo quando não são relevantes
```

**✅ CORRETO:**
```
Usar apenas insights relevantes e que enriquecem o conteúdo
```

---

## 📚 REFERÊNCIAS

- Regras gerais: `docs/estrutura/regras-guias/REGRAS-GERAIS-AGENTES.md`
- Guia de uso (para referência): `docs/estrutura/regras-guias/GUIA-USO-KNOWLEDGE-BASE.md`
- Content Writer: `docs/agentes/CONTENT_WRITER.md`
- Researcher: `docs/agentes/RESEARCHER.md`
- Strategist: `docs/agentes/STRATEGIST.md`

---

## 📋 RESUMO DO FLUXO

1. **Sistema cria conteúdo** → Consulta knowledge base automaticamente
2. **Sistema busca** conhecimento relevante ao tema
3. **Sistema filtra** por relevância
4. **Sistema extrai** insights aplicáveis
5. **Sistema adapta** insights ao tom do cliente (OBRIGATÓRIO)
6. **Sistema integra** no conteúdo de forma natural
7. **Sistema entrega** conteúdo enriquecido mantendo identidade do cliente

---

**Nota:** A knowledge base **enriquece** o conteúdo, mas **nunca substitui** a identidade do cliente. O tom e estilo do cliente são **sempre prioritários**.

