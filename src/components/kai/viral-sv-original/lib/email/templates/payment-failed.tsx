import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
} from "./_layout";

/**
 * Enviado quando `invoice.payment_failed` — cartão recusado, fundos
 * insuficientes, expirado, etc. Encaminha o user pro portal do Stripe.
 */
export function PaymentFailedEmail({
  name,
  planName,
  amountUsd,
  portalUrl,
  appUrl,
}: {
  name?: string;
  planName: string;
  amountUsd?: number | null;
  portalUrl?: string;
  appUrl: string;
}) {
  const firstName = (name || "").trim().split(" ")[0] || "creator";
  const targetUrl = portalUrl || `${appUrl}/app/settings`;
  return (
    <EmailLayout preview={`Falha na cobrança do plano ${planName} — atualize seu cartão.`}>
      <EmailKicker>Ação necessária</EmailKicker>
      <EmailHeadline>
        {firstName}, sua cobrança foi recusada.
      </EmailHeadline>
      <EmailText>
        Tentamos renovar o plano <strong>{planName}</strong>
        {amountUsd ? ` (US$${amountUsd.toFixed(2)})` : ""} e o cartão
        recusou. Acontece: pode ser limite, expirado, ou banco bloqueou.
      </EmailText>
      <EmailText>
        Vamos tentar novamente automaticamente nas próximas horas. Pra
        evitar perder acesso, atualize o cartão agora:
      </EmailText>
      <EmailButton href={targetUrl}>Atualizar forma de pagamento</EmailButton>
      <EmailText>
        Se o problema persistir, me responde este e-mail. Resolvemos
        manualmente.
      </EmailText>
    </EmailLayout>
  );
}

export default PaymentFailedEmail;
