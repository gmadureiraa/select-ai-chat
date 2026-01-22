# 📋 RESUMO EXECUTIVO — SELECT AI CHAT (KAI)

## 🎯 O que é o app?
O **Select AI Chat (KAI)** é uma plataforma SaaS para criação e operação de conteúdo assistida por IA, com:
- Canvas visual (ReactFlow) para criação/geração
- Multi-cliente / workspaces
- Planejamento (Kanban)
- Biblioteca e referências
- Edge Functions (Supabase) para extração/geração/análise

## ✅ Status (agora)
### O que está bom
- **Stack moderna**: React 18 + TypeScript + Vite + Supabase
- **Feature set forte** (canvas/planejamento/biblioteca)
- **Infra Supabase** já estruturada (RLS + edge functions)

### O que é crítico melhorar (alto impacto)
- **TypeScript “frouxo”**: `noImplicitAny: false`, `strictNullChecks: false` (`tsconfig.json`)
- **Logs em produção**: há dezenas de `console.*` no `src/`
- **Error Boundary não aplicado globalmente**: existe `src/components/ui/error-boundary.tsx`, mas o app não está “wrapado” no root
- **Bundle/perf**: `vite.config.ts` não tem `build.rollupOptions`/splitting explícito; oportunidades fortes de code-splitting
- **Testes**: Playwright existe, mas cobertura unitária/integração não está estruturada como “gate” de PR

---

## ✅ O que já entregamos (PRs prontos no GitHub)
Este bloco é o “trabalho já feito” na linha principal do problema do Canvas: **qualidade de geração** (regras de formato + consistência + redução de prompt bloat).

### Série Canvas (stacked — merge em ordem)
1. **PR0**: melhorar qualidade do Canvas (formatos + regras fortes + prompt hygiene)  
2. **PR1**: format registry no frontend (padroniza/normaliza formatos)  
3. **PR2**: correção de formato no `kai-content-agent` (`reel_script → reels`)  
4. **PR3**: unificar parsing SSE via `callKaiContentAgent` (reduz duplicação)  
5. **PR4**: desacoplar persistência do `useCanvasState` usando `useCanvasPersistence`  
6. **PR5**: unificar parsing SSE também no `useCanvasState`  
7. **PR7**: `GeneratorNode` texto via `kai-content-agent` (pipeline unificado)  
8. **PR8**: service único `generateCanvasText()` (um caminho consistente para geração de texto)

### Dependências (independente)
- **PR6**: corrigir conflito `date-fns` × `react-day-picker` para `npm ci` rodar sem flags

### Documentos
- `docs/CANVAS-AUDIT.md`: diagnóstico técnico do Canvas e plano de correção (evidência + ações)

---

## 🔴 Principais riscos de produto (se nada for feito)
- **Tela branca / crash** em erro de render (sem Error Boundary no root)
- **Bugs silenciosos** por TypeScript não-strict (null/any escapando)
- **Regressões frequentes** (sem suite mínima de testes como gate)
- **Carregamento lento** em mobile/rede ruim (bundle grande / falta de splitting)

---

## 🚀 Próximas recomendações (priorizadas)

## Fase A — Rápido e muito impactante (1–3 dias)
1. **Aplicar Error Boundary global** no `src/main.tsx` (envolver `<App />`)
2. **Padronizar logs**:
   - Remover `console.log`/`debug` em produção
   - Trocar por logger com níveis (ou gating por `import.meta.env.DEV`)
3. **Vulnerabilidades**:
   - Rodar `npm audit` e tratar o que for real exploitable (sem `--force` cego)

## Fase B — Base sólida (1–2 semanas)
1. **TypeScript strict por etapas**:
   - habilitar `strictNullChecks` primeiro (com lint/CI)
   - depois `noImplicitAny`
   - migrar por “áreas” (Canvas, Planning, Chat, etc.)
2. **Refatoração dos maiores arquivos**:
   - decompor `ContentCanvas.tsx`
   - manter `useCanvasState` como “orchestrator” e mover regras para hooks/services (já começamos com PR4/PR8)

## Fase C — Performance (1 semana)
1. **Code splitting**:
   - Lazy-load de páginas pesadas (`Kai`, dashboards, modais grandes)
   - `vite.config.ts` com `build.rollupOptions.output.manualChunks` (reactflow, recharts, framer-motion)
2. **Otimização de render**:
   - memoização pontual e virtualização de listas/tabelas

## Fase D — Testes e segurança (2–4 semanas)
1. **Vitest + React Testing Library** (smoke tests e hooks críticos)
2. **Playwright E2E** focado em fluxos “dinheiro” (login, workspace, canvas gerar conteúdo, planning)
3. **Hardening**:
   - sanitização de inputs (XSS)
   - rate limiting nas Edge Functions expostas
   - observabilidade (Sentry ou equivalente)

---

## ✅ Próximo passo recomendado (objetivo)
Se você quiser “estabilizar para produção” rápido, a melhor sequência é:
1) **Merge PR6** (deps)  
2) **Merge PR0 → PR1 → PR2 → PR3 → PR4 → PR5 → PR7 → PR8** (canvas)  
3) Abrir PR adicional: **Error Boundary global** + **cleanup de console** + **primeiro passo de TS strict**

---

## 📌 Apêndice: referências técnicas
- `tsconfig.json`: atualmente não-strict (risco)
- `src/components/ui/error-boundary.tsx`: existe, mas falta uso no root
- Canvas: `src/components/kai/canvas/**`
- Edge functions: `supabase/functions/**`

