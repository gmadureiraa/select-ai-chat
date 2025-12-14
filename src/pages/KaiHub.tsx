import { useState, useEffect } from "react";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  Bot, BarChart3, Library, Zap, Settings, ChevronDown, Check, 
  User, Activity, BookOpen, Send, Hammer, FlaskConical, LogOut,
  Plus
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
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { CommandPalette } from "@/components/ui/command-palette";
import KaleidosLogo from "@/assets/kaleidos-logo.svg";

const KaiHub = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    searchParams.get("client") || localStorage.getItem("kai-selected-client")
  );
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "assistant");
  const [clientSelectorOpen, setClientSelectorOpen] = useState(false);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  
  const { clients, isLoading } = useClients();
  const { user, signOut } = useAuth();
  
  const { scrollDirection, isAtTop } = useScrollDirection();
  
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
  // Keyboard shortcut for command palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

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
    { id: "settings", label: "Configurações", icon: Settings },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="w-full space-y-6">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-[calc(100vh-120px)] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Client Selector */}
      <header 
        className={cn(
          "border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50 transition-transform duration-300",
          scrollDirection === "down" && !isAtTop ? "-translate-y-full" : "translate-y-0"
        )}
      >
        <div className="w-full px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            {/* Kaleidos Logo */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-primary flex items-center justify-center">
                <img src={KaleidosLogo} alt="Kaleidos" className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base sm:text-lg tracking-tight">kAI</span>
                <span className="text-[9px] sm:text-[10px] text-muted-foreground -mt-0.5 sm:-mt-1 hidden sm:block">by Kaleidos</span>
              </div>
            </div>

            {/* Separator */}
            <div className="h-6 sm:h-8 w-px bg-border/50 hidden sm:block" />
            
            {/* Client Selector */}
            <Popover open={clientSelectorOpen} onOpenChange={setClientSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  role="combobox"
                  aria-expanded={clientSelectorOpen}
                  className="min-w-0 sm:min-w-[180px] lg:min-w-[220px] justify-between h-9 sm:h-10 px-2 sm:px-4 hover:bg-muted/50"
                >
                  {selectedClient ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] sm:text-xs font-semibold text-primary">
                          {selectedClient.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="truncate font-medium text-sm sm:text-base max-w-[100px] sm:max-w-none">{selectedClient.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Selecionar...</span>
                  )}
                  <ChevronDown className="ml-1 sm:ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." className="h-11" />
                  <CommandList className="max-h-[300px]">
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
                          className="py-3"
                        >
                          <div className="flex items-center gap-3 w-full">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-sm font-semibold text-primary">
                                {client.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-medium">{client.name}</span>
                              {client.description && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {client.description}
                                </span>
                              )}
                            </div>
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0",
                                selectedClientId === client.id ? "opacity-100 text-primary" : "opacity-0"
                              )}
                            />
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
              size="sm"
              onClick={() => setClientDialogOpen(true)}
              className="h-8 sm:h-9 gap-2 text-muted-foreground hover:text-foreground shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden lg:inline">Novo Cliente</span>
            </Button>
          </div>

          {/* Right Side Menu */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">

            {/* Theme Toggle */}
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 sm:h-9 gap-1 sm:gap-2 text-muted-foreground hover:text-foreground px-2 sm:px-3">
                  <Hammer className="h-4 w-4" />
                  <span className="hidden xl:inline">Ferramentas</span>
                  <ChevronDown className="h-3 w-3 hidden sm:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem 
                  onClick={() => setActiveTab("automations")} 
                  className="py-2.5"
                  disabled={!selectedClient}
                >
                  <Zap className="h-4 w-4 mr-3" />
                  Automações
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/social-publisher")} className="py-2.5">
                  <Send className="h-4 w-4 mr-3" />
                  Publicador Social
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/agent-builder")} className="py-2.5">
                  <Hammer className="h-4 w-4 mr-3" />
                  Agent Builder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/research-lab")} className="py-2.5">
                  <FlaskConical className="h-4 w-4 mr-3" />
                  Laboratório de Pesquisa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/knowledge-base")} className="py-2.5">
                  <BookOpen className="h-4 w-4 mr-3" />
                  Base de Conhecimento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/activities")} className="py-2.5">
                  <Activity className="h-4 w-4 mr-3" />
                  Atividades
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 sm:h-9 px-1.5 sm:px-2 gap-2">
                  <Avatar className="h-6 w-6 sm:h-7 sm:w-7">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px] sm:text-xs font-medium">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
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
                <DropdownMenuItem onClick={() => navigate("/settings")} className="py-2.5">
                  <User className="h-4 w-4 mr-3" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive py-2.5">
                  <LogOut className="h-4 w-4 mr-3" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Client Dialog */}
      <ClientDialog open={clientDialogOpen} onOpenChange={setClientDialogOpen} />

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectClient={(clientId) => setSelectedClientId(clientId)}
        onSelectTab={(tab) => setActiveTab(tab)}
      />

      {/* Main Content */}
      <main className="flex-1">
        {!selectedClient ? (
          /* Client Selection Empty State */
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-6">
            <div className="text-center max-w-lg space-y-6">
              <div className="h-20 w-20 rounded-2xl bg-primary flex items-center justify-center mx-auto">
                <img src={KaleidosLogo} alt="Kaleidos" className="h-12 w-12" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">Bem-vindo ao kAI</h1>
                <p className="text-muted-foreground text-lg">
                  Selecione um cliente para começar a trabalhar com o assistente inteligente.
                </p>
              </div>
              
              {/* Quick Client Cards */}
              {clients && clients.length > 0 && (
                <div className="grid gap-2 pt-4 max-w-md mx-auto">
                  {clients.slice(0, 5).map((client) => (
                    <Button
                      key={client.id}
                      variant="outline"
                      className="justify-start h-auto py-4 px-5 hover:bg-primary/5 hover:border-primary/30 transition-all"
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <div className="flex items-center gap-4 w-full">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-base font-semibold text-primary">
                            {client.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex flex-col items-start text-left">
                          <span className="font-medium">{client.name}</span>
                          {client.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[280px]">
                              {client.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Client Hub with Tabs */
          <div className="w-full">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Tab Navigation */}
              <div className={cn(
                "border-b border-border/50 bg-card/30 backdrop-blur-md sticky z-40 overflow-x-auto transition-transform duration-300",
                scrollDirection === "down" && !isAtTop ? "-translate-y-full top-0" : "translate-y-0 top-[49px] sm:top-[57px]"
              )}>
                <div className="px-3 sm:px-6">
                  <TabsList className="h-10 sm:h-12 bg-transparent gap-1 sm:gap-2 p-0 inline-flex min-w-max">
                    {tabs.map((tab) => (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none px-2.5 sm:px-5 py-2 sm:py-2.5 gap-1.5 sm:gap-2.5 rounded-lg font-medium transition-all text-xs sm:text-sm"
                      >
                        <tab.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden xs:inline sm:inline">{tab.label}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-3 sm:p-6">
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
