/**
 * Substitui o antigo Supabase Realtime do planning.
 *
 * Antes: subscription em `postgres_changes` da tabela `planning_items`
 * (filtrada por workspace_id) com reconexão exponencial.
 *
 * Agora: o hook `usePlanningItems` tem `refetchInterval: 15000` que já
 * cuida do polling. Esse hook era um setInterval duplicado que rodava
 * `invalidateQueries` em paralelo — gerando 2 refetches a cada ciclo
 * e causando "piscar" da UI (cada invalidate dispara nova fetch +
 * re-render do PlanningBoard, que retriggers o effect do `openItem`).
 *
 * Mantido como no-op pra não quebrar callers existentes (ex:
 * PlanningBoard.tsx linha 121). Pode ser removido em refactor futuro.
 */
export function usePlanningRealtime() {
  // No-op: refetchInterval em usePlanningItems já cobre o caso.
  // Ver commit "fix: remove poll duplicado do PlanningBoard"
}
