import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * DEPRECATED: This function now redirects to unified-content-api
 * The old 4-agent pipeline (writer → style_editor → consistency_editor → final_reviewer)
 * has been replaced with a more efficient Writer → Validator → Repair → Reviewer flow.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      clientId,
      clientName,
      contentFormat,
      identityGuide,
      contentLibrary = [],
      referenceLibrary = [],
      globalKnowledge = [],
      idea,
      userId,
    } = await req.json();

    console.log(`[DEPRECATED] generate-content-from-idea redirecting to unified-content-api`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Build a brief from the idea
    const brief = `TAREFA: Criar ${contentFormat} para ${clientName}

## IDEIA:
**Título:** ${idea.title}
**Conceito:** ${idea.description || ''}
${idea.inspiration ? `**Inspiração:** ${idea.inspiration}` : ''}

Por favor, crie o conteúdo completo seguindo o formato e estilo do cliente.`;

    // Redirect to unified-content-api
    const response = await fetch(`${supabaseUrl}/functions/v1/unified-content-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        client_id: clientId,
        format: contentFormat,
        brief: brief,
        options: {
          skip_review: false,
          strict_validation: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`unified-content-api error: ${errorText}`);
    }

    // Stream the response back in the same SSE format as before for compatibility
    const encoder = new TextEncoder();
    const reader = response.body?.getReader();
    
    if (!reader) {
      throw new Error("No response body from unified-content-api");
    }

    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (step: string, agentName?: string | null, content?: string | null, error?: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step, agentName, content, error })}\n\n`));
        };

        try {
          // Send initial progress
          sendProgress("writer", "Escritor de Conteúdo");

          let fullContent = "";
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            
            // Parse SSE chunks from unified-content-api
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  continue;
                }
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.choices?.[0]?.delta?.content) {
                    fullContent += parsed.choices[0].delta.content;
                  }
                } catch {
                  // Non-JSON data, skip
                }
              }
            }
          }

          // Send stages for backwards compatibility
          sendProgress("style_editor", "Editor de Estilo");
          sendProgress("consistency_editor", "Editor de Consistência");
          sendProgress("final_reviewer", "Revisor Final");
          
          // Send final content
          sendProgress("complete", null, fullContent);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error: any) {
          console.error("[DEPRECATED] Error:", error);
          sendProgress("error", null, null, error.message);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[DEPRECATED] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
