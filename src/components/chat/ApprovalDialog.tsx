/**
 * ApprovalDialog — modal de confirmação pra tools destrutivas/sensíveis do kAI Agent.
 *
 * Fluxo:
 *   1. Backend emite `delta.approval_request` quando uma tool exige confirmação.
 *   2. useKAISimpleChat captura e seta `pendingApproval`.
 *   3. KaiAssistantTab renderiza este Dialog com a info do preview.
 *   4. User clica "Confirmar" → callback `onConfirm()` chama
 *      sendMessage(...) com `forceTool` contendo `approved: true` + callbackToken.
 *   5. Backend valida o token via `consumeApprovalToken()` e executa a ação real.
 *
 * Variantes visuais:
 *   - `irreversible: true` → header vermelho + ícone alerta + botão destructive
 *   - default → ícone amarelo + botão primary
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldQuestion, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { KAIApprovalRequest } from "@/types/kai-stream";

interface ApprovalDialogProps {
  request: KAIApprovalRequest | null;
  /** Chamado quando usuário clica em Confirmar. UI deve então re-call a tool
   *  com `forceTool: { name: request.toolName!, args: { ...request.toolArgs, approved: true, callbackToken: request.callbackToken } }`. */
  onConfirm: (req: KAIApprovalRequest) => Promise<void> | void;
  /** Chamado quando usuário cancela ou fecha o modal. Backend não recebe nada
   *  — o token expira naturalmente em 5min. */
  onCancel: () => void;
}

export function ApprovalDialog({ request, onConfirm, onCancel }: ApprovalDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [expired, setExpired] = useState(false);

  // Reset transient state when a new request arrives.
  useEffect(() => {
    setSubmitting(false);
    setExpired(false);
  }, [request?.callbackToken]);

  // Countdown — auto-disable Confirm se o token expirar enquanto o modal está aberto.
  useEffect(() => {
    if (!request?.expiresAt) return;
    const target = new Date(request.expiresAt).getTime();
    const checkExpiry = () => {
      if (Date.now() >= target) setExpired(true);
    };
    checkExpiry();
    const id = setInterval(checkExpiry, 5_000);
    return () => clearInterval(id);
  }, [request?.expiresAt]);

  const open = !!request;
  const irreversible = !!request?.preview.irreversible;

  const handleConfirm = async () => {
    if (!request || submitting || expired) return;
    setSubmitting(true);
    try {
      await onConfirm(request);
    } finally {
      // Caller fecha o modal (seta request=null). Reset local só por segurança.
      setSubmitting(false);
    }
  };

  const titleIcon = useMemo(
    () =>
      irreversible ? (
        <AlertTriangle className="h-5 w-5 text-destructive" />
      ) : (
        <ShieldQuestion className="h-5 w-5 text-amber-500" />
      ),
    [irreversible],
  );

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) onCancel();
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            {titleIcon}
            <AlertDialogTitle className="text-left">
              {request?.preview.title ?? "Confirmar ação?"}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left whitespace-pre-wrap leading-relaxed pt-1">
            {request?.preview.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Lista de itens afetados */}
        {request?.preview.impactedItems && request.preview.impactedItems.length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-1.5 max-h-48 overflow-auto">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {request.preview.impactedItems.length === 1
                ? "Item afetado"
                : `${request.preview.impactedItems.length} itens afetados`}
            </p>
            <ul className="space-y-1 text-sm">
              {request.preview.impactedItems.map((item) => (
                <li key={item.id} className="flex items-start gap-1.5">
                  <span className="text-muted-foreground shrink-0">·</span>
                  <span className="leading-snug">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warning irreversível */}
        {irreversible && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive leading-relaxed">
              <strong>Esta ação é irreversível.</strong> Não dá pra desfazer depois de confirmar.
            </p>
          </div>
        )}

        {/* Expirou */}
        {expired && (
          <Badge variant="outline" className="self-start text-xs gap-1 border-destructive/30 text-destructive">
            Token expirado — peça de novo pro kAI
          </Badge>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // AlertDialogAction fecha o modal por default — preciso interceptar
              // pra esperar onConfirm completar (mostra loading).
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={submitting || expired}
            className={cn(
              "gap-2",
              irreversible &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive",
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Executando…" : irreversible ? "Confirmar exclusão" : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
