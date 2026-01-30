import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FAQ {
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    question: "Posso cancelar a qualquer momento?",
    answer: "Sim. Não há contratos ou fidelidade. Você pode cancelar sua assinatura a qualquer momento e continuar usando até o fim do período pago. Oferecemos garantia de 14 dias para reembolso total.",
  },
  {
    question: "O que o kAI pode fazer pela minha agência?",
    answer: "O kAI centraliza a gestão de clientes, permite criar conteúdo com IA que entende o contexto de cada marca, analisa performance de redes sociais e oferece um espaço colaborativo para pesquisa e organização de referências.",
  },
  {
    question: "Em quais redes sociais posso publicar?",
    answer: "Com o plano Pro, você pode publicar diretamente no Instagram, Twitter/X, LinkedIn, YouTube e newsletters via Beehiiv. Novas integrações estão sendo adicionadas constantemente.",
  },
  {
    question: "O que posso criar no Canvas?",
    answer: "O Canvas permite criar carrosséis, threads, artigos, posts, scripts para vídeos, newsletters, thumbnails e imagens com IA. Você pode transformar uma única fonte em múltiplos conteúdos.",
  },
  {
    question: "Preciso de habilidades técnicas?",
    answer: "Não. O kAI foi desenhado para ser intuitivo. A interface é visual e amigável, sem necessidade de código. Nosso time oferece onboarding completo.",
  },
  {
    question: "Como a IA aprende sobre meus clientes?",
    answer: "Você cadastra informações como descrição, tom de voz e brand guidelines. A IA usa esse contexto para gerar conteúdo personalizado e consistente com a marca.",
  },
];

const FAQSection = () => {
  return (
    <section id="faq" className="py-24 md:py-32 bg-background relative">
      {/* Subtle border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-2xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium mb-4">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
            Perguntas frequentes
          </h2>
        </motion.div>

        {/* Accordion - Minimal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <Accordion type="single" collapsible className="space-y-0">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-b border-border py-0"
              >
                <AccordionTrigger className="text-left text-base font-medium text-foreground hover:no-underline py-5 [&[data-state=open]>svg]:rotate-45">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 text-sm leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-center mt-12"
        >
          <p className="text-sm text-muted-foreground">
            Ainda tem dúvidas?{" "}
            <a
              href="https://api.whatsapp.com/send/?phone=12936180547&text=Olá! Tenho interesse no kAI e gostaria de mais informações."
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:underline"
            >
              Fale conosco →
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQSection;
