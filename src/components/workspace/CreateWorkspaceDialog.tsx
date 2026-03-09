import { useState, useEffect } from "react";
import { Plus, Loader2, Check, X, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Sistema interno - workspace criado diretamente

export function CreateWorkspaceDialog({ open, onOpenChange }: CreateWorkspaceDialogProps) {
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState("");
  const [slug, setSlug] = useState("");
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isSlugAvailable, setIsSlugAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Generate slug from workspace name
  useEffect(() => {
    const generatedSlug = workspaceName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(generatedSlug);
  }, [workspaceName]);

  // Check slug availability
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setIsSlugAvailable(null);
      return;
    }

    const checkSlug = async () => {
      setIsCheckingSlug(true);
      try {
        const { data, error } = await supabase
          .from("workspaces")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        if (error) throw error;
        setIsSlugAvailable(!data);
      } catch (error) {
        console.error("Error checking slug:", error);
        setIsSlugAvailable(null);
      } finally {
        setIsCheckingSlug(false);
      }
    };

    const debounce = setTimeout(checkSlug, 500);
    return () => clearTimeout(debounce);
  }, [slug]);

  const handleCreateWorkspace = async () => {
    if (!workspaceName || !slug || !isSlugAvailable) {
      toast.error("Preencha todos os campos corretamente");
      return;
    }

    setIsLoading(true);
    try {
      // Sistema interno - criar workspace diretamente
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("workspaces")
        .insert({ name: workspaceName, slug, owner_id: user.id })
        .select("id, slug")
        .single();

      if (error) throw error;

      // Add owner as member
      await supabase.from("workspace_members").insert({
        workspace_id: data.id,
        user_id: user.id,
        role: "owner",
      });

      toast.success("Workspace criado com sucesso!");
      onOpenChange(false);
      navigate(`/kaleidos`);
    } catch (error) {
      console.error("Error creating workspace:", error);
      toast.error("Erro ao criar workspace. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setWorkspaceName("");
    setSlug("");
    setIsSlugAvailable(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) handleReset();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Criar Novo Workspace
          </DialogTitle>
          <DialogDescription>
            Escolha um nome para começar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Workspace Name */}
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Nome do Workspace</Label>
            <Input
              id="workspace-name"
              placeholder="Minha Agência"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="workspace-slug">URL do Workspace</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">app.kaleidos.ai/</span>
              <div className="flex-1 relative">
                <Input
                  id="workspace-slug"
                  placeholder="minha-agencia"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className={cn(
                    "pr-8",
                    isSlugAvailable === true && "border-green-500",
                    isSlugAvailable === false && "border-destructive"
                  )}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {isCheckingSlug && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!isCheckingSlug && isSlugAvailable === true && <Check className="h-4 w-4 text-green-500" />}
                  {!isCheckingSlug && isSlugAvailable === false && <X className="h-4 w-4 text-destructive" />}
                </div>
              </div>
            </div>
            {isSlugAvailable === false && (
              <p className="text-xs text-destructive">Esta URL já está em uso</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleCreateWorkspace}
            disabled={!workspaceName || !slug || !isSlugAvailable || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Criar Workspace
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
