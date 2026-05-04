-- 1) Desativar envio de emails de notificação (Telegram + in-app são suficientes)
DROP TRIGGER IF EXISTS trigger_enqueue_notification_email ON public.notifications;

-- Limpa fila pendente para parar emails que estão travados pra envio
DELETE FROM public.email_notification_queue WHERE sent_at IS NULL;

-- 2) Criar automações para o canal D-Sec Labs (YouTube channel UC-pYi1BmNWybAoE14Xu5O0g)
-- LinkedIn: Novo Vídeo YouTube
INSERT INTO public.planning_automations (
  workspace_id, client_id, name, is_active, trigger_type, trigger_config,
  platform, content_type, auto_generate_content, auto_publish, prompt_template
)
SELECT 
  c.workspace_id,
  c.id,
  'LinkedIn — Novo Vídeo D-Sec',
  true,
  'rss',
  jsonb_build_object(
    'url', 'https://www.youtube.com/feeds/videos.xml?channel_id=UC-pYi1BmNWybAoE14Xu5O0g',
    'last_guid', null,
    'last_checked', null
  ),
  'linkedin',
  'social_post',
  true,
  true,
  E'Você é o social media da D-Sec Labs (cybersecurity / red team / pentest). Acabou de sair um novo vídeo no canal do YouTube.\n\nO vídeo foi TRANSCRITO abaixo no contexto. Use a transcrição para entender o conteúdo real e criar um post de LinkedIn técnico e relevante.\n\nTítulo do vídeo: {{title}}\nLink: {{link}}\n\nINSTRUÇÕES:\n1. Comece com um gancho técnico real do vídeo (uma vulnerabilidade, técnica, achado, dado) — NÃO comece com "Acabou de sair" ou "Novo vídeo".\n2. Desenvolva 3-5 linhas explicando o insight principal de forma acessível para profissionais de segurança.\n3. Termine com CTA natural para assistir o vídeo completo + link.\n4. Tom: técnico, direto, sem jargão exagerado, sem hype. Profissional de segurança falando para profissionais.\n5. NÃO use hashtags. NÃO use emojis. NÃO use markdown.\n\nResponda APENAS com o texto final do post.'
FROM public.clients c
WHERE c.name ILIKE '%dsec%'
LIMIT 1;

-- Twitter/X: Novo Vídeo YouTube
INSERT INTO public.planning_automations (
  workspace_id, client_id, name, is_active, trigger_type, trigger_config,
  platform, content_type, auto_generate_content, auto_publish, prompt_template
)
SELECT 
  c.workspace_id,
  c.id,
  'Tweet — Novo Vídeo D-Sec',
  true,
  'rss',
  jsonb_build_object(
    'url', 'https://www.youtube.com/feeds/videos.xml?channel_id=UC-pYi1BmNWybAoE14Xu5O0g',
    'last_guid', null,
    'last_checked', null
  ),
  'twitter',
  'tweet',
  true,
  true,
  E'Você é o social media da D-Sec Labs (cybersecurity / red team / pentest). Acabou de sair um novo vídeo no canal do YouTube.\n\nO vídeo foi TRANSCRITO abaixo no contexto. Use a transcrição para entender o conteúdo real do vídeo.\n\nCrie UM ÚNICO tweet curto (máx 250 caracteres) que:\n- Resuma o ponto técnico principal do vídeo de forma instigante\n- Gere curiosidade para assistir\n- NÃO use hashtags\n- NÃO use emojis\n- NÃO diga "link na bio"\n- O link do vídeo DEVE estar no final do tweet: {{link}}\n- Tom: técnico, direto, sem hype, expert em segurança ofensiva\n\nIMPORTANTE: Responda APENAS com o texto do tweet. Sem rótulos, sem "TWEET:", sem markdown.'
FROM public.clients c
WHERE c.name ILIKE '%dsec%'
LIMIT 1;