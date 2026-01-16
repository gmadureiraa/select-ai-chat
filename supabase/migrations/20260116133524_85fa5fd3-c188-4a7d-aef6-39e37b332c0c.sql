-- Fase 2.2: Corrigir a policy de INSERT em clients para usar EXISTS direto
-- (evitar dependência de função que pode ter problemas de contexto RLS)

-- Remover a policy atual de INSERT
DROP POLICY IF EXISTS "Users can create clients in their workspace" ON public.clients;

-- Criar nova policy de INSERT com checagem direta (sem função)
CREATE POLICY "Users can create clients in their workspace" 
ON public.clients 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    -- Usuário é membro do workspace
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = clients.workspace_id
      AND wm.user_id = auth.uid()
    )
    OR
    -- Usuário é owner do workspace
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = clients.workspace_id
      AND w.owner_id = auth.uid()
    )
  )
);