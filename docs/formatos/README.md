# 📚 Documentação de Formatos de Conteúdo

Este diretório contém guias completos para criação de cada formato de conteúdo suportado pelo sistema.

## 📋 Formatos Disponíveis

1. **[NEWSLETTER.md](./NEWSLETTER.md)** - Guia completo para criação de newsletters
2. **[TWEET.md](./TWEET.md)** - Guia completo para criação de tweets
3. **[THREAD.md](./THREAD.md)** - Guia completo para criação de threads no Twitter/X
4. **[LINKEDIN_POST.md](./LINKEDIN_POST.md)** - Guia completo para posts no LinkedIn
5. **[CARROSSEL.md](./CARROSSEL.md)** - Guia completo para carrosséis Instagram/LinkedIn
6. **[POST_INSTAGRAM.md](./POST_INSTAGRAM.md)** - Guia completo para posts estáticos Instagram
7. **[BLOG_POST.md](./BLOG_POST.md)** - Guia completo para blog posts
8. **[REELS_SHORT_VIDEO.md](./REELS_SHORT_VIDEO.md)** - Guia completo para roteiros de Reels/Shorts
9. **[LONG_VIDEO_YOUTUBE.md](./LONG_VIDEO_YOUTUBE.md)** - Guia completo para roteiros de vídeo longo (YouTube)
10. **[ARTIGO_X.md](./ARTIGO_X.md)** - Guia completo para artigos no X (Twitter)
11. **[STORIES.md](./STORIES.md)** - Guia completo para stories Instagram
12. **[EMAIL_MARKETING.md](./EMAIL_MARKETING.md)** - Guia completo para emails promocionais

---

## 🤖 Como os Agentes Devem Usar Esta Documentação

### Para o Content Writer Agent:

Quando o **Content Writer** recebe uma requisição para criar conteúdo de um formato específico, ele deve:

1. **Identificar o Formato**
   - Analisar a requisição do usuário
   - Detectar qual formato foi solicitado (newsletter, tweet, carrossel, etc)
   - Localizar o documento correspondente nesta pasta

2. **Ler o Documento Completo**
   - Estudar a estrutura obrigatória definida
   - Entender as regras de ouro específicas do formato
   - Revisar boas práticas e otimizações
   - Memorizar o checklist obrigatório

3. **Aplicar Estrutura e Regras**
   - Seguir **RIGOROSAMENTE** a estrutura obrigatória
   - Aplicar todas as regras de ouro definidas
   - Respeitar limites e especificações técnicas
   - Usar o formato de entrega exato

4. **Combinar com Identidade do Cliente**
   - **Estrutura** vem do documento de formato (esta pasta)
   - **Tom de voz** vem do `identity_guide` do cliente
   - **Estilo de escrita** vem do `copywriting_guide` do cliente
   - **Personalidade** vem do contexto do cliente

5. **Validar Antes de Entregar**
   - Usar checklist do formato para validar
   - Garantir que estrutura está correta
   - Verificar que regras foram seguidas
   - Confirmar que está pronto para publicar

### Exemplo Prático:

```
Requisição: "Crie uma newsletter sobre lançamento do produto X"

Fluxo do Content Writer:
1. Identifica: formato = newsletter
2. Lê: docs/formatos/NEWSLETTER.md
3. Aplica estrutura: ASSUNTO → PREVIEW TEXT → ABERTURA → CORPO → CTA → FECHAMENTO
4. Aplica tom de voz do cliente (do identity_guide)
5. Usa conteúdo library como referência de estilo
6. Valida usando checklist do documento
7. Entrega newsletter finalizada
```

---

## 📖 Estrutura dos Documentos de Formato

Cada documento de formato contém:

### 1. **Estrutura Obrigatória**
   - Elementos que DEVEM estar presentes
   - Ordem e hierarquia definida
   - Especificações técnicas

### 2. **Regras de Ouro**
   - Diretrizes fundamentais
   - O que SEMPRE fazer
   - O que NUNCA fazer

### 3. **Boas Práticas**
   - Otimizações para a plataforma
   - Melhores práticas da indústria
   - Dicas de engajamento

### 4. **Formato de Entrega**
   - Como o conteúdo deve ser estruturado
   - Formatação esperada
   - Elementos visuais (quando aplicável)

### 5. **Checklist Obrigatório**
   - Validação antes de entregar
   - Garantia de qualidade
   - Elementos críticos

### 6. **Erros Comuns a Evitar**
   - O que não fazer
   - Armadilhas comuns
   - Melhorias de qualidade

---

## ⚠️ Importante

### O que ESTES documentos fornecem:
- ✅ **Estrutura e formato** técnico
- ✅ **Boas práticas** da plataforma
- ✅ **Elementos obrigatórios** do formato
- ✅ **Otimização** para engajamento
- ✅ **Regras técnicas** específicas

### O que NÃO incluem (vem de outras fontes):
- ❌ Tom de voz do cliente → `identity_guide`
- ❌ Estilo de escrita → `copywriting_guide`
- ❌ Cores e identidade visual → `brand_assets`
- ❌ Personalidade da marca → contexto do cliente
- ❌ Tópicos e temas → requisição do usuário

---

## 🔄 Processo Completo de Criação

```
1. Usuário solicita: "Crie um tweet sobre X"
   ↓
2. Content Writer identifica formato: TWEET
   ↓
3. Content Writer lê: docs/formatos/TWEET.md
   ↓
4. Content Writer carrega contexto do cliente:
   - identity_guide (tom de voz)
   - content_library (estilo de referência)
   ↓
5. Content Writer cria conteúdo:
   - Aplica ESTRUTURA de TWEET.md
   - Aplica TOM DE VOZ do cliente
   - Usa ESTILO da content_library
   ↓
6. Content Writer valida usando checklist de TWEET.md
   ↓
7. Entrega tweet finalizado e pronto para publicar
```

---

## 📚 Documentação Relacionada

- **[Documentação dos Agentes](../agentes/README.md)** - Como cada agente deve agir
- **[Content Writer Agent](../agentes/CONTENT_WRITER.md)** - Agente principal que usa estes documentos

---

**Última atualização:** 31 de Dezembro de 2024
