import { Link } from "react-router-dom";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";
import { Instagram, Twitter, Linkedin, Youtube } from "lucide-react";

const footerLinks = {
  produto: [
    { label: "Features", href: "#features" },
    { label: "Integrações", href: "#integrations" },
    { label: "Preços", href: "#" },
    { label: "Changelog", href: "#" },
  ],
  empresa: [
    { label: "Sobre", href: "#about" },
    { label: "Blog", href: "#" },
    { label: "Carreiras", href: "#" },
    { label: "Contato", href: "#" },
  ],
  recursos: [
    { label: "Documentação", href: "#" },
    { label: "Tutoriais", href: "#" },
    { label: "API", href: "#" },
    { label: "Status", href: "#" },
  ],
  legal: [
    { label: "Privacidade", href: "#" },
    { label: "Termos", href: "#" },
    { label: "Cookies", href: "#" },
  ],
};

const socialLinks = [
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Youtube, href: "#", label: "YouTube" },
];

const LandingFooter = () => {
  return (
    <footer className="bg-muted/30 dark:bg-muted/10 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <img src={kaleidosLogo} alt="KAI" className="h-8 w-8" />
              <span className="text-xl font-semibold text-foreground">KAI</span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6 max-w-xs">
              Plataforma inteligente para criação de conteúdo. Automatize,
              analise e acelere sua produção.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
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
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-foreground font-medium mb-4">Recursos</h4>
            <ul className="space-y-3">
              {footerLinks.recursos.map((link) => (
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
            <h4 className="text-foreground font-medium mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
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
