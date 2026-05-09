// MetricoolCalendarView — calendário editorial com eventos sociais Metricool
// (datas comemorativas, holidays, eventos de calendars system + user).
//
// Calendar mensal (DayPicker) com indicadores nos dias que têm eventos.
// Click numa data → popover com lista. Botão "Adicionar calendário" abre
// dialog pra atribuir um system calendar OU criar user calendar via ICS.
import { useMemo, useState } from 'react';
import {
  useMetricoolSystemCalendars,
  useMetricoolAssignedCalendars,
  useMetricoolCalendarEvents,
  useAssignMetricoolCalendar,
  useUnassignMetricoolCalendar,
  useCreateMetricoolCalendar,
  type MetricoolCalendar,
  type MetricoolCalendarEvent,
} from '@/hooks/useMetricoolCalendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar as CalendarIcon,
  Loader2,
  Plus,
  Globe2,
  Link as LinkIcon,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  clientId: string;
  /**
   * Gap #8 — callback opcional pra criar planning item ancorado num dia.
   * Quando passado, popover de dia mostra botão "Criar planning nesse dia".
   * Caller pode pre-preencher título com nome de evento (ex: data comemorativa).
   */
  onCreatePlanningItem?: (date: Date, eventTitle?: string) => void;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function isoNoTz(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function MetricoolCalendarView({ clientId, onCreatePlanningItem }: Props) {
  const { toast } = useToast();
  const [month, setMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);

  // User calendar form
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');

  const { data: systemCalendars = [], isLoading: loadingSystem } =
    useMetricoolSystemCalendars('pt');
  const { data: assignedCalendars = [], isLoading: loadingAssigned } =
    useMetricoolAssignedCalendars(clientId, 'pt');

  const assignedIds = useMemo(
    () => assignedCalendars.map((c) => c.id),
    [assignedCalendars],
  );

  const periodInit = useMemo(() => isoNoTz(startOfMonth(month)), [month]);
  const periodEnd = useMemo(() => isoNoTz(endOfMonth(month)), [month]);

  const { data: events = [], isLoading: loadingEvents } = useMetricoolCalendarEvents({
    clientId,
    calendarIds: assignedIds,
    initDate: periodInit,
    endDate: periodEnd,
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, MetricoolCalendarEvent[]>();
    for (const ev of events) {
      if (!ev.eventInit) continue;
      try {
        const d = new Date(ev.eventInit);
        const key = dayKey(d);
        const arr = map.get(key) || [];
        arr.push(ev);
        map.set(key, arr);
      } catch {
        // skip bad date
      }
    }
    return map;
  }, [events]);

  const eventDayDates = useMemo(
    () =>
      Array.from(eventsByDay.keys()).map((k) => {
        const [y, m, d] = k.split('-').map(Number);
        return new Date(y, m - 1, d);
      }),
    [eventsByDay],
  );

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDay.get(dayKey(selectedDate)) || [];
  }, [selectedDate, eventsByDay]);

  const assignMutation = useAssignMetricoolCalendar(clientId);
  const unassignMutation = useUnassignMetricoolCalendar(clientId);
  const createMutation = useCreateMetricoolCalendar(clientId);

  const handleAssign = async (calendarId: number) => {
    try {
      await assignMutation.mutateAsync(calendarId);
      toast({ title: 'Calendário adicionado' });
    } catch (e: any) {
      toast({
        title: 'Erro',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const handleUnassign = async (calendarId: number) => {
    try {
      await unassignMutation.mutateAsync(calendarId);
      toast({ title: 'Calendário removido' });
    } catch (e: any) {
      toast({
        title: 'Erro',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !url.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e URL ICS são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        url: url.trim(),
        description: description.trim() || undefined,
        language: 'pt',
        publicCalendar: false,
      });
      toast({
        title: 'Calendário criado',
        description: 'Eventos do ICS aparecerão em alguns segundos.',
      });
      setCreateOpen(false);
      setName('');
      setUrl('');
      setDescription('');
    } catch (e: any) {
      toast({
        title: 'Erro ao criar calendário',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const totalAssigned = assignedCalendars.length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" /> Calendário Editorial
              </CardTitle>
              <CardDescription>
                Datas comemorativas, holidays e eventos sociais para planejar conteúdo.
                {totalAssigned > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    {totalAssigned} calendário{totalAssigned === 1 ? '' : 's'} ativo
                    {totalAssigned === 1 ? '' : 's'}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={browseOpen} onOpenChange={setBrowseOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Globe2 className="h-3.5 w-3.5 mr-1.5" /> Calendários disponíveis
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Calendários disponíveis</DialogTitle>
                    <DialogDescription>
                      Escolha calendários da Metricool (datas comemorativas BR, holidays,
                      etc) ou veja os já ativos.
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="active">
                    <TabsList>
                      <TabsTrigger value="active">
                        Ativos <Badge variant="secondary" className="ml-2">{assignedCalendars.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="catalog">
                        Catálogo <Badge variant="secondary" className="ml-2">{systemCalendars.length}</Badge>
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="active" className="mt-3">
                      <ScrollArea className="h-[360px] pr-3">
                        {loadingAssigned && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                          </div>
                        )}
                        {!loadingAssigned && assignedCalendars.length === 0 && (
                          <div className="text-sm text-muted-foreground text-center p-8 border border-dashed rounded-md">
                            Nenhum calendário ativo ainda.
                          </div>
                        )}
                        <div className="space-y-2">
                          {assignedCalendars.map((c: MetricoolCalendar) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between gap-3 rounded-md border p-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm truncate">
                                  {c.name || 'Sem nome'}
                                </div>
                                {c.description && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {c.description}
                                  </div>
                                )}
                                <Badge variant="outline" className="text-[10px] mt-1">
                                  {c.type === 'USER' ? 'Personalizado' : 'Sistema'}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnassign(c.id)}
                                disabled={unassignMutation.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent value="catalog" className="mt-3">
                      <ScrollArea className="h-[360px] pr-3">
                        {loadingSystem && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                          </div>
                        )}
                        <div className="space-y-2">
                          {systemCalendars.map((c: MetricoolCalendar) => {
                            const already = assignedIds.includes(c.id);
                            return (
                              <div
                                key={c.id}
                                className="flex items-center justify-between gap-3 rounded-md border p-2.5"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm truncate">
                                    {c.name || 'Sem nome'}
                                  </div>
                                  {c.description && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {c.description}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  variant={already ? 'secondary' : 'outline'}
                                  size="sm"
                                  disabled={already || assignMutation.isPending}
                                  onClick={() => handleAssign(c.id)}
                                >
                                  {already ? 'Adicionado' : 'Adicionar'}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>

              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar ICS
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar calendário ao cliente</DialogTitle>
                    <DialogDescription>
                      Cole a URL pública .ics (Google Calendar, Outlook, etc).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cal-name">Nome</Label>
                      <Input
                        id="cal-name"
                        placeholder="ex: Eventos do cliente"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cal-url">URL ICS</Label>
                      <div className="relative">
                        <LinkIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          id="cal-url"
                          className="pl-8"
                          placeholder="https://calendar.google.com/.../basic.ics"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cal-desc">Descrição (opcional)</Label>
                      <Textarea
                        id="cal-desc"
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setCreateOpen(false)}
                      disabled={createMutation.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleCreate} disabled={createMutation.isPending}>
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Criando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Calendar mensal */}
            <div className="shrink-0">
              <Popover
                open={!!selectedDate}
                onOpenChange={(o) => {
                  if (!o) setSelectedDate(null);
                }}
              >
                <PopoverTrigger asChild>
                  {/* Trigger fantasma posicionado no anchor; usamos Calendar como visual */}
                  <span className="sr-only">Selecionar data</span>
                </PopoverTrigger>
                <Calendar
                  mode="single"
                  selected={selectedDate ?? undefined}
                  onSelect={(d) => setSelectedDate(d ?? null)}
                  month={month}
                  onMonthChange={setMonth}
                  locale={ptBR}
                  modifiers={{ hasEvent: eventDayDates }}
                  modifiersClassNames={{
                    hasEvent:
                      'relative font-semibold after:content-[""] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary',
                  }}
                />
                {selectedDate && (
                  <PopoverContent
                    className="w-80 p-0"
                    side="bottom"
                    align="center"
                    sideOffset={8}
                  >
                    <div className="p-3 border-b space-y-2">
                      <div>
                        <div className="text-sm font-semibold">
                          {format(selectedDate, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {selectedDayEvents.length === 0
                            ? 'Sem eventos nesse dia'
                            : `${selectedDayEvents.length} evento${
                                selectedDayEvents.length === 1 ? '' : 's'
                              }`}
                        </div>
                      </div>
                      {onCreatePlanningItem && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-xs"
                          onClick={() => {
                            const firstEvent = selectedDayEvents[0];
                            onCreatePlanningItem(selectedDate, firstEvent?.name);
                            setSelectedDate(null);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Criar planning nesse dia
                        </Button>
                      )}
                    </div>
                    <ScrollArea className="max-h-72">
                      <div className="p-2 space-y-1">
                        {selectedDayEvents.length === 0 && (
                          <div className="text-xs text-muted-foreground p-3 text-center">
                            Sem datas comemorativas ou eventos.
                          </div>
                        )}
                        {selectedDayEvents.map((ev, i) => (
                          <div
                            key={`${ev.uid || i}`}
                            className="rounded-md border p-2 hover:bg-muted/30"
                          >
                            <div className="text-sm font-medium">{ev.name || 'Evento'}</div>
                            {ev.description && (
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {ev.description}
                              </div>
                            )}
                            {ev.calendarId !== undefined && (
                              <Badge variant="outline" className="text-[10px] mt-1">
                                Cal #{ev.calendarId}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                )}
              </Popover>
            </div>

            {/* Lista de eventos do mês */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium mb-2">
                Eventos de {format(month, 'MMMM yyyy', { locale: ptBR })}
                {loadingEvents && (
                  <Loader2 className="inline-block h-3 w-3 animate-spin ml-2 text-muted-foreground" />
                )}
              </div>
              {!loadingEvents && events.length === 0 && (
                <div className="text-sm text-muted-foreground text-center p-8 border border-dashed rounded-md">
                  {assignedCalendars.length === 0
                    ? 'Adicione um calendário pra ver eventos sociais aqui.'
                    : 'Sem eventos nesse mês.'}
                </div>
              )}
              {!loadingEvents && events.length > 0 && (
                <ScrollArea className="h-[420px] pr-3">
                  <div className="space-y-1.5">
                    {events
                      .slice()
                      .sort((a, b) =>
                        (a.eventInit || '').localeCompare(b.eventInit || ''),
                      )
                      .map((ev, i) => {
                        const dt = ev.eventInit ? new Date(ev.eventInit) : null;
                        return (
                          <button
                            key={`${ev.uid || i}`}
                            type="button"
                            onClick={() => dt && setSelectedDate(dt)}
                            className="w-full text-left rounded-md border p-2.5 hover:bg-muted/30 transition flex items-start gap-3"
                          >
                            <div className="text-center shrink-0 w-12">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {dt ? format(dt, 'MMM', { locale: ptBR }) : '—'}
                              </div>
                              <div className="text-lg font-semibold leading-none">
                                {dt ? format(dt, 'dd') : '?'}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">
                                {ev.name || 'Evento'}
                              </div>
                              {ev.description && (
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {ev.description}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 mt-1">
                                {dt && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(dt, "EEE",  { locale: ptBR })}
                                  </span>
                                )}
                                {ev.dailyEvent && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Dia inteiro
                                  </Badge>
                                )}
                                {ev.repeatEvent && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Recorrente
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
