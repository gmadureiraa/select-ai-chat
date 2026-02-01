import { useState, useEffect } from "react";
import { useSuperAdmin, useWorkspaceDetailsAdmin } from "@/hooks/useSuperAdmin";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FormatMetricsDashboard from "@/components/admin/FormatMetricsDashboard";
import { 
  Building2, 
  Users, 
  UserCircle, 
  Coins, 
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Shield,
  Calendar,
  CreditCard,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { 
    isSuperAdmin, 
    isLoading, 
    workspaces, 
    isLoadingWorkspaces,
  } = useSuperAdmin();

  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  
  // Use React Query hook for workspace details
  const { details, members, clients, memberTokens, isLoading: isLoadingDetails } = useWorkspaceDetailsAdmin(selectedWorkspace);

  // Get last used workspace slug from localStorage
  const getLastWorkspaceSlug = (): string => {
    try {
      const stored = localStorage.getItem("kaleidos_last_workspace_slug");
      return stored || "kai";
    } catch {
      return "kai";
    }
  };

  // Redirect if not super-admin
  useEffect(() => {
    if (!isLoading && !isSuperAdmin) {
      navigate(`/${getLastWorkspaceSlug()}`);
    }
  }, [isLoading, isSuperAdmin, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  const totalMembers = workspaces.reduce((sum, w) => sum + w.members_count, 0);
  const totalClients = workspaces.reduce((sum, w) => sum + w.clients_count, 0);

  const roleColors: Record<string, string> = {
    owner: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    admin: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    member: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    viewer: "bg-muted text-muted-foreground border-border",
  };

  // Get member token usage
  const getMemberTokenUsage = (userId: string): number => {
    const found = memberTokens?.find(m => m.user_id === userId);
    return found?.tokens_used || 0;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Painel Super Admin</h1>
                <p className="text-sm text-muted-foreground">Gerenciamento de todos os workspaces</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate(`/${getLastWorkspaceSlug()}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao App
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <Tabs defaultValue="workspaces" className="space-y-6">
          <TabsList>
            <TabsTrigger value="workspaces" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Workspaces
            </TabsTrigger>
            <TabsTrigger value="formats" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Métricas de Formatos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workspaces" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Workspaces</p>
                      <p className="text-2xl font-bold">{workspaces.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10">
                      <Users className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Membros Total</p>
                      <p className="text-2xl font-bold">{totalMembers}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-green-500/10">
                      <UserCircle className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Clientes Total</p>
                      <p className="text-2xl font-bold">{totalClients}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workspaces List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Workspaces</CardTitle>
              <CardDescription>Selecione para ver detalhes</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {isLoadingWorkspaces ? (
                  <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="divide-y">
                    {workspaces.map((workspace) => (
                      <button
                        key={workspace.id}
                        onClick={() => setSelectedWorkspace(workspace.id)}
                        className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                          selectedWorkspace === workspace.id ? "bg-muted" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="font-medium">{workspace.name}</p>
                            <p className="text-sm text-muted-foreground">/{workspace.slug}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {workspace.members_count}
                              </span>
                              <span className="flex items-center gap-1">
                                <UserCircle className="h-3 w-3" />
                                {workspace.clients_count}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Workspace Details */}
          <Card className="lg:col-span-2">
            {selectedWorkspace ? (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {details?.workspace_name || "Carregando..."}
                      </CardTitle>
                      <CardDescription>
                        {details?.owner_email || "..."}
                      </CardDescription>
                    </div>
                    {details?.workspace_slug && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/${details.workspace_slug}`)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Acessar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingDetails ? (
                    <div className="space-y-4">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-40 w-full" />
                    </div>
                  ) : (
                    <>
                      {/* Plan & Tokens Info */}
                      {details && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 rounded-lg bg-muted/50 space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CreditCard className="h-4 w-4" />
                              Plano
                            </div>
                            <p className="font-medium">{details.plan_name || "Sem plano"}</p>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/50 space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Coins className="h-4 w-4" />
                              Tokens
                            </div>
                            <p className="font-medium">
                              {details.tokens_balance?.toLocaleString() || 0}
                            </p>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/50 space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <TrendingUp className="h-4 w-4" />
                              Usados
                            </div>
                            <p className="font-medium">
                              {details.tokens_used?.toLocaleString() || 0}
                            </p>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/50 space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              Renova
                            </div>
                            <p className="font-medium text-sm">
                              {details.current_period_end 
                                ? format(new Date(details.current_period_end), "dd/MM/yy", { locale: ptBR })
                                : "-"
                              }
                            </p>
                          </div>
                        </div>
                      )}

                      <Separator />

                      {/* Team Members with Token Usage */}
                      <div>
                        <h3 className="font-medium mb-3 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Equipe ({members?.length || 0})
                        </h3>
                        <div className="space-y-2">
                          {members?.map((member) => {
                            const tokenUsage = getMemberTokenUsage(member.user_id);
                            return (
                              <div
                                key={member.member_id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                              >
                                <div className="flex-1">
                                  <p className="font-medium">{member.full_name || member.email}</p>
                                  <p className="text-sm text-muted-foreground">{member.email}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Tokens</p>
                                    <p className="text-sm font-medium">{tokenUsage.toLocaleString()}</p>
                                  </div>
                                  <Badge variant="outline" className={roleColors[member.role] || ""}>
                                    {member.role}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <Separator />

                      {/* Clients */}
                      <div>
                        <h3 className="font-medium mb-3 flex items-center gap-2">
                          <UserCircle className="h-4 w-4" />
                          Clientes ({clients?.length || 0})
                        </h3>
                        {clients?.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {clients?.map((client) => (
                              <div
                                key={client.client_id}
                                className="p-3 rounded-lg bg-muted/30"
                              >
                                <p className="font-medium">{client.client_name}</p>
                                {client.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">
                                    {client.description}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </>
            ) : (
              <div className="flex items-center justify-center h-[600px] text-muted-foreground">
                <div className="text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione um workspace para ver os detalhes</p>
                </div>
              </div>
            )}
          </Card>
            </div>
          </TabsContent>

          <TabsContent value="formats">
            <FormatMetricsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
