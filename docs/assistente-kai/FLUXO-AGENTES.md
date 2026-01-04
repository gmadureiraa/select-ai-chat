# 🤖 Fluxo e Estrutura dos Agentes

**Objetivo:** Especificação de como o sistema deve orquestrar e usar os agentes especializados.

---

## 🎯 VISÃO GERAL

O sistema possui **6 agentes especializados** documentados em `docs/agentes/`. Este documento especifica **como o sistema deve orquestrar** esses agentes, não como o usuário os usa.

---

## 🔄 FLUXO DE ORQUESTRAÇÃO

### 1. Detecção Automática do Agente

**Quando o usuário envia uma mensagem no chat:**

1. **Sistema analisa a mensagem do usuário:**
   - Identifica intenção e tipo de tarefa
   - Detecta formato solicitado (se mencionado)
   - Identifica tipo de conteúdo necessário

2. **Sistema seleciona agente(s) apropriado(s):**
   - Consulta documentação em `docs/agentes/`
   - Seleciona agente baseado na função necessária
   - Pode selecionar múltiplos agentes para workflow

3. **Sistema carrega contexto necessário:**
   - Identity guide do cliente
   - Brand assets do cliente
   - Content library do cliente
   - Reference library do cliente
   - Global knowledge (quando relevante)

4. **Sistema executa agente(s) selecionado(s):**
   - Passa contexto completo
   - Agente consulta sua documentação em `docs/agentes/[NOME].md`
   - Agente executa sua função específica
   - Agente segue regras absolutas de sua documentação

5. **Sistema entrega resultado:**
   - Conteúdo finalizado e polido
   - Salvo na content library automaticamente
   - Retornado ao usuário

---

## 📋 AGENTES E SEUS FLUXOS

### Content Writer

**Quando usar:**
- Criação de qualquer conteúdo textual
- Posts, newsletters, artigos, scripts, copy
- **OBS:** Sistema deve detectar automaticamente quando Content Writer é necessário

**Fluxo obrigatório:**

1. **Carregar contexto:**
   - `identity_guide` do cliente (OBRIGATÓRIO)
   - `content_library` do cliente (para referência de estilo)
   - `global_knowledge` (quando disponível e relevante)
   - Documentação de formato em `docs/formatos/` (se formato específico)

2. **Consultar documentação:**
   - Ler `docs/agentes/CONTENT_WRITER.md`
   - Seguir todas as regras absolutas
   - Aplicar processo definido na documentação

3. **Se formato específico foi solicitado:**
   - Consultar `docs/formatos/[FORMATO].md`
   - Seguir estrutura obrigatória do formato
   - Aplicar regras de ouro do formato
   - Validar usando checklist do formato

4. **Executar criação:**
   - Combinar identidade do cliente + formato + conhecimento
   - Criar conteúdo finalizado
   - Validar antes de entregar

5. **Salvar resultado:**
   - Salvar automaticamente na content library
   - Associar ao cliente correto
   - Marcar formato correto

---

### Design Agent

**Quando usar:**
- Geração de imagens
- Criação de prompts para geração de imagens
- Descrição de imagens para design

**Fluxo obrigatório:**

1. **Carregar contexto:**
   - `brand_assets` do cliente (OBRIGATÓRIO)
   - `visual_references` do cliente (OBRIGATÓRIO)
   - `identity_guide` do cliente (para contexto)

2. **Consultar documentação:**
   - Ler `docs/agentes/DESIGN_AGENT.md`
   - Seguir todas as regras absolutas
   - Aplicar processo definido

3. **Criar prompt de geração:**
   - Analisar brand assets e visual references
   - Criar prompt que resulta em imagem indistinguível do estilo do cliente
   - Incluir especificações de cor, estilo, composição
   - Baseado nas referências visuais do cliente

4. **Executar geração:**
   - Usar API de geração de imagens
   - Validar resultado
   - Entregar imagem + descrição

---

### Researcher

**Quando usar:**
- Pesquisa e análise de informações
- Busca de dados e estatísticas
- Coleta de informações relevantes

**Fluxo obrigatório:**

1. **Carregar contexto:**
   - `global_knowledge` (quando disponível)
   - Contexto do cliente (se pesquisa específica)

2. **Consultar documentação:**
   - Ler `docs/agentes/RESEARCHER.md`
   - Seguir todas as regras absolutas

3. **Executar pesquisa:**
   - Consultar knowledge base
   - Buscar informações relevantes
   - Analisar e sintetizar
   - Validar informações (nunca inventar)

4. **Entregar resultado:**
   - Informações verificáveis
   - Contexto relevante
   - Fontes quando disponíveis

---

### Strategist

**Quando usar:**
- Planejamento e estratégia
- Criação de calendários editoriais
- Definição de estratégias de conteúdo

**Fluxo obrigatório:**

1. **Carregar contexto:**
   - `identity_guide` do cliente
   - `global_knowledge` (frameworks, metodologias)
   - Histórico de conteúdo (se disponível)

2. **Consultar documentação:**
   - Ler `docs/agentes/STRATEGIST.md`
   - Seguir todas as regras absolutas

3. **Executar estratégia:**
   - Aplicar frameworks da knowledge base
   - Adaptar ao cliente
   - Criar plano estruturado
   - Validar consistência

4. **Entregar resultado:**
   - Estratégia estruturada
   - Adaptada ao cliente
   - Pronta para implementação

---

### Email Developer

**Quando usar:**
- Criação de templates HTML para emails
- Desenvolvimento de newsletters HTML
- Emails transacionais

**Fluxo obrigatório:**

1. **Carregar contexto:**
   - `identity_guide` do cliente (cores, fontes)
   - `brand_assets` do cliente (logos)
   - Documentação de formato: `docs/formatos/EMAIL_MARKETING.md` ou `NEWSLETTER.md`

2. **Consultar documentação:**
   - Ler `docs/agentes/EMAIL_DEVELOPER.md`
   - Consultar formato apropriado
   - Seguir estrutura obrigatória do formato

3. **Executar desenvolvimento:**
   - Criar HTML válido
   - Aplicar identidade visual
   - Testar compatibilidade
   - Validar estrutura

4. **Entregar resultado:**
   - Template HTML completo
   - Responsivo
   - Pronto para uso

---

### Metrics Analyst

**Quando usar:**
- Análise de métricas e performance
- Geração de insights
- Relatórios de performance

**Fluxo obrigatório:**

1. **Carregar contexto:**
   - Dados de performance do cliente
   - Métricas disponíveis
   - Histórico (quando disponível)

2. **Consultar documentação:**
   - Ler `docs/agentes/METRICS_ANALYST.md`
   - Seguir todas as regras absolutas

3. **Executar análise:**
   - Processar dados
   - Identificar tendências
   - Gerar insights acionáveis
   - Comparar períodos (quando possível)

4. **Entregar resultado:**
   - Análise estruturada
   - Insights claros
   - Recomendações acionáveis

---

## 🔗 WORKFLOWS COMBINADOS

### Quando Múltiplos Agentes São Necessários

**Exemplo: Conteúdo + Imagem**

1. **Sistema detecta:** Requisição de conteúdo textual + imagem
2. **Sistema orquestra:**
   - Executa Content Writer primeiro
   - Depois executa Design Agent
   - Passa contexto do conteúdo para Design Agent
3. **Sistema entrega:** Conteúdo + Imagem alinhados

**Exemplo: Pesquisa + Conteúdo**

1. **Sistema detecta:** Requisição que precisa de pesquisa
2. **Sistema orquestra:**
   - Executa Researcher primeiro
   - Resultado da pesquisa passa para Content Writer
   - Content Writer cria conteúdo baseado na pesquisa
3. **Sistema entrega:** Conteúdo enriquecido com pesquisa

---

## ⚠️ REGRAS OBRIGATÓRIAS DO SISTEMA

### 1. Hierarquia de Informação (SEMPRE)

Quando múltiplas fontes estão disponíveis, ordem de prioridade:

1. **Identidade do Cliente** (PRIORIDADE MÁXIMA)
   - `identity_guide`
   - `brand_assets`
   - `copywriting_guide`

2. **Documentação de Formatos** (`docs/formatos/`)
   - Estrutura obrigatória
   - Regras de ouro

3. **Global Knowledge**
   - Insights e diretrizes
   - **SEMPRE adaptar ao tom do cliente**

4. **Content Library**
   - Referência de estilo
   - Inspiração, não cópia

5. **Dados e Métricas**
   - Informações verificáveis

### 2. Consulta Obrigatória de Documentação

**Sistema DEVE:**
- ✅ Sempre consultar documentação do agente em `docs/agentes/[NOME].md`
- ✅ Seguir todas as regras absolutas da documentação
- ✅ Aplicar processo definido na documentação
- ✅ Validar usando checklists da documentação

**Sistema NUNCA deve:**
- ❌ Executar agente sem consultar documentação
- ❌ Ignorar regras absolutas
- ❌ Pular validações

### 3. Salvamento Automático

**Sistema DEVE salvar automaticamente:**
- ✅ Todo conteúdo criado → content library
- ✅ Associar ao cliente correto
- ✅ Marcar formato correto
- ✅ Incluir metadados necessários

### 4. Contexto Completo

**Sistema DEVE sempre carregar:**
- ✅ Identity guide do cliente (se aplicável)
- ✅ Content library (para referência)
- ✅ Brand assets (se aplicável)
- ✅ Visual references (se aplicável)
- ✅ Global knowledge (quando disponível e relevante)

---

## 📚 REFERÊNCIAS

- Documentação dos agentes: `docs/agentes/`
- Regras gerais: `docs/estrutura/regras-guias/REGRAS-GERAIS-AGENTES.md`
- Documentação de formatos: `docs/formatos/`

---

**Nota:** Este documento especifica COMO o sistema deve orquestrar agentes. A documentação de CADA agente está em `docs/agentes/[NOME].md` e deve ser consultada durante execução.

