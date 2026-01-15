import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "O que o KAI pode fazer pela minha agência?",
    answer:
      "O KAI centraliza a gestão de clientes, permite criar conteúdo com IA que entende o contexto de cada marca, analisa performance de redes sociais e oferece um espaço colaborativo para pesquisa e organização de referências.",
  },
  {
    question: "Em quais redes sociais posso publicar?",
    answer:
      "Com o plano Pro, você pode publicar diretamente no Instagram (posts, carrosséis e stories), Twitter/X (posts e threads), LinkedIn (posts e artigos), YouTube (descrições e thumbnails) e newsletters via Beehiiv. Novas integrações estão sendo adicionadas constantemente.",
  },
  {
    question: "O que posso criar no Canvas?",
    answer:
      "O Canvas permite criar diversos formatos: Carrosséis para Instagram, Threads para Twitter/X, Artigos para LinkedIn e blog, Posts para todas as redes, Scripts para vídeos, Newsletters, Thumbnails e imagens com IA. Você pode transformar uma única fonte (vídeo, texto, URL) em múltiplos conteúdos de uma vez.",
  },
  {
    question: "Preciso de habilidades técnicas para usar o KAI?",
    answer:
      "Não! O KAI foi desenhado para ser intuitivo. A interface é visual e amigável, sem necessidade de código. Nosso time também oferece onboarding completo para garantir que você aproveite ao máximo.",
  },
  {
    question: "Como a IA aprende sobre meus clientes?",
    answer:
      "Você cadastra informações do cliente como descrição, tom de voz, brand guidelines e pode fazer upload de documentos. A IA usa esse contexto para gerar conteúdo personalizado.",
  },
  {
    question: "Como funciona o adicional de clientes e membros?",
    answer:
      "No plano Pro, você tem 3 clientes e 3 membros inclusos. Precisa de mais? Adicione clientes extras por $7/mês cada e membros extras por $4/mês cada. Visualizadores são ilimitados e gratuitos.",
  },
  {
    question: "Quantos clientes e membros posso ter?",
    answer:
      "Depende do plano escolhido. O plano Canvas permite 1 cliente. O Pro inclui 3 clientes e 3 membros, com possibilidade de adicionar mais. Para agências maiores, temos planos Enterprise personalizados com clientes e membros ilimitados.",
  },
];

const FAQSection = () => {
  return (
    <section id="faq" className="py-32 bg-background relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--secondary)/0.05)_0%,transparent_50%)]" />

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-light text-foreground mb-4">
            Dúvidas{" "}
            <span className="italic text-muted-foreground">Frequentes?</span>
          </h2>
          <p className="text-xl text-muted-foreground font-light">
            Temos as{" "}
            <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent font-medium">
              Respostas
            </span>
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border border-border rounded-2xl px-6 data-[state=open]:bg-muted/50 transition-colors"
              >
                <AccordionTrigger className="text-left text-lg font-medium text-foreground hover:no-underline py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 text-base leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <p className="text-muted-foreground">
            Ainda tem dúvidas?{" "}
            <a
              href="https://api.whatsapp.com/send/?phone=12936180547&text=Ol%C3%A1!+Tenho+interesse+no+KAI+e+gostaria+de+mais+informa%C3%A7%C3%B5es."
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
            >
              Fale conosco pelo WhatsApp
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQSection;
