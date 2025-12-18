import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useAIUsage } from "@/hooks/useAIUsage";
import { useWorkspace } from "@/hooks/useWorkspace";
import { User, Zap, CreditCard, TrendingUp, Activity, Sun, Moon, Palette, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "next-themes";
import { TeamManagement } from "@/components/settings/TeamManagement";
import { SecondaryLayout } from "@/components/SecondaryLayout";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useAIUsage(30);
  const { theme, setTheme } = useTheme();
  const { userRole } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Update profile avatar
  const updateAvatar = useMutation({
    mutationFn: async (avatarUrl: string | null) => {
      if (!user?.id) throw new Error("User not found");
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({
        title: "Foto atualizada",
        description: "Sua foto de perfil foi atualizada com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a foto.",
        variant: "destructive",
      });
    },
  });
  
  const isAdmin = userRole === "owner" || userRole === "admin";
  const hasMultipleUsers = stats && Object.keys(stats.byUser).length > 1;

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
    }).format(cost);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  return (
    <SecondaryLayout title="Configurações">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Aparência */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Aparência</CardTitle>
            </div>
            <CardDescription>Personalize a aparência do aplicativo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Moon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Sun className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <Label htmlFor="theme-toggle" className="text-base font-medium">
                    Modo Escuro
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Alternar entre tema claro e escuro
                  </p>
                </div>
              </div>
              <Switch
                id="theme-toggle"
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Time */}
        <TeamManagement />

        {/* Perfil */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Perfil</CardTitle>
            </div>
            <CardDescription>Informações da sua conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <AvatarUpload
                currentUrl={profile?.avatar_url}
                onUpload={(url) => updateAvatar.mutate(url)}
                fallback={user?.email?.slice(0, 2) || "U"}
                size="lg"
                bucket="client-files"
                folder="user-avatars"
              />
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Email</div>
                <div className="text-base">{user?.email || "Não disponível"}</div>
              </div>
            </div>
            <Separator />
            <div className="grid gap-2">
              <div className="text-sm font-medium text-muted-foreground">ID do Usuário</div>
              <div className="text-xs font-mono bg-muted/50 p-2 rounded">{user?.id || "Não disponível"}</div>
            </div>
          </CardContent>
        </Card>

        {/* Uso de IA */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Uso de IA</CardTitle>
            </div>
            <CardDescription>Estatísticas dos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !stats || stats.totalCalls === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhum uso registrado ainda. As estatísticas aparecerão após você usar as funcionalidades de IA.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Resumo Geral */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Activity className="h-4 w-4" />
                      Total de Chamadas
                    </div>
                    <div className="text-2xl font-bold">{formatNumber(stats.totalCalls)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      Tokens Processados
                    </div>
                    <div className="text-2xl font-bold">{formatNumber(stats.totalTokens)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <CreditCard className="h-4 w-4" />
                      Custo Estimado
                    </div>
                    <div className="text-2xl font-bold">{formatCost(stats.totalCost)}</div>
                  </div>
                </div>

                {/* Detalhes */}
                <Tabs defaultValue="models" className="w-full">
                  <TabsList className={`grid w-full ${isAdmin && hasMultipleUsers ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    <TabsTrigger value="models">Por Modelo</TabsTrigger>
                    <TabsTrigger value="providers">Por Provider</TabsTrigger>
                    <TabsTrigger value="functions">Por Função</TabsTrigger>
                    {isAdmin && hasMultipleUsers && (
                      <TabsTrigger value="users">Por Membro</TabsTrigger>
                    )}
                  </TabsList>
                  
                  <TabsContent value="models" className="space-y-3 mt-4">
                    {Object.entries(stats.byModel).map(([model, data]) => (
                      <div key={model} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{model}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatNumber(data.calls)} chamadas · {formatNumber(data.tokens)} tokens
                          </div>
                        </div>
                        <div className="text-sm font-semibold">{formatCost(data.cost)}</div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="providers" className="space-y-3 mt-4">
                    {Object.entries(stats.byProvider).map(([provider, data]) => (
                      <div key={provider} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex-1">
                          <div className="font-medium text-sm capitalize">{provider}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatNumber(data.calls)} chamadas · {formatNumber(data.tokens)} tokens
                          </div>
                        </div>
                        <div className="text-sm font-semibold">{formatCost(data.cost)}</div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="functions" className="space-y-3 mt-4">
                    {Object.entries(stats.byFunction).map(([func, data]) => (
                      <div key={func} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{func}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatNumber(data.calls)} chamadas · {formatNumber(data.tokens)} tokens
                          </div>
                        </div>
                        <div className="text-sm font-semibold">{formatCost(data.cost)}</div>
                      </div>
                    ))}
                  </TabsContent>

                  {isAdmin && hasMultipleUsers && (
                    <TabsContent value="users" className="space-y-3 mt-4">
                      {Object.entries(stats.byUser)
                        .sort((a, b) => b[1].cost - a[1].cost)
                        .map(([userId, data]) => (
                          <div key={userId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium text-sm">
                                  {data.fullName || data.email || userId.slice(0, 8)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatNumber(data.calls)} chamadas · {formatNumber(data.tokens)} tokens
                                </div>
                              </div>
                            </div>
                            <div className="text-sm font-semibold">{formatCost(data.cost)}</div>
                          </div>
                        ))}
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gastos */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Resumo de Gastos</CardTitle>
            </div>
            <CardDescription>Análise de custos dos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : !stats || stats.totalCalls === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhum gasto registrado. Os custos serão calculados automaticamente conforme você usa a plataforma.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Total Gasto (30 dias)</div>
                    <div className="text-3xl font-bold">{formatCost(stats.totalCost)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground mb-1">Média por Chamada</div>
                    <div className="text-lg font-semibold">
                      {formatCost(stats.totalCost / stats.totalCalls)}
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider mais usado:</span>
                    <span className="font-medium capitalize">
                      {Object.entries(stats.byProvider).sort((a, b) => b[1].calls - a[1].calls)[0]?.[0] || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modelo mais usado:</span>
                    <span className="font-medium">
                      {Object.entries(stats.byModel).sort((a, b) => b[1].calls - a[1].calls)[0]?.[0] || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Função mais usada:</span>
                    <span className="font-medium">
                      {Object.entries(stats.byFunction).sort((a, b) => b[1].calls - a[1].calls)[0]?.[0] || "-"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SecondaryLayout>
  );
}
