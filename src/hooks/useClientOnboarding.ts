import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { blobStorage } from "@/integrations/storage/blob-client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { apiInvoke } from "@/lib/apiInvoke";
import { trackEvent } from "@/lib/analytics";

/**
 * Estrutura completa de dados coletada pelo wizard de onboarding (5 steps).
 * Mantida flat e serializável — fácil de persistir em estado / sessionStorage
 * e enviar pro backend em uma única transação lógica.
 */
export interface OnboardingData {
  // Step 1 — briefing básico
  name: string;
  industry?: string;
  description?: string;
  website?: string;
  /** Saída crua de analyze-client-onboarding (se rodado no Step 1). */
  aiAnalysis?: Record<string, unknown> | null;

  // Step 2 — persona / voz
  tone?: "formal" | "informal" | "tecnico" | "casual" | "";
  pillars?: string[];
  brandDo?: string;
  brandDont?: string;
  personaAge?: string;
  personaPain?: string;
  personaGoal?: string;

  // Step 3 — redes sociais (handles, sem OAuth)
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  threads?: string;

  // Step 4 — referências
  /** Arquivos pendentes de upload (PDFs/images). */
  files?: File[];
  /** Marcas que admiram, uma por linha. */
  inspirations?: string[];
  /** Concorrentes principais, uma por linha. */
  competitors?: string[];
}

export interface CreatedClient {
  id: string;
  name: string;
}

/**
 * Hook que orquestra a criação completa de um novo cliente a partir do wizard
 * de onboarding. Faz tudo numa única mutation pra simplificar UX e tratamento
 * de erro — falhas parciais (ex: upload de doc) NÃO desfazem o cliente, mas
 * são logadas e reportadas no toast final.
 */
export function useClientOnboarding() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  const [progress, setProgress] = useState<string>("");

  const createClient = useMutation<CreatedClient, Error, OnboardingData>({
    mutationFn: async (data) => {
      if (!workspace?.id) {
        throw new Error("Você não está em nenhum workspace");
      }

      const { data: userResult, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userResult?.user?.id) {
        throw new Error("Você precisa estar logado para criar perfis");
      }
      const userId = userResult.user.id;

      // 1. Insert client
      setProgress("Criando perfil...");

      const socialMedia: Record<string, string> = {};
      if (data.instagram) socialMedia.instagram = data.instagram;
      if (data.linkedin) socialMedia.linkedin = data.linkedin;
      if (data.twitter) socialMedia.twitter = data.twitter;
      if (data.youtube) socialMedia.youtube = data.youtube;
      if (data.tiktok) socialMedia.tiktok = data.tiktok;
      if (data.threads) socialMedia.threads = data.threads;
      if (data.website) socialMedia.website = data.website;

      const tags: Record<string, string> = {};
      if (data.industry) tags.segment = data.industry;
      if (data.tone) tags.tone = data.tone;

      const insertPayload: Record<string, unknown> = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        context_notes: null,
        user_id: userId,
        workspace_id: workspace.id,
        social_media: socialMedia,
        tags,
        function_templates: [],
      };
      if (data.aiAnalysis) {
        // Garante serialização limpa (sem undefined / refs cíclicas).
        insertPayload.ai_analysis = JSON.parse(JSON.stringify(data.aiAnalysis));
      }

      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .insert(insertPayload as any)
        .select()
        .single();

      if (clientErr || !client) {
        throw new Error(
          clientErr?.message || "Não foi possível criar o cliente"
        );
      }

      const clientId = client.id;
      const warnings: string[] = [];

      // 2. Insert preferences (persona / voz)
      setProgress("Salvando persona e voz...");
      try {
        const prefsRows: Array<{
          client_id: string;
          preference_type: string;
          preference_value: string;
        }> = [];

        if (data.tone) {
          prefsRows.push({
            client_id: clientId,
            preference_type: "tone",
            preference_value: data.tone,
          });
        }
        if (data.pillars && data.pillars.length > 0) {
          prefsRows.push({
            client_id: clientId,
            preference_type: "content_pillars",
            preference_value: data.pillars.join(", "),
          });
        }
        if (data.brandDo) {
          prefsRows.push({
            client_id: clientId,
            preference_type: "brand_do",
            preference_value: data.brandDo,
          });
        }
        if (data.brandDont) {
          prefsRows.push({
            client_id: clientId,
            preference_type: "brand_dont",
            preference_value: data.brandDont,
          });
        }
        if (data.personaAge) {
          prefsRows.push({
            client_id: clientId,
            preference_type: "persona_age",
            preference_value: data.personaAge,
          });
        }
        if (data.personaPain) {
          prefsRows.push({
            client_id: clientId,
            preference_type: "persona_pain",
            preference_value: data.personaPain,
          });
        }
        if (data.personaGoal) {
          prefsRows.push({
            client_id: clientId,
            preference_type: "persona_goal",
            preference_value: data.personaGoal,
          });
        }

        if (prefsRows.length > 0) {
          const { error: prefsErr } = await supabase
            .from("client_preferences")
            .insert(prefsRows as any);
          if (prefsErr) {
            console.warn("[useClientOnboarding] preferences error:", prefsErr);
            warnings.push("Algumas preferências não foram salvas");
          }
        }
      } catch (err) {
        console.warn("[useClientOnboarding] preferences failed:", err);
        warnings.push("Falha ao salvar preferências");
      }

      // 3. Insert websites (delega scrape via edge function — fire-and-log)
      if (data.website) {
        setProgress("Adicionando website...");
        try {
          await apiInvoke("scrape-website", {
            body: { url: data.website, clientId },
          });
        } catch (err) {
          console.warn("[useClientOnboarding] scrape-website failed:", err);
          // não bloqueia — site pode ser re-scrapeado depois pela UI de edição
          warnings.push("Website não pôde ser analisado agora");
        }
      }

      // 4. Insert visual references (inspirations + competitors como referências textuais)
      const refRows: Array<{
        client_id: string;
        reference_type: string;
        title: string;
        content: string;
      }> = [];
      for (const insp of data.inspirations || []) {
        const v = insp.trim();
        if (v) {
          refRows.push({
            client_id: clientId,
            reference_type: "inspiration",
            title: v,
            content: `Marca de referência mencionada no onboarding: ${v}`,
          });
        }
      }
      for (const comp of data.competitors || []) {
        const v = comp.trim();
        if (v) {
          refRows.push({
            client_id: clientId,
            reference_type: "competitor",
            title: v,
            content: `Concorrente mencionado no onboarding: ${v}`,
          });
        }
      }

      if (refRows.length > 0) {
        setProgress("Salvando referências...");
        try {
          const { error: refErr } = await supabase
            .from("client_reference_library")
            .insert(refRows as any);
          if (refErr) {
            console.warn(
              "[useClientOnboarding] reference_library error:",
              refErr
            );
            warnings.push("Algumas referências não foram salvas");
          }
        } catch (err) {
          console.warn("[useClientOnboarding] reference_library failed:", err);
          warnings.push("Falha ao salvar referências");
        }
      }

      // 5. Upload documents
      const files = data.files || [];
      if (files.length > 0) {
        setProgress(`Enviando ${files.length} arquivo(s)...`);
        for (const file of files) {
          try {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const fileName = `${clientId}/${Date.now()}_${safeName}`;
            const { error: uploadErr } = await blobStorage
              .from("client-files")
              .upload(fileName, file);

            if (uploadErr) {
              console.warn(
                `[useClientOnboarding] upload failed for ${file.name}:`,
                uploadErr
              );
              warnings.push(`Falha ao enviar ${file.name}`);
              continue;
            }

            const { error: docErr } = await supabase
              .from("client_documents")
              .insert({
                client_id: clientId,
                name: file.name,
                file_type: file.type || "application/octet-stream",
                file_path: fileName,
              } as any);

            if (docErr) {
              console.warn(
                `[useClientOnboarding] doc record failed for ${file.name}:`,
                docErr
              );
              warnings.push(`Metadado de ${file.name} não foi salvo`);
            }
          } catch (err) {
            console.warn(
              `[useClientOnboarding] file loop error for ${file.name}:`,
              err
            );
            warnings.push(`Erro inesperado em ${file.name}`);
          }
        }
      }

      // 6. Importar últimos posts dos handles cadastrados pra biblioteca
      // (fire-and-forget — pode levar 60-180s e roda em background)
      const hasAnyHandle =
        data.instagram ||
        data.linkedin ||
        data.twitter ||
        data.tiktok ||
        data.threads;
      if (hasAnyHandle) {
        setProgress("Iniciando importação de posts em background...");
        // Não await — Vercel function runa até maxDuration mesmo após response
        apiInvoke("import-client-social-content", {
          body: { clientId, postsPerPlatform: 30 },
        }).catch((err) => {
          console.warn(
            "[useClientOnboarding] import-client-social-content (bg) failed:",
            err,
          );
        });
      }

      setProgress("Finalizando...");

      if (warnings.length > 0) {
        // Toast info — cliente foi criado mas com avisos
        toast({
          title: "Cliente criado com avisos",
          description: warnings.slice(0, 3).join("; "),
        });
      }

      return { id: clientId, name: client.name };
    },
    onSuccess: (created, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["clients", workspace?.id],
      });
      trackEvent("client_created", {
        workspace_id: workspace?.id ?? "unknown",
        has_website: Boolean(vars.website),
        has_files: (vars.files?.length ?? 0) > 0,
        has_ai_analysis: Boolean(vars.aiAnalysis),
        industry: vars.industry ?? "none",
      });
      toast({
        title: "Cliente criado",
        description: `${created.name} foi adicionado ao workspace.`,
      });
    },
    onError: (error) => {
      console.error("[useClientOnboarding] mutation error:", error);
      toast({
        title: "Erro ao criar cliente",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setProgress("");
    },
  });

  return { createClient, progress };
}
