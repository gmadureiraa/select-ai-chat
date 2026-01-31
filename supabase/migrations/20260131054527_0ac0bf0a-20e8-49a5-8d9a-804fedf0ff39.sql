-- Add image generation fields to planning_automations
ALTER TABLE planning_automations 
ADD COLUMN IF NOT EXISTS auto_generate_image boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS image_prompt_template text,
ADD COLUMN IF NOT EXISTS image_style text DEFAULT 'photographic';

-- Add comment for documentation
COMMENT ON COLUMN planning_automations.auto_generate_image IS 'If true, generates image automatically using generate-content-v2';
COMMENT ON COLUMN planning_automations.image_prompt_template IS 'Separate briefing for image generation, supports {{title}}, {{content}}, {{time_of_day}} variables';
COMMENT ON COLUMN planning_automations.image_style IS 'Visual style: photographic, illustration, minimalist, vibrant';