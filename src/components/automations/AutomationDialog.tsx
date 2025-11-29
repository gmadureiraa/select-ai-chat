import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAutomations } from "@/hooks/useAutomations";
import { Automation, ScheduleType, DayOfWeek, DataSource, AutomationAction } from "@/types/automation";
import { ScheduleConfig } from "./ScheduleConfig";
import { DataSourcesConfig } from "./DataSourcesConfig";
import { ActionsConfig } from "./ActionsConfig";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation?: Automation;
}

interface FormData {
  client_id: string;
  name: string;
  description: string;
  prompt: string;
  schedule_type: ScheduleType;
  model: string;
  schedule_days: DayOfWeek[];
  schedule_time: string;
  data_sources: DataSource[];
  actions: AutomationAction[];
  webhook_url: string;
  email_recipients: string[];
}

const MODELS = [
  { id: "gpt-5-2025-08-07", name: "GPT-5" },
  { id: "gpt-5-mini-2025-08-07", name: "GPT-5 Mini" },
  { id: "gpt-4.1-2025-04-14", name: "GPT-4.1" },
];

export const AutomationDialog = ({
  open,
  onOpenChange,
  automation,
}: AutomationDialogProps) => {
  const { createAutomation, updateAutomation } = useAutomations();
  const [scheduleDays, setScheduleDays] = useState<DayOfWeek[]>([]);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [actions, setActions] = useState<AutomationAction[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);

  const form = useForm<FormData>({
    defaultValues: {
      client_id: "",
      name: "",
      description: "",
      prompt: "",
      schedule_type: "daily",
      model: "gpt-5-mini-2025-08-07",
      schedule_days: [],
      schedule_time: "09:00",
      data_sources: [],
      actions: [],
      webhook_url: "",
      email_recipients: [],
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (automation) {
      form.reset({
        client_id: automation.client_id,
        name: automation.name,
        description: automation.description || "",
        prompt: automation.prompt,
        schedule_type: automation.schedule_type,
        model: automation.model,
        schedule_days: automation.schedule_days || [],
        schedule_time: automation.schedule_time || "09:00",
        data_sources: automation.data_sources || [],
        actions: automation.actions || [],
        webhook_url: automation.webhook_url || "",
        email_recipients: automation.email_recipients || [],
      });
      setScheduleDays(automation.schedule_days || []);
      setScheduleTime(automation.schedule_time || "09:00");
      setDataSources(automation.data_sources || []);
      setActions(automation.actions || []);
      setWebhookUrl(automation.webhook_url || "");
      setEmailRecipients(automation.email_recipients || []);
    } else {
      form.reset({
        client_id: "",
        name: "",
        description: "",
        prompt: "",
        schedule_type: "daily",
        model: "gpt-5-mini-2025-08-07",
        schedule_days: [],
        schedule_time: "09:00",
        data_sources: [],
        actions: [],
        webhook_url: "",
        email_recipients: [],
      });
      setScheduleDays([]);
      setScheduleTime("09:00");
      setDataSources([]);
      setActions([]);
      setWebhookUrl("");
      setEmailRecipients([]);
    }
  }, [automation, form, open]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      schedule_days: scheduleDays,
      schedule_time: scheduleTime,
      data_sources: dataSources,
      actions: actions,
      webhook_url: webhookUrl,
      email_recipients: emailRecipients,
    };

    if (automation) {
      await updateAutomation.mutateAsync({
        id: automation.id,
        ...payload,
      });
    } else {
      await createAutomation.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {automation ? "Editar Automação" : "Nova Automação"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="client_id"
              rules={{ required: "Selecione um cliente" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              rules={{ required: "Nome é obrigatório" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Automação</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Relatório Semanal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Breve descrição da automação"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prompt"
              rules={{ required: "Prompt é obrigatório" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarefa / Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o que a IA deve fazer quando a automação for executada..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A IA executará esta tarefa automaticamente no período
                    definido
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="schedule_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequência</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Diariamente</SelectItem>
                        <SelectItem value="weekly">Semanalmente</SelectItem>
                        <SelectItem value="monthly">Mensalmente</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo de IA</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MODELS.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <ScheduleConfig
              scheduleType={form.watch("schedule_type")}
              scheduleDays={scheduleDays}
              scheduleTime={scheduleTime}
              onDaysChange={setScheduleDays}
              onTimeChange={setScheduleTime}
            />

            <DataSourcesConfig
              dataSources={dataSources}
              onChange={setDataSources}
            />

            <ActionsConfig
              actions={actions}
              onChange={setActions}
              webhookUrl={webhookUrl}
              emailRecipients={emailRecipients}
              onWebhookChange={setWebhookUrl}
              onEmailRecipientsChange={setEmailRecipients}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createAutomation.isPending || updateAutomation.isPending
                }
              >
                {automation ? "Salvar Alterações" : "Criar Automação"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
