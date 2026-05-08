/**
 * Bridge: viral-sv-original → KAI integration.
 *
 * O standalone usa um client Supabase próprio (process.env.NEXT_PUBLIC_*),
 * o KAI usa Neon Auth/Data API atrás de `ClientWithNeonAuth`. A interface
 * de runtime é a mesma (`from`, `auth`, `storage`), mas os tipos diferem
 * — fazemos o cast pra `SupabaseClient` aqui pra silenciar TS strict
 * em todos os 50+ call-sites das pages copiadas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as kaiSupabase } from "@/integrations/supabase/client";

export const supabase = kaiSupabase as unknown as SupabaseClient | null;
