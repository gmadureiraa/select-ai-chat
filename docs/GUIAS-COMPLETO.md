# 📖 Guias de Desenvolvimento - Completo

## Como Adicionar Página
1. Criar componente em `src/pages/`
2. Adicionar rota em `src/App.tsx`
3. Adicionar link na navegação (se aplicável)
4. Criar documentação em `docs/estrutura/paginas/`

**Passos detalhados:**
1. Criar componente em `src/pages/[NomePage].tsx`
2. Adicionar rota em `src/App.tsx` (ex: `<Route path="/nova-pagina" element={<NovaPage />} />`)
3. Adicionar link na navegação se necessário (sidebar, header, etc)
4. Seguir padrões de design (ver DESIGN-SYSTEM-COMPLETO.md)

---

## Como Adicionar Componente
1. Criar componente em `src/components/[categoria]/[NomeComponent].tsx`
2. Usar componentes base do shadcn/ui (Button, Card, Input, etc)
3. Seguir padrões de design (ver DESIGN-SYSTEM-COMPLETO.md)
4. Exportar do index se necessário

**Exemplo:**
- `src/components/kai/GradientHero.tsx`
- `src/components/performance/StatCard.tsx`

---

## Como Adicionar Formato
1. Criar documento em `docs/formatos/[NOME].md`
2. Atualizar `docs/formatos/README.md` (adicionar entrada)
3. Adicionar tipo em tipos TypeScript (se necessário)
4. Atualizar agentes se necessário (system prompts)

**Formato:** Seguir estrutura dos formatos existentes (NEWSLETTER.md, TWEET.md, etc)

---

## Como Adicionar Agente
1. Criar documento em `docs/agentes/[NOME].md`
2. Atualizar `docs/agentes/README.md` (adicionar entrada)
3. Implementar lógica no backend (`supabase/functions/execute-agent/index.ts`)
4. Adicionar system prompt do agente no código

**Estrutura:** Seguir CONTENT_WRITER.md como exemplo
