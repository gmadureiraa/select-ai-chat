// Metricool Calendar — system + user calendars com eventos sociais
// (datas comemorativas, holidays). Pra calendário editorial.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '../lib/apiInvoke';

export interface MetricoolCalendar {
  id: number;
  url?: string;
  name?: string;
  description?: string;
  publicCalendar?: boolean;
  timeZone?: string;
  language?: string;
  type?: 'SYSTEM' | 'USER';
  events?: MetricoolCalendarEvent[];
  [key: string]: unknown;
}

export interface MetricoolCalendarEvent {
  name?: string;
  description?: string;
  eventInit?: string;
  eventEnd?: string;
  repeatEvent?: boolean;
  dailyEvent?: boolean;
  uid?: string;
  calendarId?: number | string;
  calendarName?: string;
  [key: string]: unknown;
}

const TEN_MIN = 1000 * 60 * 10;

export function useMetricoolSystemCalendars(language = 'pt') {
  return useQuery({
    queryKey: ['metricool-calendar', 'system', language],
    queryFn: async (): Promise<MetricoolCalendar[]> => {
      const { data, error } = await apiInvoke('metricool-calendar', {
        body: { mode: 'list', language },
      });
      if (error) throw error;
      return ((data as any)?.calendars || []) as MetricoolCalendar[];
    },
    staleTime: TEN_MIN,
  });
}

export function useMetricoolAssignedCalendars(clientId: string, language = 'pt') {
  return useQuery({
    queryKey: ['metricool-calendar', clientId, 'assigned', language],
    queryFn: async (): Promise<MetricoolCalendar[]> => {
      const { data, error } = await apiInvoke('metricool-calendar', {
        body: { clientId, mode: 'assigned', language },
      });
      if (error) throw error;
      return ((data as any)?.calendars || []) as MetricoolCalendar[];
    },
    enabled: !!clientId,
    staleTime: TEN_MIN,
  });
}

export interface UseEventsArgs {
  clientId: string;
  calendarIds: Array<string | number>;
  initDate: string; // YYYY-MM-DDTHH:mm:ss
  endDate: string;
  timeZone?: string;
}

/** Eventos agregados de múltiplos calendários no período. */
export function useMetricoolCalendarEvents({
  clientId,
  calendarIds,
  initDate,
  endDate,
  timeZone = 'America/Sao_Paulo',
}: UseEventsArgs) {
  return useQuery({
    queryKey: [
      'metricool-calendar',
      clientId,
      'events',
      calendarIds.map(String).sort().join(','),
      initDate,
      endDate,
      timeZone,
    ],
    queryFn: async (): Promise<MetricoolCalendarEvent[]> => {
      if (!calendarIds.length) return [];
      const { data, error } = await apiInvoke('metricool-calendar', {
        body: {
          clientId,
          mode: 'events-multi',
          calendarIds,
          initDate,
          endDate,
          timeZone,
        },
      });
      if (error) throw error;
      return ((data as any)?.events || []) as MetricoolCalendarEvent[];
    },
    enabled: !!clientId && calendarIds.length > 0,
    staleTime: TEN_MIN,
  });
}

export interface CreateUserCalendarVars {
  name: string;
  url: string;
  description?: string;
  language?: string;
  publicCalendar?: boolean;
}

export function useCreateMetricoolCalendar(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: CreateUserCalendarVars) => {
      const { data, error } = await apiInvoke('metricool-calendar', {
        body: { clientId, mode: 'create', ...vars },
      });
      if (error) throw error;
      return (data as any)?.calendar as MetricoolCalendar;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metricool-calendar', clientId, 'assigned'] });
    },
  });
}

export function useAssignMetricoolCalendar(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calendarId: string | number) => {
      const { error } = await apiInvoke('metricool-calendar', {
        body: { clientId, mode: 'assign', calendarId, aggregationFrom: 'blog' },
      });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metricool-calendar', clientId, 'assigned'] });
    },
  });
}

export function useUnassignMetricoolCalendar(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calendarId: string | number) => {
      const { error } = await apiInvoke('metricool-calendar', {
        body: { clientId, mode: 'unassign', calendarId, aggregationFrom: 'blog' },
      });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metricool-calendar', clientId, 'assigned'] });
    },
  });
}
