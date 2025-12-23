import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useBrandAssets, BrandAssets } from "@/hooks/useBrandAssets";
import { useExtractBranding, ExtractedBranding } from "@/hooks/useExtractBranding";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { 
  Loader2, 
  Palette, 
  Type, 
  Camera, 
  Globe, 
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  Mail,
  X,
  ExternalLink
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BrandAssetsEditorProps {
  clientId: string;
  clientName: string;
  websiteUrl?: string;
}

const FONT_OPTIONS = [
  "Inter", "Roboto", "Open Sans", "Montserrat", "Lato", "Poppins",
  "Raleway", "Nunito", "Work Sans", "DM Sans", "Plus Jakarta Sans",
  "Playfair Display", "Merriweather", "Lora", "Crimson Text", "Libre Baskerville",
  "JetBrains Mono", "Fira Code", "Source Code Pro", "IBM Plex Mono"
];

export const BrandAssetsEditor = ({ clientId, clientName, websiteUrl }: BrandAssetsEditorProps) => {
  const { brandAssets, isLoading, updateBrandAssets } = useBrandAssets(clientId);
  const { extractBranding, isExtracting } = useExtractBranding();
  
  // URL for extraction
  const [extractUrl, setExtractUrl] = useState(websiteUrl || "");
  const [extractionSuccess, setExtractionSuccess] = useState(false);
  
  // Logos
  const [logos, setLogos] = useState<{
    primary?: string;
    negative?: string;
    alternative?: string;
    favicon?: string;
  }>({});
  
  // Colors
  const [colors, setColors] = useState<{
    primary: { color: string; text: string };
    secondary: { color: string; text: string };
    accent: { color: string; text: string };
    surfaces: { background: string; card: string; muted: string; border: string };
    textBase: string;
    buttons: { primary: { bg: string; text: string }; secondary: { bg: string; text: string } };
  }>({
    primary: { color: "", text: "" },
    secondary: { color: "", text: "" },
    accent: { color: "", text: "" },
    surfaces: { background: "", card: "", muted: "", border: "" },
    textBase: "",
    buttons: { primary: { bg: "", text: "" }, secondary: { bg: "", text: "" } },
  });
  
  // Typography
  const [fonts, setFonts] = useState<{ sans: string; serif: string; mono: string }>({
    sans: "",
    serif: "",
    mono: "",
  });
  
  // Photography
  const [photographyDescription, setPhotographyDescription] = useState("");
  const [photographyImages, setPhotographyImages] = useState<string[]>([]);
  
  // Email assets
  const [emailAssets, setEmailAssets] = useState<{ headerImage?: string; footerImage?: string }>({});

  useEffect(() => {
    if (brandAssets) {
      // Load logos (new or legacy)
      setLogos({
        primary: brandAssets.logos?.primary || brandAssets.logo_url || "",
        negative: brandAssets.logos?.negative || "",
        alternative: brandAssets.logos?.alternative || "",
        favicon: brandAssets.logos?.favicon || "",
      });
      
      // Load colors (new or legacy)
      if (brandAssets.colors) {
        setColors({
          primary: { 
            color: brandAssets.colors.primary?.color || "", 
            text: brandAssets.colors.primary?.text || "" 
          },
          secondary: { 
            color: brandAssets.colors.secondary?.color || "", 
            text: brandAssets.colors.secondary?.text || "" 
          },
          accent: { 
            color: brandAssets.colors.accent?.color || "", 
            text: brandAssets.colors.accent?.text || "" 
          },
          surfaces: {
            background: brandAssets.colors.surfaces?.background || "",
            card: brandAssets.colors.surfaces?.card || "",
            muted: brandAssets.colors.surfaces?.muted || "",
            border: brandAssets.colors.surfaces?.border || "",
          },
          textBase: brandAssets.colors.textBase || "",
          buttons: {
            primary: { 
              bg: brandAssets.colors.buttons?.primary?.bg || "", 
              text: brandAssets.colors.buttons?.primary?.text || "" 
            },
            secondary: { 
              bg: brandAssets.colors.buttons?.secondary?.bg || "", 
              text: brandAssets.colors.buttons?.secondary?.text || "" 
            },
          },
        });
      } else if (brandAssets.color_palette) {
        // Legacy migration
        setColors({
          primary: { color: brandAssets.color_palette.primary || "", text: "" },
          secondary: { color: brandAssets.color_palette.secondary || "", text: "" },
          accent: { color: brandAssets.color_palette.accent || "", text: "" },
          surfaces: { 
            background: brandAssets.color_palette.background || "", 
            card: "", muted: "", border: "" 
          },
          textBase: brandAssets.color_palette.text || "",
          buttons: { primary: { bg: "", text: "" }, secondary: { bg: "", text: "" } },
        });
      }
      
      // Load fonts (new or legacy)
      if (brandAssets.fonts) {
        setFonts({
          sans: brandAssets.fonts.sans || "",
          serif: brandAssets.fonts.serif || "",
          mono: brandAssets.fonts.mono || "",
        });
      } else if (brandAssets.typography) {
        setFonts({
          sans: brandAssets.typography.primary_font || "",
          serif: brandAssets.typography.secondary_font || "",
          mono: "",
        });
      }
      
      // Load photography (new or legacy)
      if (brandAssets.photography) {
        setPhotographyDescription(brandAssets.photography.description || "");
        setPhotographyImages(brandAssets.photography.referenceImages || []);
      } else if (brandAssets.visual_style) {
        setPhotographyDescription(brandAssets.visual_style.photography_style || "");
      }
      
      // Load email assets
      if (brandAssets.emailAssets) {
        setEmailAssets(brandAssets.emailAssets);
      }
      
      // Set extraction URL from import metadata
      if (brandAssets.importedFrom) {
        setExtractUrl(brandAssets.importedFrom);
      }
    }
  }, [brandAssets]);

  const handleExtract = async () => {
    const extracted = await extractBranding(extractUrl);
    if (extracted) {
      applyExtractedData(extracted);
      setExtractionSuccess(true);
      setTimeout(() => setExtractionSuccess(false), 3000);
    }
  };

  const applyExtractedData = (data: ExtractedBranding) => {
    // Apply logos
    if (data.logos) {
      setLogos(prev => ({
        ...prev,
        primary: data.logos.primary || prev.primary,
        favicon: data.logos.favicon || prev.favicon,
      }));
    }
    
    // Apply colors
    if (data.colors) {
      setColors(prev => ({
        ...prev,
        primary: { 
          color: data.colors.primary || prev.primary.color, 
          text: prev.primary.text 
        },
        secondary: { 
          color: data.colors.secondary || prev.secondary.color, 
          text: prev.secondary.text 
        },
        accent: { 
          color: data.colors.accent || prev.accent.color, 
          text: prev.accent.text 
        },
        surfaces: {
          ...prev.surfaces,
          background: data.colors.background || prev.surfaces.background,
        },
        textBase: data.colors.textPrimary || prev.textBase,
      }));
    }
    
    // Apply typography
    if (data.typography) {
      setFonts(prev => ({
        ...prev,
        sans: data.typography.primary || data.typography.fonts?.[0] || prev.sans,
        serif: data.typography.secondary || prev.serif,
      }));
    }
    
    // Apply button colors
    if (data.buttons) {
      setColors(prev => ({
        ...prev,
        buttons: {
          primary: {
            bg: data.buttons?.primaryBg || prev.buttons.primary.bg,
            text: data.buttons?.primaryText || prev.buttons.primary.text,
          },
          secondary: {
            bg: data.buttons?.secondaryBg || prev.buttons.secondary.bg,
            text: data.buttons?.secondaryText || prev.buttons.secondary.text,
          },
        },
      }));
    }
  };

  const handleSave = () => {
    const assets: BrandAssets = {
      // Legacy fields for backwards compatibility
      logo_url: logos.primary || undefined,
      color_palette: {
        primary: colors.primary.color || undefined,
        secondary: colors.secondary.color || undefined,
        accent: colors.accent.color || undefined,
        background: colors.surfaces.background || undefined,
        text: colors.textBase || undefined,
      },
      typography: {
        primary_font: fonts.sans || undefined,
        secondary_font: fonts.serif || undefined,
      },
      visual_style: {
        photography_style: photographyDescription || undefined,
      },
      
      // New expanded fields
      logos: {
        primary: logos.primary || undefined,
        negative: logos.negative || undefined,
        alternative: logos.alternative || undefined,
        favicon: logos.favicon || undefined,
      },
      colors: {
        primary: { color: colors.primary.color || undefined, text: colors.primary.text || undefined },
        secondary: { color: colors.secondary.color || undefined, text: colors.secondary.text || undefined },
        accent: { color: colors.accent.color || undefined, text: colors.accent.text || undefined },
        surfaces: {
          background: colors.surfaces.background || undefined,
          card: colors.surfaces.card || undefined,
          muted: colors.surfaces.muted || undefined,
          border: colors.surfaces.border || undefined,
        },
        textBase: colors.textBase || undefined,
        buttons: {
          primary: { bg: colors.buttons.primary.bg || undefined, text: colors.buttons.primary.text || undefined },
          secondary: { bg: colors.buttons.secondary.bg || undefined, text: colors.buttons.secondary.text || undefined },
        },
      },
      fonts: {
        sans: fonts.sans || undefined,
        serif: fonts.serif || undefined,
        mono: fonts.mono || undefined,
      },
      photography: {
        description: photographyDescription || undefined,
        referenceImages: photographyImages.length > 0 ? photographyImages : undefined,
      },
      emailAssets: {
        headerImage: emailAssets.headerImage || undefined,
        footerImage: emailAssets.footerImage || undefined,
      },
      importedFrom: extractUrl || brandAssets?.importedFrom,
      importedAt: brandAssets?.importedAt,
    };

    updateBrandAssets.mutate(assets);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Extract DNA Section */}
      <div className="space-y-4 p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium">Extrair DNA Visual do Site</Label>
        </div>
        
        <div className="flex gap-2">
          <Input
            value={extractUrl}
            onChange={(e) => setExtractUrl(e.target.value)}
            placeholder="https://exemplo.com.br"
            className="flex-1"
          />
          <Button 
            onClick={handleExtract} 
            disabled={isExtracting || !extractUrl.trim()}
            className="gap-2"
          >
            {isExtracting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Extraindo...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Extrair DNA
              </>
            )}
          </Button>
        </div>
        
        {extractionSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Cores e tipografia extraídos com sucesso!
          </div>
        )}
      </div>

      {/* Logos Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Logotipos</Label>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <LogoUploadCard
            label="Logotipo Principal"
            description="Versão principal para uso geral"
            url={logos.primary}
            onUpload={(url) => setLogos({ ...logos, primary: url })}
            onRemove={() => setLogos({ ...logos, primary: "" })}
            fallback={clientName.charAt(0)}
          />
          <LogoUploadCard
            label="Logotipo Negativo"
            description="Para fundos escuros"
            url={logos.negative}
            onUpload={(url) => setLogos({ ...logos, negative: url })}
            onRemove={() => setLogos({ ...logos, negative: "" })}
            fallback={clientName.charAt(0)}
          />
          <LogoUploadCard
            label="Logotipo Alternativo"
            description="Versão simplificada ou símbolo"
            url={logos.alternative}
            onUpload={(url) => setLogos({ ...logos, alternative: url })}
            onRemove={() => setLogos({ ...logos, alternative: "" })}
            fallback={clientName.charAt(0)}
          />
          <LogoUploadCard
            label="Ícone / Favicon"
            description="Ícone pequeno para navegadores"
            url={logos.favicon}
            onUpload={(url) => setLogos({ ...logos, favicon: url })}
            onRemove={() => setLogos({ ...logos, favicon: "" })}
            fallback={clientName.charAt(0)}
          />
        </div>
      </div>

      {/* Colors Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Paleta de Cores</Label>
        </div>
        
        {/* Main Colors */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cores Principais</Label>
          <div className="grid grid-cols-3 gap-4">
            <ColorWithTextInput
              label="Primária"
              color={colors.primary.color}
              textColor={colors.primary.text}
              onColorChange={(c) => setColors({ ...colors, primary: { ...colors.primary, color: c } })}
              onTextChange={(t) => setColors({ ...colors, primary: { ...colors.primary, text: t } })}
            />
            <ColorWithTextInput
              label="Secundária"
              color={colors.secondary.color}
              textColor={colors.secondary.text}
              onColorChange={(c) => setColors({ ...colors, secondary: { ...colors.secondary, color: c } })}
              onTextChange={(t) => setColors({ ...colors, secondary: { ...colors.secondary, text: t } })}
            />
            <ColorWithTextInput
              label="Destaque"
              color={colors.accent.color}
              textColor={colors.accent.text}
              onColorChange={(c) => setColors({ ...colors, accent: { ...colors.accent, color: c } })}
              onTextChange={(t) => setColors({ ...colors, accent: { ...colors.accent, text: t } })}
            />
          </div>
        </div>
        
        {/* Button Colors */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Botões</Label>
          <div className="grid grid-cols-2 gap-4">
            <ColorWithTextInput
              label="Botão Primário"
              color={colors.buttons.primary.bg}
              textColor={colors.buttons.primary.text}
              onColorChange={(c) => setColors({ 
                ...colors, 
                buttons: { ...colors.buttons, primary: { ...colors.buttons.primary, bg: c } } 
              })}
              onTextChange={(t) => setColors({ 
                ...colors, 
                buttons: { ...colors.buttons, primary: { ...colors.buttons.primary, text: t } } 
              })}
            />
            <ColorWithTextInput
              label="Botão Secundário"
              color={colors.buttons.secondary.bg}
              textColor={colors.buttons.secondary.text}
              onColorChange={(c) => setColors({ 
                ...colors, 
                buttons: { ...colors.buttons, secondary: { ...colors.buttons.secondary, bg: c } } 
              })}
              onTextChange={(t) => setColors({ 
                ...colors, 
                buttons: { ...colors.buttons, secondary: { ...colors.buttons.secondary, text: t } } 
              })}
            />
          </div>
        </div>
        
        {/* Surface Colors */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Superfícies</Label>
          <div className="grid grid-cols-4 gap-4">
            <ColorInput
              label="Background"
              value={colors.surfaces.background}
              onChange={(c) => setColors({ 
                ...colors, 
                surfaces: { ...colors.surfaces, background: c } 
              })}
            />
            <ColorInput
              label="Card"
              value={colors.surfaces.card}
              onChange={(c) => setColors({ 
                ...colors, 
                surfaces: { ...colors.surfaces, card: c } 
              })}
            />
            <ColorInput
              label="Muted"
              value={colors.surfaces.muted}
              onChange={(c) => setColors({ 
                ...colors, 
                surfaces: { ...colors.surfaces, muted: c } 
              })}
            />
            <ColorInput
              label="Texto Base"
              value={colors.textBase}
              onChange={(c) => setColors({ ...colors, textBase: c })}
            />
          </div>
        </div>
      </div>

      {/* Typography Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Tipografia</Label>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sans-serif</Label>
            <Select value={fonts.sans} onValueChange={(v) => setFonts({ ...fonts, sans: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.filter(f => !f.includes("Playfair") && !f.includes("Merriweather") && !f.includes("Lora") && !f.includes("Crimson") && !f.includes("Libre") && !f.includes("Mono") && !f.includes("Fira") && !f.includes("Source Code") && !f.includes("Plex")).map(font => (
                  <SelectItem key={font} value={font}>{font}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Serif</Label>
            <Select value={fonts.serif} onValueChange={(v) => setFonts({ ...fonts, serif: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.filter(f => f.includes("Playfair") || f.includes("Merriweather") || f.includes("Lora") || f.includes("Crimson") || f.includes("Libre")).map(font => (
                  <SelectItem key={font} value={font}>{font}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Monospace</Label>
            <Select value={fonts.mono} onValueChange={(v) => setFonts({ ...fonts, mono: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.filter(f => f.includes("Mono") || f.includes("Fira") || f.includes("Source Code") || f.includes("Plex")).map(font => (
                  <SelectItem key={font} value={font}>{font}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Photography Style Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Estilo Fotográfico</Label>
        </div>
        
        <Textarea
          value={photographyDescription}
          onChange={(e) => setPhotographyDescription(e.target.value)}
          placeholder="Descreva o estilo visual das imagens: iluminação, cores, composição, mood... Ex: 'Fotos minimalistas com luz natural, tons neutros e muito espaço negativo'"
          rows={3}
        />
      </div>

      {/* Email Assets Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Assets de E-mail</Label>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Imagem de Header</Label>
            <AvatarUpload
              currentUrl={emailAssets.headerImage || null}
              onUpload={(url) => setEmailAssets({ ...emailAssets, headerImage: url })}
              fallback="H"
              size="lg"
              bucket="client-files"
              folder="email-assets"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Imagem de Footer</Label>
            <AvatarUpload
              currentUrl={emailAssets.footerImage || null}
              onUpload={(url) => setEmailAssets({ ...emailAssets, footerImage: url })}
              fallback="F"
              size="lg"
              bucket="client-files"
              folder="email-assets"
            />
          </div>
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

// Sub-components
interface LogoUploadCardProps {
  label: string;
  description: string;
  url?: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
  fallback: string;
}

const LogoUploadCard = ({ label, description, url, onUpload, onRemove, fallback }: LogoUploadCardProps) => (
  <div className="p-4 rounded-lg border border-border/50 bg-card/30 space-y-3">
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <div className="flex items-center gap-3">
      <AvatarUpload
        currentUrl={url || null}
        onUpload={onUpload}
        fallback={fallback}
        size="md"
        bucket="client-files"
        folder="brand-logos"
      />
      {url && (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => window.open(url, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  </div>
);

interface ColorWithTextInputProps {
  label: string;
  color: string;
  textColor: string;
  onColorChange: (color: string) => void;
  onTextChange: (text: string) => void;
}

const ColorWithTextInput = ({ label, color, textColor, onColorChange, onTextChange }: ColorWithTextInputProps) => (
  <div className="space-y-2">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          type="color"
          value={color || "#000000"}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-10 h-9 p-1 cursor-pointer"
        />
        <Input
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          placeholder="#FFFFFF"
          className="flex-1 font-mono text-xs"
        />
      </div>
      <Input
        value={textColor}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Cor do texto (auto)"
        className="font-mono text-xs"
      />
    </div>
  </div>
);

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

const ColorInput = ({ label, value, onChange }: ColorInputProps) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="flex gap-2">
      <Input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-9 p-1 cursor-pointer"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#FFFFFF"
        className="flex-1 font-mono text-xs"
      />
    </div>
  </div>
);
