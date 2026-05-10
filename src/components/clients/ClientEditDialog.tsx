import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Client } from "@/hooks/useClients";
import { ClientEditTabsSimplified } from "./ClientEditTabsSimplified";

interface ClientEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export const ClientEditDialog = ({ open, onOpenChange, client }: ClientEditDialogProps) => {
  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 2026-05-10 — width subiu de 3xl pra 5xl porque o Perfil agora tem
          sidebar lateral (~192px) + main. Em mobile cai pra full-width
          natural do DialogContent. */}
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="sr-only">
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Atualize as informações do cliente
          </DialogDescription>
        </DialogHeader>

        <ClientEditTabsSimplified 
          client={client} 
          onClose={() => onOpenChange(false)} 
        />
      </DialogContent>
    </Dialog>
  );
};
