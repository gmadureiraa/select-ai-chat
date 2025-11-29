import { DayOfWeek } from "@/types/automation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface ScheduleConfigProps {
  scheduleType: string;
  scheduleDays: DayOfWeek[];
  scheduleTime: string;
  onDaysChange: (days: DayOfWeek[]) => void;
  onTimeChange: (time: string) => void;
}

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: "monday", label: "Segunda" },
  { value: "tuesday", label: "Terça" },
  { value: "wednesday", label: "Quarta" },
  { value: "thursday", label: "Quinta" },
  { value: "friday", label: "Sexta" },
  { value: "saturday", label: "Sábado" },
  { value: "sunday", label: "Domingo" },
];

export const ScheduleConfig = ({
  scheduleType,
  scheduleDays,
  scheduleTime,
  onDaysChange,
  onTimeChange,
}: ScheduleConfigProps) => {
  const toggleDay = (day: DayOfWeek) => {
    if (scheduleDays.includes(day)) {
      onDaysChange(scheduleDays.filter((d) => d !== day));
    } else {
      onDaysChange([...scheduleDays, day]);
    }
  };

  if (scheduleType === "daily") {
    return (
      <div className="space-y-2">
        <Label>Horário de execução</Label>
        <Input
          type="time"
          value={scheduleTime}
          onChange={(e) => onTimeChange(e.target.value)}
        />
      </div>
    );
  }

  if (scheduleType === "weekly") {
    return (
      <div className="space-y-4">
        <div>
          <Label className="mb-3 block">Dias da semana</Label>
          <div className="grid grid-cols-2 gap-3">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={day.value}
                  checked={scheduleDays.includes(day.value)}
                  onCheckedChange={() => toggleDay(day.value)}
                />
                <Label
                  htmlFor={day.value}
                  className="text-sm font-normal cursor-pointer"
                >
                  {day.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label>Horário de execução</Label>
          <Input
            type="time"
            value={scheduleTime}
            onChange={(e) => onTimeChange(e.target.value)}
          />
        </div>
      </div>
    );
  }

  return null;
};
