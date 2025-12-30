-- Atualizar RLS policy de planning_items para usar is_workspace_member
DROP POLICY IF EXISTS "Workspace members can create planning items" ON planning_items;

CREATE POLICY "Workspace members can create planning items" ON planning_items
FOR INSERT WITH CHECK (
  is_workspace_member(auth.uid(), workspace_id) AND can_modify_data(auth.uid())
);