-- Create workflow templates table
CREATE TABLE public.workflow_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT NOT NULL DEFAULT 'content',
  thumbnail_url TEXT,
  workflow_config JSONB NOT NULL DEFAULT '{}',
  nodes JSONB NOT NULL DEFAULT '[]',
  connections JSONB NOT NULL DEFAULT '[]',
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read templates (they are global)
CREATE POLICY "Workflow templates are readable by all" 
ON public.workflow_templates 
FOR SELECT 
USING (true);

-- Insert pre-configured templates
INSERT INTO public.workflow_templates (name, description, icon, category, is_featured, workflow_config, nodes, connections) VALUES
(
  'Newsletter Semanal',
  'Pipeline completo para criação de newsletters semanais automatizadas com curadoria de conteúdo e revisão',
  '📧',
  'content',
  true,
  '{"trigger_type": "schedule", "schedule": "0 9 * * 1"}',
  '[
    {"id": "trigger-1", "type": "trigger", "position": {"x": 100, "y": 200}, "config": {"trigger_type": "schedule", "description": "Segunda-feira às 9h"}},
    {"id": "agent-curator", "type": "agent", "position": {"x": 350, "y": 100}, "config": {"name": "Curador de Notícias", "description": "Coleta e filtra as melhores notícias da semana", "system_prompt": "Você é um curador especializado. Analise as principais notícias e tendências da semana relacionadas ao nicho do cliente. Selecione 5-7 tópicos mais relevantes com breve resumo de cada."}},
    {"id": "agent-writer", "type": "agent", "position": {"x": 600, "y": 200}, "config": {"name": "Redator de Newsletter", "description": "Escreve o conteúdo da newsletter", "system_prompt": "Você é um redator expert em newsletters. Transforme os tópicos curados em uma newsletter envolvente e informativa, mantendo o tom e estilo do cliente."}},
    {"id": "agent-reviewer", "type": "agent", "position": {"x": 850, "y": 200}, "config": {"name": "Revisor de Qualidade", "description": "Revisa gramática, tom e qualidade", "system_prompt": "Você é um revisor meticuloso. Revise a newsletter para erros gramaticais, consistência de tom e qualidade geral. Sugira melhorias quando necessário."}}
  ]'::jsonb,
  '[
    {"source": "trigger-1", "target": "agent-curator"},
    {"source": "agent-curator", "target": "agent-writer"},
    {"source": "agent-writer", "target": "agent-reviewer"}
  ]'::jsonb
),
(
  'Carrossel Viral',
  'Crie carrosséis de alta performance com hooks magnéticos e estrutura otimizada para engajamento',
  '🎠',
  'content',
  true,
  '{"trigger_type": "manual"}',
  '[
    {"id": "trigger-1", "type": "trigger", "position": {"x": 100, "y": 200}, "config": {"trigger_type": "manual", "description": "Disparado manualmente"}},
    {"id": "agent-researcher", "type": "agent", "position": {"x": 350, "y": 100}, "config": {"name": "Pesquisador de Tendências", "description": "Identifica temas virais e ângulos únicos", "system_prompt": "Analise tendências atuais e identifique ângulos únicos para carrosséis. Foque em temas que geram alto engajamento e compartilhamentos."}},
    {"id": "agent-hook", "type": "agent", "position": {"x": 350, "y": 300}, "config": {"name": "Especialista em Hooks", "description": "Cria hooks irresistíveis para a primeira página", "system_prompt": "Você é especialista em criar hooks que param o scroll. Gere 3 opções de primeira página com diferentes abordagens: curiosidade, polêmica ou valor direto."}},
    {"id": "agent-content", "type": "agent", "position": {"x": 600, "y": 200}, "config": {"name": "Criador de Conteúdo", "description": "Desenvolve as páginas do carrossel", "system_prompt": "Crie o conteúdo completo do carrossel seguindo as regras: uma ideia por página, frases curtas, hierarquia visual clara, e CTA estratégico no final."}},
    {"id": "agent-optimizer", "type": "agent", "position": {"x": 850, "y": 200}, "config": {"name": "Otimizador de Engajamento", "description": "Otimiza para máximo alcance", "system_prompt": "Revise o carrossel e otimize para engajamento: adicione perguntas retóricas, CTAs intermediários, e garanta que cada slide tenha um cliffhanger para o próximo."}}
  ]'::jsonb,
  '[
    {"source": "trigger-1", "target": "agent-researcher"},
    {"source": "trigger-1", "target": "agent-hook"},
    {"source": "agent-researcher", "target": "agent-content"},
    {"source": "agent-hook", "target": "agent-content"},
    {"source": "agent-content", "target": "agent-optimizer"}
  ]'::jsonb
),
(
  'Thread Viral',
  'Estruture threads que geram milhares de impressões com técnicas de storytelling e retenção',
  '🧵',
  'content',
  true,
  '{"trigger_type": "manual"}',
  '[
    {"id": "trigger-1", "type": "trigger", "position": {"x": 100, "y": 200}, "config": {"trigger_type": "manual", "description": "Disparado manualmente"}},
    {"id": "agent-angle", "type": "agent", "position": {"x": 350, "y": 200}, "config": {"name": "Definidor de Ângulo", "description": "Define o ângulo único e contrário", "system_prompt": "Identifique um ângulo único e potencialmente contrário para o tema. Threads virais desafiam o senso comum ou revelam verdades pouco conhecidas."}},
    {"id": "agent-structure", "type": "agent", "position": {"x": 600, "y": 100}, "config": {"name": "Arquiteto de Thread", "description": "Estrutura os tweets para máxima retenção", "system_prompt": "Estruture a thread com: 1) Tweet de abertura explosivo, 2) Promessa clara, 3) Desenvolvimento com cliff-hangers, 4) Provas e exemplos, 5) Conclusão memorável, 6) CTA de engajamento."}},
    {"id": "agent-writer", "type": "agent", "position": {"x": 600, "y": 300}, "config": {"name": "Redator de Threads", "description": "Escreve cada tweet com precisão", "system_prompt": "Escreva cada tweet da thread com máximo 280 caracteres. Use linguagem direta, números específicos, e termine cada tweet com curiosidade para o próximo."}},
    {"id": "agent-polish", "type": "agent", "position": {"x": 850, "y": 200}, "config": {"name": "Polidor Final", "description": "Refina para perfeição viral", "system_prompt": "Refine a thread: remova palavras desnecessárias, intensifique os ganchos, adicione espaçamento estratégico e emojis sutis. Garanta que o tweet 1 seja irresistível."}}
  ]'::jsonb,
  '[
    {"source": "trigger-1", "target": "agent-angle"},
    {"source": "agent-angle", "target": "agent-structure"},
    {"source": "agent-angle", "target": "agent-writer"},
    {"source": "agent-structure", "target": "agent-polish"},
    {"source": "agent-writer", "target": "agent-polish"}
  ]'::jsonb
),
(
  'Repurpose de Vídeo',
  'Transforme um vídeo longo em múltiplos formatos: shorts, carrosséis, threads e posts',
  '🎬',
  'repurpose',
  true,
  '{"trigger_type": "manual"}',
  '[
    {"id": "trigger-1", "type": "trigger", "position": {"x": 100, "y": 250}, "config": {"trigger_type": "manual", "description": "Upload de vídeo ou transcrição"}},
    {"id": "agent-analyzer", "type": "agent", "position": {"x": 350, "y": 250}, "config": {"name": "Analisador de Vídeo", "description": "Extrai insights e momentos-chave", "system_prompt": "Analise a transcrição do vídeo e identifique: 1) Principais insights, 2) Momentos de maior valor, 3) Frases quotáveis, 4) Histórias contadas, 5) Dicas práticas."}},
    {"id": "agent-shorts", "type": "agent", "position": {"x": 600, "y": 100}, "config": {"name": "Criador de Shorts", "description": "Transforma em roteiros de 60s", "system_prompt": "Crie 3-5 roteiros de shorts/reels de 60 segundos baseados nos melhores momentos. Cada roteiro deve ter: hook forte, desenvolvimento rápido, e CTA."}},
    {"id": "agent-carousel", "type": "agent", "position": {"x": 600, "y": 250}, "config": {"name": "Criador de Carrosséis", "description": "Transforma em carrosséis visuais", "system_prompt": "Crie 2-3 carrosséis de 7-10 slides baseados nos principais insights. Siga estrutura: hook visual, desenvolvimento, exemplos, conclusão, CTA."}},
    {"id": "agent-thread", "type": "agent", "position": {"x": 600, "y": 400}, "config": {"name": "Criador de Threads", "description": "Transforma em threads do Twitter", "system_prompt": "Crie uma thread de 10-15 tweets resumindo os principais pontos do vídeo. Mantenha estrutura de retenção e engajamento."}}
  ]'::jsonb,
  '[
    {"source": "trigger-1", "target": "agent-analyzer"},
    {"source": "agent-analyzer", "target": "agent-shorts"},
    {"source": "agent-analyzer", "target": "agent-carousel"},
    {"source": "agent-analyzer", "target": "agent-thread"}
  ]'::jsonb
),
(
  'Análise de Concorrentes',
  'Monitore e analise conteúdos de concorrentes para identificar oportunidades e tendências',
  '🔍',
  'research',
  false,
  '{"trigger_type": "webhook"}',
  '[
    {"id": "trigger-1", "type": "trigger", "position": {"x": 100, "y": 200}, "config": {"trigger_type": "webhook", "description": "Recebe URL de conteúdo concorrente"}},
    {"id": "agent-scraper", "type": "agent", "position": {"x": 350, "y": 200}, "config": {"name": "Extrator de Conteúdo", "description": "Extrai e estrutura o conteúdo", "system_prompt": "Extraia e estruture todo o conteúdo: texto, estrutura, CTAs, hashtags, menções. Preserve formatação e elementos visuais descritos."}},
    {"id": "agent-analyzer", "type": "agent", "position": {"x": 600, "y": 100}, "config": {"name": "Analisador Estratégico", "description": "Analisa táticas e padrões", "system_prompt": "Analise o conteúdo identificando: 1) Táticas de engajamento, 2) Estrutura de copy, 3) Gatilhos emocionais, 4) Pontos fortes e fracos."}},
    {"id": "agent-opportunity", "type": "agent", "position": {"x": 600, "y": 300}, "config": {"name": "Identificador de Oportunidades", "description": "Encontra gaps e oportunidades", "system_prompt": "Baseado na análise, identifique: 1) O que podemos fazer melhor, 2) Ângulos não explorados, 3) Oportunidades de diferenciação, 4) Sugestões de conteúdo superior."}},
    {"id": "agent-report", "type": "agent", "position": {"x": 850, "y": 200}, "config": {"name": "Gerador de Relatório", "description": "Compila relatório executivo", "system_prompt": "Compile um relatório executivo com: análise do concorrente, pontos fortes/fracos identificados, oportunidades encontradas, e recomendações de ação."}}
  ]'::jsonb,
  '[
    {"source": "trigger-1", "target": "agent-scraper"},
    {"source": "agent-scraper", "target": "agent-analyzer"},
    {"source": "agent-scraper", "target": "agent-opportunity"},
    {"source": "agent-analyzer", "target": "agent-report"},
    {"source": "agent-opportunity", "target": "agent-report"}
  ]'::jsonb
);

-- Create trigger for updated_at
CREATE TRIGGER update_workflow_templates_updated_at
BEFORE UPDATE ON public.workflow_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();