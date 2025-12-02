import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClients } from "@/hooks/useClients";

interface ClientSelectorProps {
  selectedClientId?: string;
  onSelectClient: (clientId: string | undefined) => void;
}

export const ClientSelector = ({ selectedClientId, onSelectClient }: ClientSelectorProps) => {
  const { clients } = useClients();

  return (
    <Select 
      value={selectedClientId || "none"} 
      onValueChange={(value) => onSelectClient(value === "none" ? undefined : value)}
    >
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Cliente (opcional)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sem cliente</SelectItem>
        {clients.map((client) => (
          <SelectItem key={client.id} value={client.id}>
            {client.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
