import { Link } from "react-router-dom";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const WHATSAPP_LINK = "https://api.whatsapp.com/send/?phone=12936180547&text=Ol%C3%A1%21+Preciso+da+ajuda+da+Kaleidos.+Podem+me+ajudar%3F&type=phone_number&app_absent=0";
const CONTACT_EMAIL = "contato@kaleidos.ai";
const CALENDLY_LINK = "https://calendly.com/madureira-kaleidosdigital/30min";

const footerLinks = {
  produto: [
    { label: "Features", href: "#features" },
    { label: "Integrações", href: "#integrations" },
    { label: "Preços", href: "#pricing" },
    { label: "Workflow", href: "#workflow" },
  ],
  empresa: [
    { label: "Sobre", href: "#about" },
    { label: "Agendar Demo", href: CALENDLY_LINK },
    { label: "Contato", href: WHATSAPP_LINK },
  ],
  suporte: [
    { label: "WhatsApp", href: WHATSAPP_LINK },
    { label: "Email", href: `mailto:${CONTACT_EMAIL}` },
  ],
};

const LandingFooter = () => {
  return (
    <footer className="bg-muted/30 dark:bg-muted/10 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <img src={kaleidosLogo} alt="KAI" className="h-8 w-8" />
              <span className="text-xl font-semibold text-foreground">KAI</span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6 max-w-xs">
              Plataforma inteligente para criação de conteúdo. Organize perfis,
              crie com IA e analise performance.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-foreground font-medium mb-4">Produto</h4>
            <ul className="space-y-3">
              {footerLinks.produto.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-foreground font-medium mb-4">Empresa</h4>
            <ul className="space-y-3">
              {footerLinks.empresa.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-foreground font-medium mb-4">Suporte</h4>
            <ul className="space-y-3">
              {footerLinks.suporte.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Trust badges */}
        <div className="py-8 border-t border-border mb-8">
          <p className="text-center text-xs text-muted-foreground/70 mb-4">
            Usado por criadores e agências no Brasil e mundo
          </p>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            <div className="flex items-center gap-2 text-muted-foreground/60">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span className="text-xs">Pagamento seguro</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground/60">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
              <span className="text-xs">Dados protegidos</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground/60">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
              </svg>
              <span className="text-xs">Garantia 14 dias</span>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground/70 text-sm">
            © {new Date().getFullYear()} KAI by Kaleidos. Todos os direitos
            reservados.
          </p>
          <p className="text-muted-foreground/70 text-sm">
            Feito com 💜 para criadores de conteúdo
          </p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
