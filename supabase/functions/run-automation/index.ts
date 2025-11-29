import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchDataSources(dataSources: any[]) {
  const results: Record<string, any> = {};

  for (const source of dataSources) {
    try {
      console.log(`Fetching data from ${source.name}:`, source.url);
      
      const options: RequestInit = {
        method: source.method || "GET",
        headers: source.headers || {},
      };

      if (source.method === "POST" && source.body) {
        options.body = source.body;
        if (!options.headers) options.headers = {};
        (options.headers as Record<string, string>)["Content-Type"] = "application/json";
      }

      const response = await fetch(source.url, options);
      const data = await response.json();
      
      results[source.name] = data;
      console.log(`Successfully fetched data from ${source.name}`);
    } catch (error) {
      console.error(`Error fetching ${source.name}:`, error);
      results[source.name] = { error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  return results;
}

async function executeActions(
  actions: any[],
  result: string,
  automationId: string,
  supabase: any,
  webhookUrl?: string,
  emailRecipients?: string[]
) {
  for (const action of actions) {
    try {
      console.log(`Executing action: ${action.type}`);

      if (action.type === "save_to_db") {
        // Result is already saved in automation_runs
        console.log("Result saved to database");
      } else if (action.type === "webhook" && webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            automation_id: automationId,
            result: result,
            timestamp: new Date().toISOString(),
          }),
        });
        console.log("Webhook called successfully");
      } else if (action.type === "send_email" && emailRecipients?.length) {
        console.log(`Email would be sent to: ${emailRecipients.join(", ")}`);
        // Email functionality would require additional email service setup
      }
    } catch (error) {
      console.error(`Error executing action ${action.type}:`, error);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const { automationId } = await req.json();

    if (!automationId) {
      return new Response(
        JSON.stringify({ error: "automationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar automação
    const { data: automation, error: automationError } = await supabase
      .from("automations")
      .select("*, clients(*)")
      .eq("id", automationId)
      .single();

    if (automationError || !automation) {
      throw new Error("Automation not found");
    }

    if (!automation.is_active) {
      return new Response(
        JSON.stringify({ error: "Automation is not active" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar registro de execução
    const { data: run, error: runError } = await supabase
      .from("automation_runs")
      .insert({
        automation_id: automationId,
        status: "running",
      })
      .select()
      .single();

    if (runError) throw runError;

    console.log("Running automation:", automation.name);

    // Fetch data from configured sources
    let externalData = {};
    if (automation.data_sources && Array.isArray(automation.data_sources) && automation.data_sources.length > 0) {
      console.log("Fetching external data sources...");
      externalData = await fetchDataSources(automation.data_sources);
    }

    try {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY not configured");
      }

      // Construir contexto da automação
      const systemPrompt = `Você é o kAI, assistente de IA da Kaleidos executando uma automação agendada.

Cliente: ${automation.clients.name}
Automação: ${automation.name}
${automation.description ? `Descrição: ${automation.description}` : ""}

Contexto do Cliente:
${automation.clients.context_notes || "Nenhum contexto adicional"}

${Object.keys(externalData).length > 0 ? `
Dados Externos Coletados:
${Object.entries(externalData).map(([name, data]) => `
${name}:
${JSON.stringify(data, null, 2)}
`).join("\n")}
` : ""}

Execute a tarefa solicitada de forma completa e profissional.`;

      // Chamar OpenAI
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: automation.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: automation.prompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const result = data.choices[0].message.content;

      const duration = Date.now() - startTime;

      // Atualizar execução como completada
      await supabase
        .from("automation_runs")
        .update({
          status: "completed",
          result,
          completed_at: new Date().toISOString(),
          duration_ms: duration,
        })
        .eq("id", run.id);

      // Atualizar automação com última execução
      await supabase
        .from("automations")
        .update({
          last_run_at: new Date().toISOString(),
        })
        .eq("id", automationId);

      // Execute configured actions
      if (automation.actions && Array.isArray(automation.actions) && automation.actions.length > 0) {
        console.log("Executing configured actions...");
        await executeActions(
          automation.actions,
          result,
          automationId,
          supabase,
          automation.webhook_url,
          automation.email_recipients
        );
      }

      console.log(`Automation completed in ${duration}ms`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          runId: run.id,
          result,
          duration 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Atualizar execução como falha
      await supabase
        .from("automation_runs")
        .update({
          status: "failed",
          error: errorMessage,
          completed_at: new Date().toISOString(),
          duration_ms: duration,
        })
        .eq("id", run.id);

      throw error;
    }
  } catch (error) {
    console.error("Error running automation:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
