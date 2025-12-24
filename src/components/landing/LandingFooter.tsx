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
              Plataforma inteligente para criação de conteúdo. Organize clientes,
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
