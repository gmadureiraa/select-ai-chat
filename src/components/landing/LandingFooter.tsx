import { Link } from "react-router-dom";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const WHATSAPP_LINK = "https://api.whatsapp.com/send/?phone=12936180547&text=Olá! Preciso da ajuda da Kaleidos.";
const CONTACT_EMAIL = "contato@kaleidos.ai";
const CALENDLY_LINK = "https://calendly.com/madureira-kaleidosdigital/30min";

const footerLinks = {
  produto: [
    { label: "Funcionalidades", href: "#features" },
    { label: "Preços", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],
  empresa: [
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
    <footer className="bg-muted/30 border-t border-border">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-md bg-foreground dark:bg-primary flex items-center justify-center p-1">
                <img src={kaleidosLogo} alt="kAI" className="w-full h-full invert dark:invert-0" />
              </div>
              <span className="font-semibold text-foreground">kAI</span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
              Plataforma de criação de conteúdo com IA. Organize perfis, crie com inteligência e analise resultados.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-foreground text-sm font-medium mb-4">Produto</h4>
            <ul className="space-y-2.5">
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
            <h4 className="text-foreground text-sm font-medium mb-4">Empresa</h4>
            <ul className="space-y-2.5">
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
            <h4 className="text-foreground text-sm font-medium mb-4">Suporte</h4>
            <ul className="space-y-2.5">
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
          <p className="text-muted-foreground/70 text-xs">
            © {new Date().getFullYear()} kAI by Kaleidos. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground/50">
            <span>Pagamento seguro</span>
            <span>•</span>
            <span>Dados protegidos</span>
            <span>•</span>
            <span>Garantia 14 dias</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
