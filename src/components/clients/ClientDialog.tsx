import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClientCreationWizardSimplified } from "./ClientCreationWizardSimplified";

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClientDialog = ({ open, onOpenChange }: ClientDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Perfil</DialogTitle>
          <DialogDescription>
            Adicione as informações básicas do perfil
          </DialogDescription>
        </DialogHeader>

        <ClientCreationWizardSimplified 
          onComplete={() => onOpenChange(false)} 
          onCancel={() => onOpenChange(false)} 
        />
      </DialogContent>
    </Dialog>
  );
};
