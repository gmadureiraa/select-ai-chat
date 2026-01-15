-- FASE 1: Remover tabelas não utilizadas

-- Remover tabelas de AI Agents/Workflows (não utilizadas)
DROP TABLE IF EXISTS public.ai_workflow_runs CASCADE;
DROP TABLE IF EXISTS public.ai_workflow_connections CASCADE;
DROP TABLE IF EXISTS public.ai_workflow_nodes CASCADE;
DROP TABLE IF EXISTS public.ai_workflows CASCADE;
DROP TABLE IF EXISTS public.ai_agents CASCADE;

-- Remover tabelas de Research Projects (não utilizadas)
DROP TABLE IF EXISTS public.research_connections CASCADE;
DROP TABLE IF EXISTS public.research_source_relations CASCADE;
DROP TABLE IF EXISTS public.research_findings CASCADE;
DROP TABLE IF EXISTS public.research_sources CASCADE;
DROP TABLE IF EXISTS public.research_notes CASCADE;
DROP TABLE IF EXISTS public.research_clusters CASCADE;
DROP TABLE IF EXISTS public.research_maps CASCADE;
DROP TABLE IF EXISTS public.research_projects CASCADE;

-- Remover tabela n8n (não utilizada)
DROP TABLE IF EXISTS public.workspace_n8n_credentials CASCADE;

-- Remover tabela workflow_templates (não utilizada)
DROP TABLE IF EXISTS public.workflow_templates CASCADE;