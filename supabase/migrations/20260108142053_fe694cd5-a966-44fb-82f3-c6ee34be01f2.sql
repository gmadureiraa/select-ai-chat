-- Corrigir políticas RLS permissivas

-- 1. Notifications: A política atual permite INSERT com "true"
-- Isso é usado pelo sistema, mas deve ser mais restritivo
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Criar política que permite INSERT apenas para usuários autenticados inserindo notificações para si mesmos
-- ou via service role (sistema)
CREATE POLICY "Users can receive notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Planning Item Versions: A política atual permite INSERT com "true"  
-- Isso também deve ser restrito ao dono do planning item
DROP POLICY IF EXISTS "System can create versions" ON public.planning_item_versions;

-- Criar função security definer para verificar se usuário tem acesso ao planning item
CREATE OR REPLACE FUNCTION public.can_access_planning_item(_planning_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.planning_items pi
    INNER JOIN public.workspace_members wm ON wm.workspace_id = pi.workspace_id
    WHERE pi.id = _planning_item_id
      AND wm.user_id = auth.uid()
  )
$$;

-- Criar política que permite INSERT apenas para membros do workspace
CREATE POLICY "Workspace members can create versions" 
ON public.planning_item_versions 
FOR INSERT 
TO authenticated
WITH CHECK (public.can_access_planning_item(planning_item_id));