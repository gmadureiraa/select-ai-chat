import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Check, Loader2, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VoiceProfile {
  tone: string;
  use: string[];
  avoid: string[];
}

interface VoiceProfileEditorProps {
  clientId: string;
  initialProfile?: VoiceProfile | null;
  onSave?: (profile: VoiceProfile) => void;
}

const DEFAULT_PROFILE: VoiceProfile = {
  tone: "",
  use: [],
  avoid: [],
};

// Global AI phrases that should always be avoided
const SUGGESTED_AVOID = [
  "certamente",
  "com certeza",
  "absolutamente",
  "é importante notar",
  "vale ressaltar",
  "vamos falar sobre",
  "aqui está",
  "segue abaixo",
  "criei para você",
  "espero que goste",
  "fique à vontade",
  "não hesite em",
];

export function VoiceProfileEditor({ 
  clientId, 
  initialProfile, 
  onSave 
}: VoiceProfileEditorProps) {
  const [profile, setProfile] = useState<VoiceProfile>(initialProfile || DEFAULT_PROFILE);
  const [newUseItem, setNewUseItem] = useState("");
  const [newAvoidItem, setNewAvoidItem] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
    }
  }, [initialProfile]);

  const handleToneChange = (value: string) => {
    setProfile(prev => ({ ...prev, tone: value }));
    setHasChanges(true);
  };

  const addUseItem = () => {
    if (!newUseItem.trim()) return;
    if (profile.use.includes(newUseItem.trim())) {
      toast({ title: "Item já existe", variant: "destructive" });
      return;
    }
    setProfile(prev => ({ ...prev, use: [...prev.use, newUseItem.trim()] }));
    setNewUseItem("");
    setHasChanges(true);
  };

  const removeUseItem = (item: string) => {
    setProfile(prev => ({ ...prev, use: prev.use.filter(i => i !== item) }));
    setHasChanges(true);
  };

  const addAvoidItem = () => {
    if (!newAvoidItem.trim()) return;
    if (profile.avoid.includes(newAvoidItem.trim())) {
      toast({ title: "Item já existe", variant: "destructive" });
      return;
    }
    setProfile(prev => ({ ...prev, avoid: [...prev.avoid, newAvoidItem.trim()] }));
    setNewAvoidItem("");
    setHasChanges(true);
  };

  const removeAvoidItem = (item: string) => {
    setProfile(prev => ({ ...prev, avoid: prev.avoid.filter(i => i !== item) }));
    setHasChanges(true);
  };

  const addSuggestedAvoid = (phrase: string) => {
    if (profile.avoid.includes(phrase)) return;
    setProfile(prev => ({ ...prev, avoid: [...prev.avoid, phrase] }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ voice_profile: profile as any })
        .eq("id", clientId);

      if (error) throw error;

      onSave?.(profile);
      setHasChanges(false);
      toast({
        title: "Perfil de voz salvo",
        description: "As configurações de voz foram salvas com sucesso.",
      });
    } catch (error) {
      console.error("Error saving voice profile:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o perfil de voz.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      action();
    }
  };

  // Check which suggested phrases are not yet added
  const suggestionsNotAdded = SUGGESTED_AVOID.filter(p => !profile.avoid.includes(p));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-primary" />
          Perfil de Voz
        </CardTitle>
        <CardDescription>
          Configure o tom de voz e expressões específicas que a IA deve usar ou evitar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tone */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Tom de Voz</label>
          <Textarea
            value={profile.tone}
            onChange={(e) => handleToneChange(e.target.value)}
            placeholder="Ex: Direto, informal e acessível. Usa humor leve. Sempre positivo e motivacional."
            className="min-h-[80px]"
          />
          <p className="text-xs text-muted-foreground">
            Descreva em 1-2 frases como o cliente se comunica
          </p>
        </div>

        {/* Use Always */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-emerald-600">✓ Use Sempre</label>
          <p className="text-xs text-muted-foreground -mt-2">
            Palavras, expressões ou padrões que devem aparecer no conteúdo
          </p>
          
          <div className="flex gap-2">
            <Input
              value={newUseItem}
              onChange={(e) => setNewUseItem(e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, addUseItem)}
              placeholder="Ex: 'bora', 'simplesmente', números específicos..."
              className="flex-1"
            />
            <Button onClick={addUseItem} size="sm" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {profile.use.map((item) => (
              <Badge 
                key={item} 
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 gap-1 pr-1"
              >
                {item}
                <button
                  onClick={() => removeUseItem(item)}
                  className="ml-1 hover:bg-emerald-500/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {profile.use.length === 0 && (
              <span className="text-sm text-muted-foreground italic">
                Nenhuma expressão adicionada ainda
              </span>
            )}
          </div>
        </div>

        {/* Avoid Always */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-rose-600">✗ Evite Sempre</label>
          <p className="text-xs text-muted-foreground -mt-2">
            Palavras ou frases que nunca devem aparecer no conteúdo
          </p>
          
          <div className="flex gap-2">
            <Input
              value={newAvoidItem}
              onChange={(e) => setNewAvoidItem(e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, addAvoidItem)}
              placeholder="Ex: 'certamente', 'jargão corporativo'..."
              className="flex-1"
            />
            <Button onClick={addAvoidItem} size="sm" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {profile.avoid.map((item) => (
              <Badge 
                key={item} 
                variant="secondary"
                className="bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 gap-1 pr-1"
              >
                {item}
                <button
                  onClick={() => removeAvoidItem(item)}
                  className="ml-1 hover:bg-rose-500/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          {/* Suggested AI phrases to avoid */}
          {suggestionsNotAdded.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                💡 Frases genéricas de IA (clique para adicionar):
              </p>
              <div className="flex flex-wrap gap-1">
                {suggestionsNotAdded.slice(0, 6).map((phrase) => (
                  <Badge
                    key={phrase}
                    variant="outline"
                    className="cursor-pointer hover:bg-rose-500/10 hover:text-rose-700 transition-colors text-xs"
                    onClick={() => addSuggestedAvoid(phrase)}
                  >
                    + {phrase}
                  </Badge>
                ))}
                {suggestionsNotAdded.length > 6 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    +{suggestionsNotAdded.length - 6} mais
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Salvar Perfil de Voz
                </>
              )}
            </Button>
            <Badge variant="secondary" className="text-xs">
              Alterações não salvas
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
