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
    question: "Preciso de habilidades técnicas para usar o KAI?",
    answer:
      "Não! O KAI foi desenhado para ser intuitivo. A interface é visual e amigável, sem necessidade de código. Nosso time também oferece onboarding completo para garantir que você aproveite ao máximo.",
  },
  {
    question: "Quais plataformas vocês integram?",
    answer:
      "Atualmente integramos com Instagram, YouTube e newsletters (Beehiiv). Você pode importar dados de performance e a IA usa essas métricas para gerar insights.",
  },
  {
    question: "Como a IA aprende sobre meus clientes?",
    answer:
      "Você cadastra informações do cliente como descrição, tom de voz, brand guidelines e pode fazer upload de documentos. A IA usa esse contexto para gerar conteúdo personalizado.",
  },
  {
    question: "Como funciona o período de trial de 14 dias?",
    answer:
      "Você tem acesso completo a todas as funcionalidades por 14 dias, sem precisar cadastrar cartão de crédito. Ao final, escolha o plano que melhor se adapta à sua agência.",
  },
  {
    question: "Como funcionam as automações de publicação?",
    answer:
      "No plano Enterprise, você pode conectar seu n8n para criar workflows de publicação automática. Configure gatilhos como RSS feeds ou agendamentos, e a IA gera e publica conteúdo automaticamente nas redes sociais.",
  },
  {
    question: "Quantos clientes e membros posso ter?",
    answer:
      "Depende do plano escolhido. O plano Starter permite até 5 clientes e 3 membros. O Pro permite 20 clientes e 10 membros. Para agências maiores, temos planos Enterprise personalizados.",
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
