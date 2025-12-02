ALTER TABLE public.research_items DROP CONSTRAINT IF EXISTS research_items_type_check;

ALTER TABLE public.research_items
ADD CONSTRAINT research_items_type_check
CHECK (
  type = ANY (
    ARRAY[
      'youtube'::text,
      'image'::text,
      'audio'::text,
      'text'::text,
      'link'::text,
      'pdf'::text,
      'note'::text,
      'ai_chat'::text,
      'content_library'::text,
      'reference_library'::text,
      'grok_search'::text
    ]
  )
);