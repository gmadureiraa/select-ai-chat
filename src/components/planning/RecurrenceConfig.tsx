import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, RepeatIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { RecurrenceType, RecurrenceConfig as RecurrenceConfigType } from '@/types/rssTrigger';

interface RecurrenceConfigProps {
  value: RecurrenceConfigType;
  onChange: (config: RecurrenceConfigType) => void;
}

const recurrenceOptions: { value: RecurrenceType; label: string }[] = [
  { value: 'none', label: 'Sem repetição' },
  { value: 'daily', label: 'Diariamente' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'biweekly', label: 'Quinzenalmente' },
  { value: 'monthly', label: 'Mensalmente' },
];

const daysOfWeek = [
  { value: 'monday', label: 'Seg' },
  { value: 'tuesday', label: 'Ter' },
  { value: 'wednesday', label: 'Qua' },
  { value: 'thursday', label: 'Qui' },
  { value: 'friday', label: 'Sex' },
  { value: 'saturday', label: 'Sáb' },
  { value: 'sunday', label: 'Dom' },
];

export function RecurrenceConfig({ value, onChange }: RecurrenceConfigProps) {
  const [isEnabled, setIsEnabled] = useState(value.type !== 'none');

  const handleToggle = (enabled: boolean) => {
    setIsEnabled(enabled);
    if (!enabled) {
      onChange({ type: 'none', days: [], time: null, endDate: null });
    } else {
      onChange({ ...value, type: 'daily' });
    }
  };

  const handleTypeChange = (type: RecurrenceType) => {
    onChange({ ...value, type });
  };

  const toggleDay = (day: string) => {
    const newDays = value.days.includes(day)
      ? value.days.filter(d => d !== day)
      : [...value.days, day];
    onChange({ ...value, days: newDays });
  };

  const handleTimeChange = (time: string) => {
    onChange({ ...value, time: time || null });
  };

  const handleEndDateChange = (date: Date | undefined) => {
    onChange({ ...value, endDate: date ? format(date, 'yyyy-MM-dd') : null });
  };

  const showDaysSelector = value.type === 'weekly' || value.type === 'biweekly';

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RepeatIcon className="h-4 w-4 text-muted-foreground" />
          <Label className="font-medium">Conteúdo Recorrente</Label>
        </div>
        <Switch checked={isEnabled} onCheckedChange={handleToggle} />
      </div>

      {isEnabled && (
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-sm text-muted-foreground">Frequência</Label>
            <Select value={value.type} onValueChange={handleTypeChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recurrenceOptions.filter(o => o.value !== 'none').map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showDaysSelector && (
            <div>
              <Label className="text-sm text-muted-foreground">Dias da Semana</Label>
              <div className="flex flex-wrap gap-1 mt-2">
                {daysOfWeek.map(day => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={value.days.includes(day.value) ? 'default' : 'outline'}
                    size="sm"
                    className="px-2 py-1 h-8"
                    onClick={() => toggleDay(day.value)}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm text-muted-foreground">Horário</Label>
              <Input
                type="time"
                value={value.time || ''}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Termina em</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1", 
                      !value.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {value.endDate ? format(new Date(value.endDate), 'dd/MM/yyyy') : 'Opcional'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar 
                    mode="single" 
                    selected={value.endDate ? new Date(value.endDate) : undefined} 
                    onSelect={handleEndDateChange} 
                    initialFocus 
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {value.type === 'daily' && 'Um novo card será criado todos os dias.'}
            {value.type === 'weekly' && value.days.length > 0 && 
              `Um novo card será criado toda semana em: ${value.days.map(d => daysOfWeek.find(dw => dw.value === d)?.label).join(', ')}.`}
            {value.type === 'weekly' && value.days.length === 0 && 
              'Selecione pelo menos um dia da semana.'}
            {value.type === 'biweekly' && 
              `Um novo card será criado a cada 2 semanas.`}
            {value.type === 'monthly' && 
              'Um novo card será criado uma vez por mês.'}
          </p>
        </div>
      )}
    </div>
  );
}
