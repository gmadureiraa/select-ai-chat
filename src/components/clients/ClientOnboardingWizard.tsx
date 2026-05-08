import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Sparkles,
  Globe,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  Megaphone,
  Upload,
  FileText,
  X,
  Plus,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiInvoke } from "@/lib/apiInvoke";
import {
  useClientOnboarding,
  type OnboardingData,
} from "@/hooks/useClientOnboarding";

interface ClientOnboardingWizardProps {
  /** Callback opcional após criar com sucesso. Recebe o id do cliente. */
  onComplete?: (clientId: string) => void;
  /** Callback opcional ao cancelar/fechar. */
  onCancel?: () => void;
  /**
   * Se true, redireciona pra `/kaleidos?client=<id>` ao concluir.
   * Default true — mantém comportamento descrito no briefing.
   */
  redirectOnComplete?: boolean;
}

type StepId = 1 | 2 | 3 | 4 | 5;

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 1, label: "Briefing" },
  { id: 2, label: "Persona / Voz" },
  { id: 3, label: "Redes" },
  { id: 4, label: "Material" },
  { id: 5, label: "Resumo" },
];

const TONE_OPTIONS = [
  { value: "formal", label: "Formal" },
  { value: "informal", label: "Informal" },
  { value: "tecnico", label: "Técnico" },
  { value: "casual", label: "Casual" },
] as const;

const SOCIAL_FIELDS: Array<{
  key: keyof OnboardingData;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
}> = [
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "@usuario" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "linkedin.com/in/..." },
  { key: "twitter", label: "X / Twitter", icon: Twitter, placeholder: "@usuario" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "@canal" },
  { key: "tiktok", label: "TikTok", icon: Megaphone, placeholder: "@usuario" },
];

/**
 * Wizard de 5 steps pra cadastrar um novo cliente da agência. Coleta:
 *   1. Briefing básico (+ "Analisar site" via IA pra preencher campos)
 *   2. Persona, tom de voz, pilares, do/don't
 *   3. Redes sociais (apenas handles, sem OAuth)
 *   4. Material de referência (uploads + inspirações + concorrentes)
 *   5. Resumo / confirmação
 *
 * Submissão final delega pro hook `useClientOnboarding`, que cria
 * client + preferences + reference library + documents numa transação lógica.
 */
export function ClientOnboardingWizard({
  onComplete,
  onCancel,
  redirectOnComplete = true,
}: ClientOnboardingWizardProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { createClient, progress } = useClientOnboarding();

  const [step, setStep] = useState<StepId>(1);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    industry: "",
    description: "",
    website: "",
    tone: "",
    pillars: [],
    brandDo: "",
    brandDont: "",
    personaAge: "",
    personaPain: "",
    personaGoal: "",
    instagram: "",
    linkedin: "",
    twitter: "",
    youtube: "",
    tiktok: "",
    files: [],
    inspirations: [],
    competitors: [],
  });

  const [pillarsInput, setPillarsInput] = useState("");
  const [inspirationsText, setInspirationsText] = useState("");
  const [competitorsText, setCompetitorsText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const update = <K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K]
  ) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1:
        return data.name.trim().length > 0;
      case 2:
      case 3:
      case 4:
        return true;
      case 5:
        return data.name.trim().length > 0;
      default:
        return false;
    }
  }, [step, data.name]);

  const handleAnalyzeWebsite = async () => {
    if (!data.website?.trim()) {
      toast({
        title: "Informe um site",
        description: "Cole a URL principal do cliente para a IA analisar.",
        variant: "destructive",
      });
      return;
    }
    setAnalyzing(true);
    try {
      const { data: result, error } = await apiInvoke(
        "analyze-client-onboarding",
        {
          body: {
            clientData: {
              name: data.name || "Cliente",
              description: data.description || "",
              segment: data.industry || "",
              websites: [data.website],
              socialMedia: { website: data.website },
            },
          },
        }
      );

      if (error || !result?.success || !result.analysis) {
        throw new Error(
          error?.message ||
            result?.error ||
            "A IA não conseguiu analisar o site agora."
        );
      }

      const analysis = result.analysis as Record<string, any>;

      // Auto-preenche campos sem sobrescrever o que o usuário já digitou.
      setData((prev) => ({
        ...prev,
        description:
          prev.description?.trim() ||
          (analysis.executive_summary as string) ||
          "",
        industry:
          prev.industry?.trim() ||
          (Array.isArray(analysis.content_themes)
            ? (analysis.content_themes[0] as string)
            : "") ||
          "",
        tone:
          (prev.tone || "") ||
          mapToneToOption(
            analysis?.tone_of_voice?.primary as string | undefined
          ),
        pillars:
          prev.pillars && prev.pillars.length > 0
            ? prev.pillars
            : (analysis.content_themes as string[]) || [],
        personaAge:
          prev.personaAge?.trim() ||
          (analysis?.target_audience?.demographics?.age as string) ||
          "",
        personaGoal:
          prev.personaGoal?.trim() ||
          (Array.isArray(analysis?.objectives)
            ? (analysis.objectives[0] as string)
            : "") ||
          "",
        aiAnalysis: analysis,
      }));

      toast({
        title: "Site analisado",
        description: "Campos preenchidos automaticamente. Revise antes de avançar.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      toast({
        title: "Falha ao analisar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files);
    setData((prev) => ({
      ...prev,
      files: [...(prev.files || []), ...incoming],
    }));
    // reset para permitir re-selecionar o mesmo arquivo
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    setData((prev) => ({
      ...prev,
      files: (prev.files || []).filter((_, i) => i !== idx),
    }));
  };

  const addPillar = () => {
    const value = pillarsInput.trim();
    if (!value) return;
    setData((prev) => ({
      ...prev,
      pillars: [...(prev.pillars || []), value],
    }));
    setPillarsInput("");
  };

  const removePillar = (idx: number) => {
    setData((prev) => ({
      ...prev,
      pillars: (prev.pillars || []).filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = async () => {
    // Normaliza textareas multi-linha pra arrays
    const inspirations = inspirationsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const competitors = competitorsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: OnboardingData = {
      ...data,
      inspirations,
      competitors,
    };

    try {
      const created = await createClient.mutateAsync(payload);
      onComplete?.(created.id);
      if (redirectOnComplete) {
        navigate(`/kaleidos?client=${created.id}`);
      }
    } catch {
      // toast já mostrado pelo hook
    }
  };

  const handleNext = () => {
    if (!canAdvance) return;
    setStep((s) => (Math.min(5, s + 1) as StepId));
  };

  const handleBack = () => {
    if (step === 1) {
      onCancel?.();
      return;
    }
    setStep((s) => (Math.max(1, s - 1) as StepId));
  };

  const isSubmitting = createClient.isPending;

  return (
    <div className="space-y-6">
      <Stepper currentStep={step} />

      {step === 1 && (
        <StepBriefing
          data={data}
          update={update}
          analyzing={analyzing}
          onAnalyze={handleAnalyzeWebsite}
        />
      )}

      {step === 2 && (
        <StepPersona
          data={data}
          update={update}
          pillarsInput={pillarsInput}
          setPillarsInput={setPillarsInput}
          onAddPillar={addPillar}
          onRemovePillar={removePillar}
        />
      )}

      {step === 3 && <StepSocial data={data} update={update} />}

      {step === 4 && (
        <StepMaterial
          data={data}
          inspirationsText={inspirationsText}
          setInspirationsText={setInspirationsText}
          competitorsText={competitorsText}
          setCompetitorsText={setCompetitorsText}
          onFileChange={handleFileChange}
          onRemoveFile={removeFile}
        />
      )}

      {step === 5 && <StepSummary data={data} />}

      {/* Footer */}
      <div className="flex flex-col-reverse gap-2 pt-4 border-t sm:flex-row sm:justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={isSubmitting}
          className="sm:w-auto"
        >
          {step === 1 ? (
            "Cancelar"
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </>
          )}
        </Button>

        {step < 5 ? (
          <Button
            onClick={handleNext}
            disabled={!canAdvance || analyzing}
            className="sm:w-auto"
          >
            Continuar
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canAdvance || isSubmitting}
            className="sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {progress || "Criando..."}
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Criar cliente
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// -- Subcomponentes -------------------------------------------------------

function Stepper({ currentStep }: { currentStep: StepId }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {STEPS.map((s, idx) => {
        const isDone = currentStep > s.id;
        const isActive = currentStep === s.id;
        return (
          <div key={s.id} className="flex items-center flex-1">
            <div
              className={cn(
                "flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-medium shrink-0 transition-colors",
                isDone
                  ? "bg-primary text-primary-foreground"
                  : isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              )}
              aria-current={isActive ? "step" : undefined}
              title={s.label}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : s.id}
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-1 sm:mx-2 rounded transition-colors",
                  isDone ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepBriefing({
  data,
  update,
  analyzing,
  onAnalyze,
}: {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
  analyzing: boolean;
  onAnalyze: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Briefing básico</h3>
        <p className="text-sm text-muted-foreground">
          Conta o essencial. A IA pode analisar o site e preencher o resto.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboarding-name">Nome do cliente *</Label>
        <Input
          id="onboarding-name"
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Ex: Defiverso"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboarding-industry">Indústria / segmento</Label>
        <Input
          id="onboarding-industry"
          value={data.industry || ""}
          onChange={(e) => update("industry", e.target.value)}
          placeholder="Ex: Educação cripto, Fintech, Cibersegurança..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboarding-description">Descrição curta</Label>
        <Textarea
          id="onboarding-description"
          value={data.description || ""}
          onChange={(e) => update("description", e.target.value)}
          placeholder="O que esse cliente faz? Pra quem? Diferencial?"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboarding-website" className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          Site principal
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="onboarding-website"
            value={data.website || ""}
            onChange={(e) => update("website", e.target.value)}
            placeholder="https://..."
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={onAnalyze}
            disabled={analyzing || !data.website?.trim()}
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analisar site
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A IA vai extrair tom, pilares e persona com base no site.
        </p>
      </div>
    </div>
  );
}

function StepPersona({
  data,
  update,
  pillarsInput,
  setPillarsInput,
  onAddPillar,
  onRemovePillar,
}: {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
  pillarsInput: string;
  setPillarsInput: (v: string) => void;
  onAddPillar: () => void;
  onRemovePillar: (i: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Persona e voz</h3>
        <p className="text-sm text-muted-foreground">
          Defina como esse cliente fala e pra quem.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Tom de voz</Label>
        <Select
          value={data.tone || ""}
          onValueChange={(v) => update("tone", v as OnboardingData["tone"])}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tom dominante" />
          </SelectTrigger>
          <SelectContent>
            {TONE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Pilares de conteúdo</Label>
        <div className="flex gap-2">
          <Input
            value={pillarsInput}
            onChange={(e) => setPillarsInput(e.target.value)}
            placeholder="Ex: Educação cripto"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddPillar();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={onAddPillar}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {(data.pillars || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(data.pillars || []).map((p, i) => (
              <Badge key={`${p}-${i}`} variant="secondary" className="pr-1 gap-1">
                {p}
                <button
                  type="button"
                  onClick={() => onRemovePillar(i)}
                  className="ml-1 p-0.5 rounded hover:bg-muted-foreground/20"
                  aria-label={`Remover ${p}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="onboarding-do">Do</Label>
          <Textarea
            id="onboarding-do"
            value={data.brandDo || ""}
            onChange={(e) => update("brandDo", e.target.value)}
            placeholder="O que a marca DEVE fazer"
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboarding-dont">Don't</Label>
          <Textarea
            id="onboarding-dont"
            value={data.brandDont || ""}
            onChange={(e) => update("brandDont", e.target.value)}
            placeholder="O que a marca NÃO deve fazer"
            rows={3}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Persona alvo</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            value={data.personaAge || ""}
            onChange={(e) => update("personaAge", e.target.value)}
            placeholder="Idade (ex: 28-40)"
          />
          <Input
            value={data.personaPain || ""}
            onChange={(e) => update("personaPain", e.target.value)}
            placeholder="Dor principal"
          />
          <Input
            value={data.personaGoal || ""}
            onChange={(e) => update("personaGoal", e.target.value)}
            placeholder="Objetivo / sonho"
          />
        </div>
      </div>
    </div>
  );
}

function StepSocial({
  data,
  update,
}: {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Redes sociais</h3>
        <p className="text-sm text-muted-foreground">
          Apenas os handles. A conexão OAuth é feita depois.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SOCIAL_FIELDS.map((field) => {
          const Icon = field.icon;
          const value = (data[field.key] as string) || "";
          return (
            <div key={String(field.key)} className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {field.label}
              </Label>
              <Input
                value={value}
                onChange={(e) =>
                  update(field.key, e.target.value as OnboardingData[typeof field.key])
                }
                placeholder={field.placeholder}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepMaterial({
  data,
  inspirationsText,
  setInspirationsText,
  competitorsText,
  setCompetitorsText,
  onFileChange,
  onRemoveFile,
}: {
  data: OnboardingData;
  inspirationsText: string;
  setInspirationsText: (v: string) => void;
  competitorsText: string;
  setCompetitorsText: (v: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (i: number) => void;
}) {
  const files = data.files || [];
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Material de referência</h3>
        <p className="text-sm text-muted-foreground">
          Upload de PDFs / imagens, marcas que admiram e concorrentes.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Documentos / imagens</Label>
        <div className="border border-dashed rounded-lg p-4 hover:border-primary/50 transition-colors">
          <input
            type="file"
            multiple
            onChange={onFileChange}
            className="hidden"
            id="onboarding-files"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
          />
          <label
            htmlFor="onboarding-files"
            className="cursor-pointer flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Upload className="h-4 w-4" />
            Clique ou arraste arquivos aqui
          </label>
        </div>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {files.map((file, idx) => (
              <Badge
                key={`${file.name}-${idx}`}
                variant="secondary"
                className="gap-1 pr-1"
              >
                <FileText className="h-3 w-3" />
                <span className="truncate max-w-[140px]">{file.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveFile(idx)}
                  className="ml-1 p-0.5 rounded hover:bg-muted-foreground/20"
                  aria-label={`Remover ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboarding-inspirations">
          Marcas que admiram (uma por linha)
        </Label>
        <Textarea
          id="onboarding-inspirations"
          value={inspirationsText}
          onChange={(e) => setInspirationsText(e.target.value)}
          placeholder={"Ex: Apple\nNotion\nNubank"}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboarding-competitors">
          Concorrentes principais (uma por linha)
        </Label>
        <Textarea
          id="onboarding-competitors"
          value={competitorsText}
          onChange={(e) => setCompetitorsText(e.target.value)}
          placeholder={"Ex: ConcorrenteA\nConcorrenteB"}
          rows={3}
        />
      </div>
    </div>
  );
}

function StepSummary({ data }: { data: OnboardingData }) {
  const socialEntries = SOCIAL_FIELDS.filter((f) =>
    ((data[f.key] as string) || "").trim()
  );
  const fileCount = (data.files || []).length;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Tudo certo?</h3>
        <p className="text-sm text-muted-foreground">
          Revise antes de criar. Você poderá editar depois.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold truncate">{data.name || "—"}</h4>
            {data.industry && (
              <p className="text-xs text-muted-foreground">{data.industry}</p>
            )}
            {data.description && (
              <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
                {data.description}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2 pt-2 border-t">
          {data.website && (
            <SummaryRow icon={<Globe className="h-3.5 w-3.5" />} label="Site">
              <span className="truncate">{data.website}</span>
            </SummaryRow>
          )}
          {data.tone && (
            <SummaryRow label="Tom">
              {TONE_OPTIONS.find((t) => t.value === data.tone)?.label || data.tone}
            </SummaryRow>
          )}
          {(data.pillars || []).length > 0 && (
            <SummaryRow label="Pilares">
              <span>{(data.pillars || []).join(", ")}</span>
            </SummaryRow>
          )}
          {socialEntries.length > 0 && (
            <SummaryRow label="Redes">
              <span>
                {socialEntries.length} conectada
                {socialEntries.length === 1 ? "" : "s"}
              </span>
            </SummaryRow>
          )}
          {fileCount > 0 && (
            <SummaryRow label="Arquivos">
              <span>
                {fileCount} arquivo{fileCount === 1 ? "" : "s"}
              </span>
            </SummaryRow>
          )}
          {(data.personaAge || data.personaPain || data.personaGoal) && (
            <SummaryRow label="Persona">
              <span className="truncate">
                {[data.personaAge, data.personaPain, data.personaGoal]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </SummaryRow>
          )}
        </div>
      </Card>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground shrink-0 w-16">
        {icon ? <span className="inline-flex items-center gap-1">{icon} {label}</span> : label}
      </span>
      <span className="text-sm text-foreground min-w-0 flex-1 truncate">
        {children}
      </span>
    </div>
  );
}

// -- helpers --------------------------------------------------------------

function mapToneToOption(value?: string): OnboardingData["tone"] {
  if (!value) return "";
  const v = value.toLowerCase();
  if (v.includes("formal")) return "formal";
  if (v.includes("téc") || v.includes("tec")) return "tecnico";
  if (v.includes("informal")) return "informal";
  if (v.includes("casual") || v.includes("descontra")) return "casual";
  return "";
}
