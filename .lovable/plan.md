# Plano: Corrigir Geração de Conteúdo no kAI Chat

## ✅ IMPLEMENTADO

### Correção 1: Passar modo do seletor para FloatingInput ✅
- Adicionada prop `selectedMode` ao `FloatingInput`
- `KaiAssistantTab` agora passa `chatMode` para o input
- Lógica atualizada: citações têm prioridade, depois modo selecionado

### Correção 2: Modo "content" SEMPRE usa unified-content-api ✅
- Adicionada verificação `isExplicitContentMode = explicitMode === "content"`
- `shouldUseMultiAgent` agora inclui modo content explícito

### Correção 3: Melhorar detecção de formato ✅
- `detectContentType` expandido com padrões de linguagem natural:
  - "conteúdo de linkedin" → `linkedin_post`
  - "gere um post linkedin" → `linkedin_post`
  - "cria um carrossel" → `carousel`
  - Etc.

---

## Fluxo Corrigido

Quando usuário está em modo **Conteúdo** e digita "Gere um conteúdo de LinkedIn para mim":

```
1. FloatingInput recebe selectedMode = "content" (do ModeSelector)
2. Sem citações de formato → usa selectedMode
3. effectiveMode = "content"
4. quality = "high" (modo content sempre usa alta qualidade)
5. useClientChat recebe explicitMode = "content"
6. isExplicitContentMode = true
7. shouldUseMultiAgent = true
8. Chama unified-content-api com:
   - format: "linkedin_post" (detectado do texto via detectContentType melhorado)
   - brief: "Gere um conteúdo de LinkedIn para mim"
9. Resposta é parseada e exibida com SourcesBadge e MessageFeedback
```

---

## Resultado Esperado

**Entrada:** "Gere um conteúdo de linkedin para mim" (modo Conteúdo selecionado)

**Saída:**
```
📚 Fontes: Guia de Identidade • 2 itens biblioteca

[Gancho de 1 linha - aparece antes do "ver mais"]

[Espaço]

[Parágrafo 1 - Contexto ou história baseada no cliente]

[Espaço]

[Parágrafos 2-4 - Desenvolvimento com insights]

[Espaço]

[CTA: Pergunta que gera comentários]

---
💡 Ideia de imagem:
[Descrição visual relacionada ao tema]

✓ Validado automaticamente

👍 Usar │ ✏️ Editar │ ↻ Refazer │ 📌 Salvar
```
