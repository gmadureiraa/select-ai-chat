import { Lock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EnterpriseLockScreenProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EnterpriseLockScreen({
  title,
  description,
  icon,
  className,
}: EnterpriseLockScreenProps) {
  const whatsappUrl = "https://api.whatsapp.com/send/?phone=12936180547&text=Ol%C3%A1!+Tenho+interesse+no+plano+Enterprise+do+KAI+e+gostaria+de+mais+informa%C3%A7%C3%B5es.";

  return (
    <div className={cn("flex flex-col items-center justify-center h-full p-8", className)}>
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
          {icon || <Lock className="h-10 w-10 text-muted-foreground" />}
        </div>
        
        <h2 className="text-2xl font-semibold mb-3">{title}</h2>
        
        <p className="text-muted-foreground mb-8">
          {description}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            asChild
            className="gap-2"
          >
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com Vendas
            </a>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Recurso exclusivo do plano Enterprise
        </p>
      </div>
    </div>
  );
}
