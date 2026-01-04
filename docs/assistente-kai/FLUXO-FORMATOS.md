# 📝 Fluxo e Estrutura dos Formatos

**Objetivo:** Especificação de como o sistema deve processar e aplicar formatos de conteúdo.

---

## 🎯 VISÃO GERAL

O sistema suporta **13 formatos de conteúdo** documentados em `docs/formatos/`. Este documento especifica **como o sistema deve processar** solicitações de formatos, não quais formatos existem.

---

## 🔄 FLUXO DE PROCESSAMENTO DE FORMATOS

### 1. Detecção de Formato

**Quando o usuário solicita conteúdo:**

**Método 1: Menção de Formato**
- Usuário menciona formato diretamente: "@THREAD", "tweet", "newsletter", etc
- Sistema detecta formato mencionado
- Sistema identifica documento correspondente em `docs/formatos/`

**Método 2: Detecção por Contexto**
- Usuário não menciona formato explicitamente
- Sistema analisa contexto e plataforma
- Sistema infere formato apropriado
- Sistema identifica documento correspondente

**Método 3: Menção @**
- Usuário usa "@FORMATO" (ex: @THREAD, @NEWSLETTER)
- Sistema identifica formato imediatamente
- Sistema carrega documento do formato

---

### 2. Carregamento Obrigatório da Documentação

**Quando formato é detectado:**

1. **Sistema DEVE carregar:**
   - Documentação do formato em `docs/formatos/[FORMATO].md`
   - Exemplo: `docs/formatos/THREAD.md` para thread

2. **Sistema DEVE ler:**
   - Estrutura obrigatória do formato
   - Regras de ouro do formato
   - Boas práticas
   - Formato de entrega
   - Checklist obrigatório

3. **Sistema DEVE armazenar:**
   - Estrutura obrigatória para aplicar
   - Regras que devem ser seguidas
   - Validações que devem ser executadas

---

### 3. Aplicação do Formato

**Durante criação de conteúdo:**

1. **Sistema DEVE:**
   - ✅ Aplicar estrutura obrigatória do formato
   - ✅ Seguir todas as regras de ouro
   - ✅ Respeitar limites e especificações técnicas
   - ✅ Usar formato de entrega exato

2. **Sistema DEVE combinar:**
   - Estrutura do formato (de `docs/formatos/`)
   - Tom de voz do cliente (de `identity_guide`)
   - Estilo de escrita (de `copywriting_guide`)
   - Personalidade do cliente (de `identity_guide`)

3. **Sistema DEVE validar:**
   - Usar checklist obrigatório do formato
   - Garantir que estrutura está correta
   - Verificar que regras foram seguidas
   - Confirmar que está pronto para publicar

---

## 📋 FLUXO POR TIPO DE SOLICITAÇÃO

### Solicitação com @FORMATO

**Exemplo:** Usuário digita "@THREAD sobre produtividade"

**Fluxo obrigatório:**

1. **Detecção:**
   - Sistema identifica "@THREAD"
   - Sistema carrega `docs/formatos/THREAD.md`

2. **Carregamento de contexto:**
   - `identity_guide` do cliente
   - `content_library` (para referência)
   - `global_knowledge` (quando relevante)
   - Documentação do formato THREAD

3. **Execução:**
   - Content Writer consulta documentação do formato
   - Aplica estrutura obrigatória de thread
   - Segue regras de ouro do formato
   - Combina com tom do cliente
   - Cria thread completa

4. **Validação:**
   - Usa checklist de `docs/formatos/THREAD.md`
   - Garantir estrutura correta (1/N, 2/N, etc)
   - Verificar limites de caracteres
   - Validar que está pronto

5. **Entrega:**
   - Thread completa e finalizada
   - Formato correto
   - Pronta para publicar

---

### Solicitação com Nome do Formato

**Exemplo:** Usuário digita "Faça uma newsletter sobre marketing"

**Fluxo obrigatório:**

1. **Detecção:**
   - Sistema identifica "newsletter"
   - Sistema carrega `docs/formatos/NEWSLETTER.md`

2. **Carregamento de contexto:**
   - `identity_guide` do cliente
   - `content_library`
   - `global_knowledge`
   - Documentação do formato NEWSLETTER

3. **Execução:**
   - Content Writer consulta `docs/formatos/NEWSLETTER.md`
   - Aplica estrutura obrigatória (ASSUNTO → PREVIEW → ABERTURA → CORPO → CTA → FECHAMENTO)
   - Segue regras de ouro
   - Combina com tom do cliente
   - Cria newsletter completa

4. **Validação:**
   - Usa checklist de `docs/formatos/NEWSLETTER.md`
   - Garantir todos os elementos obrigatórios
   - Validar estrutura
   - Confirmar que está pronto

5. **Entrega:**
   - Newsletter completa e finalizada
   - Estrutura correta
   - Pronta para enviar

---

### Solicitação Implícita de Formato

**Exemplo:** Usuário digita "Escreva um post para LinkedIn"

**Fluxo obrigatório:**

1. **Detecção:**
   - Sistema identifica "LinkedIn" → formato LINKEDIN_POST
   - Sistema carrega `docs/formatos/LINKEDIN_POST.md`

2. **Carregamento de contexto:**
   - `identity_guide` do cliente
   - `content_library`
   - `global_knowledge`
   - Documentação do formato LINKEDIN_POST

3. **Execução:**
   - Content Writer consulta `docs/formatos/LINKEDIN_POST.md`
   - Aplica estrutura e regras
   - Combina com tom do cliente
   - Cria post completo

4. **Validação:**
   - Usa checklist do formato
   - Valida estrutura
   - Confirma pronto

5. **Entrega:**
   - Post completo
   - Formato correto
   - Pronto para publicar

---

## ⚠️ REGRAS OBRIGATÓRIAS DO SISTEMA

### 1. Consulta Obrigatória da Documentação

**Sistema DEVE:**
- ✅ Sempre carregar documento do formato em `docs/formatos/[FORMATO].md`
- ✅ Ler estrutura obrigatória
- ✅ Ler regras de ouro
- ✅ Ler checklist obrigatório
- ✅ Aplicar tudo rigorosamente

**Sistema NUNCA deve:**
- ❌ Criar conteúdo em formato sem consultar documentação
- ❌ Ignorar estrutura obrigatória
- ❌ Pular regras de ouro
- ❌ Pular validação com checklist

### 2. Estrutura Obrigatória

**Sistema DEVE:**
- ✅ Aplicar estrutura obrigatória do formato exatamente como definida
- ✅ Incluir todos os elementos obrigatórios
- ✅ Manter ordem e hierarquia definida
- ✅ Respeitar especificações técnicas (limites, formatos, etc)

### 3. Combinação com Identidade

**Sistema DEVE:**
- ✅ Aplicar estrutura do formato (de `docs/formatos/`)
- ✅ Aplicar tom de voz do cliente (de `identity_guide`)
- ✅ Combinar ambos harmoniosamente
- ✅ Nunca comprometer estrutura do formato
- ✅ Nunca comprometer tom do cliente

### 4. Validação Obrigatória

**Antes de entregar, sistema DEVE:**
- ✅ Usar checklist obrigatório do formato
- ✅ Validar que estrutura está correta
- ✅ Verificar que regras foram seguidas
- ✅ Confirmar que está pronto para publicar
- ✅ Garantir qualidade final

### 5. Formato de Entrega

**Sistema DEVE:**
- ✅ Entregar no formato exato definido na documentação
- ✅ Seguir estrutura de entrega especificada
- ✅ Incluir todos os elementos necessários
- ✅ Formatar corretamente

---

## 🔗 INTEGRAÇÃO COM AGENTES

### Content Writer + Formatos

**Quando Content Writer cria conteúdo em formato específico:**

1. Content Writer recebe solicitação com formato
2. Content Writer consulta `docs/formatos/[FORMATO].md`
3. Content Writer aplica estrutura obrigatória
4. Content Writer combina com tom do cliente
5. Content Writer valida usando checklist
6. Content Writer entrega conteúdo finalizado

**Documentação relevante:**
- `docs/agentes/CONTENT_WRITER.md`
- `docs/formatos/[FORMATO].md`
- `docs/estrutura/regras-guias/REGRAS-GERAIS-AGENTES.md`

---

### Email Developer + Formatos

**Quando Email Developer cria template:**

1. Email Developer recebe solicitação de email/newsletter
2. Email Developer consulta `docs/formatos/EMAIL_MARKETING.md` ou `NEWSLETTER.md`
3. Email Developer aplica estrutura obrigatória
4. Email Developer cria HTML válido
5. Email Developer aplica identidade visual
6. Email Developer valida e entrega

---

## 📚 REFERÊNCIAS

- Documentação dos formatos: `docs/formatos/`
- Content Writer: `docs/agentes/CONTENT_WRITER.md`
- Email Developer: `docs/agentes/EMAIL_DEVELOPER.md`
- Regras gerais: `docs/estrutura/regras-guias/REGRAS-GERAIS-AGENTES.md`

---

## 📋 RESUMO DO FLUXO

1. **Usuário solicita conteúdo** (com @FORMATO, nome do formato, ou implícito)
2. **Sistema detecta formato** e carrega `docs/formatos/[FORMATO].md`
3. **Sistema carrega contexto** (identity guide, content library, etc)
4. **Agente consulta documentação** do formato
5. **Agente aplica estrutura obrigatória** do formato
6. **Agente combina** com tom do cliente
7. **Sistema valida** usando checklist do formato
8. **Sistema entrega** conteúdo finalizado no formato correto

---

**Nota:** Este documento especifica COMO o sistema deve processar formatos. A documentação de CADA formato está em `docs/formatos/[FORMATO].md` e deve ser consultada durante criação de conteúdo.

