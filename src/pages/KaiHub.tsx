import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  Bot, BarChart3, Library, Zap, Settings, ChevronDown, Check, 
  User, Activity, BookOpen, Send, Hammer, FlaskConical, LogOut,
  Plus, MoreVertical
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { KaiAssistantTab } from "@/components/kai/KaiAssistantTab";
import { KaiPerformanceTab } from "@/components/kai/KaiPerformanceTab";
import { KaiLibraryTab } from "@/components/kai/KaiLibraryTab";
import { KaiAutomationsTab } from "@/components/kai/KaiAutomationsTab";
import { KaiSettingsTab } from "@/components/kai/KaiSettingsTab";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ClientDialog } from "@/components/clients/ClientDialog";

const KaiHub = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    searchParams.get("client") || localStorage.getItem("kai-selected-client")
  );
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "assistant");
  const [clientSelectorOpen, setClientSelectorOpen] = useState(false);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  
  const { clients, isLoading } = useClients();
  const { user, signOut } = useAuth();
  
  const selectedClient = clients?.find(c => c.id === selectedClientId);
  
  const userInitials = user?.email?.substring(0, 2).toUpperCase() || "KA";

  // Persist client selection
  useEffect(() => {
    if (selectedClientId) {
      localStorage.setItem("kai-selected-client", selectedClientId);
      setSearchParams(prev => {
        prev.set("client", selectedClientId);
        return prev;
      });
    }
  }, [selectedClientId, setSearchParams]);

  // Update URL when tab changes
  useEffect(() => {
    setSearchParams(prev => {
      prev.set("tab", activeTab);
      return prev;
    });
  }, [activeTab, setSearchParams]);

  const tabs = [
    { id: "assistant", label: "Assistente", icon: Bot },
    { id: "performance", label: "Performance", icon: BarChart3 },
    { id: "library", label: "Biblioteca", icon: Library },
    { id: "automations", label: "Automações", icon: Zap },
    { id: "settings", label: "Configurações", icon: Settings },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Client Selector */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <span className="font-semibold text-lg">kAI</span>
            </div>
            
            {/* Client Selector */}
            <Popover open={clientSelectorOpen} onOpenChange={setClientSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientSelectorOpen}
                  className="min-w-[200px] justify-between"
                >
                  {selectedClient ? (
                    <span className="truncate">{selectedClient.name}</span>
                  ) : (
                    <span className="text-muted-foreground">Selecionar cliente...</span>
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {clients?.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.name}
                          onSelect={() => {
                            setSelectedClientId(client.id);
                            setClientSelectorOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedClientId === client.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{client.name}</span>
                            {client.description && (
                              <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                                {client.description}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Add Client Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setClientDialogOpen(true)}
              className="h-9 w-9"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Right Side Menu */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Ferramentas</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate("/social-publisher")}>
                  <Send className="h-4 w-4 mr-2" />
                  Publicador Social
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/agent-builder")}>
                  <Hammer className="h-4 w-4 mr-2" />
                  Agent Builder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/research")}>
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Laboratório de Pesquisa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Sistema</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate("/knowledge-base")}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Base de Conhecimento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/activities")}>
                  <Activity className="h-4 w-4 mr-2" />
                  Atividades
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 px-2 gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">Conta Kaleidos</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <User className="h-4 w-4 mr-2" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Client Dialog */}
      <ClientDialog open={clientDialogOpen} onOpenChange={setClientDialogOpen} />

      {/* Main Content */}
      <main className="flex-1">
        {!selectedClient ? (
          /* Client Selection Empty State */
          <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
            <div className="text-center max-w-md space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Bem-vindo ao kAI</h1>
              <p className="text-muted-foreground">
                Selecione um cliente no menu acima para começar a trabalhar com o assistente, 
                analisar performance, gerenciar conteúdo e automações.
              </p>
              
              {/* Quick Client Cards */}
              <div className="grid gap-2 pt-4">
                {clients?.slice(0, 5).map((client) => (
                  <Button
                    key={client.id}
                    variant="outline"
                    className="justify-start h-auto py-3 px-4"
                    onClick={() => setSelectedClientId(client.id)}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{client.name}</span>
                      {client.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {client.description}
                        </span>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Client Hub with Tabs */
          <div className="max-w-7xl mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Tab Navigation */}
              <div className="border-b bg-card/30 sticky top-[57px] z-40">
                <div className="px-4">
                  <TabsList className="h-12 bg-transparent gap-1 p-0">
                    {tabs.map((tab) => (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-2 gap-2 rounded-lg"
                      >
                        <tab.icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-4">
                <TabsContent value="assistant" className="mt-0 focus-visible:outline-none">
                  <KaiAssistantTab clientId={selectedClientId} client={selectedClient} />
                </TabsContent>
                
                <TabsContent value="performance" className="mt-0 focus-visible:outline-none">
                  <KaiPerformanceTab clientId={selectedClientId} client={selectedClient} />
                </TabsContent>
                
                <TabsContent value="library" className="mt-0 focus-visible:outline-none">
                  <KaiLibraryTab clientId={selectedClientId} client={selectedClient} />
                </TabsContent>
                
                <TabsContent value="automations" className="mt-0 focus-visible:outline-none">
                  <KaiAutomationsTab clientId={selectedClientId} client={selectedClient} />
                </TabsContent>
                
                <TabsContent value="settings" className="mt-0 focus-visible:outline-none">
                  <KaiSettingsTab clientId={selectedClientId} client={selectedClient} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
};

export default KaiHub;
