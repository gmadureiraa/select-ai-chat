import { useState, useEffect } from 'react';
import { Settings2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

export interface ViewSettings {
  colorBy: 'status' | 'client' | 'platform' | 'priority';
  showWeekends: boolean;
  timeFormat: '12h' | '24h';
  visibleFields: {
    client: boolean;
    platform: boolean;
    status: boolean;
    priority: boolean;
    assignee: boolean;
    labels: boolean;
    dueDate: boolean;
    autoPublish: boolean;
  };
}

const defaultSettings: ViewSettings = {
  colorBy: 'status',
  showWeekends: true,
  timeFormat: '24h',
  visibleFields: {
    client: true,
    platform: true,
    status: true,
    priority: true,
    assignee: false,
    labels: true,
    dueDate: true,
    autoPublish: true,
  },
};

interface ViewSettingsPopoverProps {
  settings: ViewSettings;
  onChange: (settings: ViewSettings) => void;
}

const fieldLabels: Record<keyof ViewSettings['visibleFields'], string> = {
  client: 'Cliente',
  platform: 'Plataforma',
  status: 'Status',
  priority: 'Prioridade',
  assignee: 'Responsável',
  labels: 'Labels',
  dueDate: 'Data',
  autoPublish: 'Auto/Manual',
};

export function useViewSettings() {
  const [settings, setSettings] = useState<ViewSettings>(() => {
    const stored = localStorage.getItem('planning-view-settings');
    if (stored) {
      try {
        return { ...defaultSettings, ...JSON.parse(stored) };
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('planning-view-settings', JSON.stringify(settings));
  }, [settings]);

  return { settings, setSettings };
}

export function ViewSettingsPopover({ settings, onChange }: ViewSettingsPopoverProps) {
  const updateField = (field: keyof ViewSettings['visibleFields'], value: boolean) => {
    onChange({
      ...settings,
      visibleFields: {
        ...settings.visibleFields,
        [field]: value,
      },
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Personalizar</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Personalizar visualização</h4>
          </div>

          <Separator />

          {/* Color By */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Colorir cards por</Label>
            <Select
              value={settings.colorBy}
              onValueChange={(v) => onChange({ ...settings, colorBy: v as ViewSettings['colorBy'] })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
                <SelectItem value="platform">Plataforma</SelectItem>
                <SelectItem value="priority">Prioridade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time Format */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Formato de hora</Label>
            <Select
              value={settings.timeFormat}
              onValueChange={(v) => onChange({ ...settings, timeFormat: v as '12h' | '24h' })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24 horas</SelectItem>
                <SelectItem value="12h">12 horas (AM/PM)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Show Weekends */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Mostrar fins de semana</Label>
            <Switch
              checked={settings.showWeekends}
              onCheckedChange={(v) => onChange({ ...settings, showWeekends: v })}
            />
          </div>

          <Separator />

          {/* Visible Fields */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Campos visíveis nos cards</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(settings.visibleFields) as Array<keyof ViewSettings['visibleFields']>).map((field) => (
                <div key={field} className="flex items-center gap-2">
                  <Checkbox
                    id={`field-${field}`}
                    checked={settings.visibleFields[field]}
                    onCheckedChange={(checked) => updateField(field, checked === true)}
                  />
                  <Label htmlFor={`field-${field}`} className="text-sm font-normal cursor-pointer">
                    {fieldLabels[field]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
