# 🤖 Fluxos e Estrutura do Assistente kAI

**Objetivo:** Especificações de como o sistema deve orquestrar e estruturar o funcionamento do assistente kAI.

---

## 📋 DOCUMENTOS DISPONÍVEIS

### 1. 🤖 [Fluxo e Estrutura dos Agentes](./FLUXO-AGENTES.md)
Especificação de como o sistema deve orquestrar os 6 agentes especializados:
- Detecção automática de agente
- Carregamento de contexto
- Execução e validação
- Workflows combinados
- Regras obrigatórias

**Quando consultar:** Ao implementar orquestração de agentes.

---

### 2. 📝 [Fluxo e Estrutura dos Formatos](./FLUXO-FORMATOS.md)
Especificação de como o sistema deve processar formatos de conteúdo:
- Detecção de formato (@FORMATO, nome, implícito)
- Carregamento obrigatório da documentação
- Aplicação de estrutura e regras
- Validação com checklist
- Integração com agentes

**Quando consultar:** Ao implementar processamento de formatos.

---

### 3. 📚 [Fluxo e Estrutura da Base de Conhecimento](./FLUXO-BASE-CONHECIMENTO.md)
Especificação de como o sistema deve usar a base de conhecimento:
- Consulta automática
- Adaptação obrigatória ao tom do cliente
- Integração com conteúdo
- Regras de hierarquia
- Integração com agentes

**Quando consultar:** Ao implementar uso de global_knowledge.

---

### 4. 📦 [Fluxo e Estrutura da Biblioteca de Conteúdo](./FLUXO-BIBLIOTECA-CONTEUDO.md)
Especificação de como o sistema deve usar as bibliotecas:
- Consulta automática de content library
- Uso como referência de estilo
- Manutenção de consistência
- Visual references para Design Agent
- Ciclo virtuoso de melhoria

**Quando consultar:** Ao implementar uso de bibliotecas como referência.

---

## 🎯 PROPÓSITO DESTES DOCUMENTOS

Estes documentos especificam **COMO o sistema deve funcionar**, não como o usuário deve usá-lo. Eles definem:

- ✅ Fluxos obrigatórios do sistema
- ✅ Regras de comportamento
- ✅ Integrações entre componentes
- ✅ Validações necessárias
- ✅ Hierarquias e prioridades

**Não são:**
- ❌ Guias de uso para usuários finais
- ❌ Tutoriais de como usar o kAI
- ❌ Documentação de interface

---

## 🔗 DOCUMENTAÇÃO RELACIONADA

Estes documentos referenciam e dependem de:

- **Agentes:** `docs/agentes/` - Documentação de cada agente especializado
- **Formatos:** `docs/formatos/` - Documentação de cada formato de conteúdo
- **Regras Gerais:** `docs/estrutura/regras-guias/REGRAS-GERAIS-AGENTES.md`
- **Validação:** `docs/estrutura/regras-guias/REGRAS-VALIDACAO-CONTEUDO.md`

---

## 📋 RESUMO DOS FLUXOS

### Fluxo Completo de Criação de Conteúdo

1. **Usuário solicita conteúdo** (ex: "@THREAD sobre produtividade")

2. **Sistema detecta formato:**
   - Identifica "@THREAD"
   - Carrega `docs/formatos/THREAD.md`
   - Segue `FLUXO-FORMATOS.md`

3. **Sistema detecta agente:**
   - Identifica que precisa de Content Writer
   - Carrega `docs/agentes/CONTENT_WRITER.md`
   - Segue `FLUXO-AGENTES.md`

4. **Sistema carrega contexto:**
   - `identity_guide` do cliente
   - `content_library` (seguindo `FLUXO-BIBLIOTECA-CONTEUDO.md`)
   - `global_knowledge` (seguindo `FLUXO-BASE-CONHECIMENTO.md`)
   - Documentação do formato THREAD

5. **Content Writer executa:**
   - Consulta `docs/formatos/THREAD.md`
   - Aplica estrutura obrigatória
   - Usa content library como referência de estilo
   - Enriquece com knowledge base (adaptado ao tom)
   - Combina tudo com tom do cliente
   - Valida com checklist do formato

6. **Sistema entrega:**
   - Thread completa e finalizada
   - Salva na content library automaticamente
   - Pronta para publicar

---

## ⚠️ REGRAS FUNDAMENTAIS

1. **Consulta obrigatória:** Sistema deve sempre consultar documentação relevante
2. **Hierarquia de prioridade:** Identidade do cliente > Knowledge Base > Formato
3. **Adaptação obrigatória:** Knowledge base sempre adaptada ao tom do cliente
4. **Nunca copiar:** Bibliotecas são referência, não fonte de cópia
5. **Validação obrigatória:** Sempre validar antes de entregar

---

**Nota:** Estes documentos são especificações técnicas para implementação. A documentação de cada componente (agentes, formatos) está em suas respectivas pastas e deve ser consultada durante execução.
