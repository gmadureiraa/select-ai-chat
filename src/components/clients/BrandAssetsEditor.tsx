import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useBrandAssets, BrandAssets } from "@/hooks/useBrandAssets";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { Loader2, Plus, X, Palette, Type, Camera } from "lucide-react";

interface BrandAssetsEditorProps {
  clientId: string;
  clientName: string;
}

const COLOR_FIELDS = [
  { key: "primary", label: "Cor Primária" },
  { key: "secondary", label: "Cor Secundária" },
  { key: "accent", label: "Cor de Destaque" },
  { key: "background", label: "Cor de Fundo" },
  { key: "text", label: "Cor do Texto" },
] as const;

export const BrandAssetsEditor = ({ clientId, clientName }: BrandAssetsEditorProps) => {
  const { brandAssets, isLoading, updateBrandAssets } = useBrandAssets(clientId);
  
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoVariations, setLogoVariations] = useState<string[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [primaryFont, setPrimaryFont] = useState("");
  const [secondaryFont, setSecondaryFont] = useState("");
  const [typographyStyle, setTypographyStyle] = useState("");
  const [photographyStyle, setPhotographyStyle] = useState("");
  const [mood, setMood] = useState("");
  const [recurringElements, setRecurringElements] = useState<string[]>([]);
  const [newElement, setNewElement] = useState("");

  useEffect(() => {
    if (brandAssets) {
      setLogoUrl(brandAssets.logo_url || "");
      setLogoVariations(brandAssets.logo_variations || []);
      setColors(brandAssets.color_palette || {});
      setPrimaryFont(brandAssets.typography?.primary_font || "");
      setSecondaryFont(brandAssets.typography?.secondary_font || "");
      setTypographyStyle(brandAssets.typography?.style || "");
      setPhotographyStyle(brandAssets.visual_style?.photography_style || "");
      setMood(brandAssets.visual_style?.mood || "");
      setRecurringElements(brandAssets.visual_style?.recurring_elements || []);
    }
  }, [brandAssets]);

  const handleSave = () => {
    const assets: BrandAssets = {
      logo_url: logoUrl || undefined,
      logo_variations: logoVariations.length > 0 ? logoVariations : undefined,
      color_palette: Object.keys(colors).length > 0 ? colors : undefined,
      typography: (primaryFont || secondaryFont || typographyStyle) ? {
        primary_font: primaryFont || undefined,
        secondary_font: secondaryFont || undefined,
        style: typographyStyle || undefined,
      } : undefined,
      visual_style: (photographyStyle || mood || recurringElements.length > 0) ? {
        photography_style: photographyStyle || undefined,
        mood: mood || undefined,
        recurring_elements: recurringElements.length > 0 ? recurringElements : undefined,
      } : undefined,
    };

    updateBrandAssets.mutate(assets);
  };

  const addRecurringElement = () => {
    if (newElement.trim() && !recurringElements.includes(newElement.trim())) {
      setRecurringElements([...recurringElements, newElement.trim()]);
      setNewElement("");
    }
  };

  const removeRecurringElement = (element: string) => {
    setRecurringElements(recurringElements.filter(e => e !== element));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logo Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Logo da Marca</Label>
        </div>
        
        <div className="flex items-start gap-6">
          <AvatarUpload
            currentUrl={logoUrl || null}
            onUpload={(url) => setLogoUrl(url)}
            fallback={clientName.charAt(0)}
            size="lg"
            bucket="client-files"
            folder="brand-logos"
          />
          <div className="flex-1 space-y-2">
            <p className="text-xs text-muted-foreground">
              A logo principal será usada como referência em todas as gerações de imagem.
            </p>
            {logoUrl && (
              <Badge variant="outline" className="text-xs">
                Logo configurada
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Color Palette Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Paleta de Cores</Label>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {COLOR_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={colors[key] || "#000000"}
                  onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  value={colors[key] || ""}
                  onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                  placeholder="#FFFFFF"
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Tipografia</Label>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fonte Principal</Label>
            <Input
              value={primaryFont}
              onChange={(e) => setPrimaryFont(e.target.value)}
              placeholder="Ex: Montserrat, Roboto"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fonte Secundária</Label>
            <Input
              value={secondaryFont}
              onChange={(e) => setSecondaryFont(e.target.value)}
              placeholder="Ex: Open Sans, Lato"
            />
          </div>
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Estilo Tipográfico</Label>
          <Input
            value={typographyStyle}
            onChange={(e) => setTypographyStyle(e.target.value)}
            placeholder="Ex: Moderno, Minimalista, Clássico"
          />
        </div>
      </div>

      {/* Visual Style Section */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Estilo Visual</Label>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Estilo Fotográfico</Label>
            <Input
              value={photographyStyle}
              onChange={(e) => setPhotographyStyle(e.target.value)}
              placeholder="Ex: Lifestyle, Produto, Minimalista"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Mood / Tom Visual</Label>
            <Input
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="Ex: Profissional, Descontraído, Luxuoso"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Elementos Recorrentes</Label>
          <div className="flex gap-2">
            <Input
              value={newElement}
              onChange={(e) => setNewElement(e.target.value)}
              placeholder="Ex: Gradientes, Ícones minimalistas"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRecurringElement())}
            />
            <Button type="button" size="icon" onClick={addRecurringElement}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {recurringElements.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {recurringElements.map((element, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {element}
                  <button
                    type="button"
                    onClick={() => removeRecurringElement(element)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <Button 
        type="button" 
        onClick={handleSave} 
        disabled={updateBrandAssets.isPending}
        className="w-full"
      >
        {updateBrandAssets.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Salvando...
          </>
        ) : (
          "Salvar Brand Assets"
        )}
      </Button>
    </div>
  );
};
