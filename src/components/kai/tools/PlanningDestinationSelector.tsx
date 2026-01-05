import { Calendar, FolderOpen } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PlanningDestination } from "@/hooks/useContentCreator";
import { cn } from "@/lib/utils";

interface KanbanColumn {
  id: string;
  name: string;
  column_type: string | null;
}

interface PlanningDestinationSelectorProps {
  destination: PlanningDestination;
  onChange: (destination: PlanningDestination) => void;
  columns: KanbanColumn[];
  disabled?: boolean;
}

export function PlanningDestinationSelector({
  destination,
  onChange,
  columns,
  disabled = false,
}: PlanningDestinationSelectorProps) {
  const handleToggle = (enabled: boolean) => {
    onChange({ ...destination, enabled });
  };

  const handleColumnChange = (columnId: string) => {
    onChange({ ...destination, columnId });
  };

  const handleDateChange = (date: Date | undefined) => {
    onChange({ ...destination, dueDate: date });
  };

  // Get default column for display
  const defaultColumn = columns.find(c => c.column_type === 'draft') || columns[0];
  const selectedColumnId = destination.columnId || defaultColumn?.id;
  const selectedColumn = columns.find(c => c.id === selectedColumnId);

  return (
    <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="add-to-planning" className="font-medium">
            Adicionar ao Planejamento
          </Label>
        </div>
        <Switch
          id="add-to-planning"
          checked={destination.enabled}
          onCheckedChange={handleToggle}
          disabled={disabled}
        />
      </div>

      {destination.enabled && (
        <div className="space-y-3 pt-2 border-t">
          <div className="grid grid-cols-2 gap-3">
            {/* Column selector */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Coluna</Label>
              <Select
                value={selectedColumnId}
                onValueChange={handleColumnChange}
                disabled={disabled}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione a coluna" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date selector */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data (opcional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-9 w-full justify-start text-left font-normal",
                      !destination.dueDate && "text-muted-foreground"
                    )}
                    disabled={disabled}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {destination.dueDate ? (
                      format(destination.dueDate, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      "Selecionar"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={destination.dueDate}
                    onSelect={handleDateChange}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {selectedColumn ? (
              <>Os conteúdos serão criados como cards na coluna "{selectedColumn.name}"</>
            ) : (
              <>Selecione onde os conteúdos serão criados</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
