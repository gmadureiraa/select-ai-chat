
import { motion } from "framer-motion";
import {
  RoadmapBoardBrutalist,
  RoadmapLegend,
} from "@sv/components/landing/roadmap-board-v2";

/**
 * Roadmap interno do app — shell do /app + board compartilhado
 * (mesmo componente usado em /roadmap pública).
 */
export default function AppRoadmapPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="sv-eyebrow">
          <span className="sv-dot" /> Nº 06 · Roadmap público
        </span>
        <h1
          className="sv-display mt-4"
          style={{
            fontSize: "clamp(40px, 7vw, 80px)",
            lineHeight: 0.95,
            letterSpacing: "-0.025em",
            maxWidth: 960,
          }}
        >
          O <em>caminho</em> do Sequência Viral.
        </h1>
        <p
          className="mt-5"
          style={{
            fontFamily: "var(--sv-sans)",
            fontSize: 17,
            color: "var(--sv-muted)",
            maxWidth: 680,
            lineHeight: 1.5,
          }}
        >
          Hoje: gerador manual que já resolve o dia a dia. Em alguns meses, motor
          autônomo que lê o mundo, entende sua marca e publica por você.
        </p>

        <div className="mt-6">
          <RoadmapLegend />
        </div>
      </motion.div>

      <div className="mt-12">
        <RoadmapBoardBrutalist />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mt-16 mb-10"
        style={{
          padding: "40px 32px",
          background: "var(--sv-ink)",
          color: "var(--sv-paper)",
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "5px 5px 0 0 var(--sv-green)",
          textAlign: "center",
        }}
      >
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "var(--sv-green)",
            fontWeight: 700,
          }}
        >
          ✦ Quer pedir algo?
        </span>
        <h2
          className="sv-display mt-3"
          style={{
            fontSize: "clamp(28px, 4vw, 44px)",
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            color: "var(--sv-paper)",
          }}
        >
          O roadmap muda com <em>quem usa</em>.
        </h2>
        <p
          className="mt-3 mx-auto"
          style={{
            fontFamily: "var(--sv-sans)",
            fontSize: 15,
            color: "rgba(247,245,239,0.7)",
            maxWidth: 480,
            lineHeight: 1.5,
          }}
        >
          Manda o que você precisa e eu priorizo. Resposta direta, sem
          formulário corporativo.
        </p>
        <a
          href="mailto:madureira@kaleidosdigital.com?subject=Roadmap%20feedback"
          className="mt-6 inline-flex items-center gap-2"
          style={{
            padding: "13px 22px",
            background: "var(--sv-green)",
            border: "1.5px solid var(--sv-paper)",
            boxShadow: "4px 4px 0 0 var(--sv-paper)",
            fontFamily: "var(--sv-mono)",
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "var(--sv-ink)",
            textDecoration: "none",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translate(-1.5px, -1.5px)";
            e.currentTarget.style.boxShadow = "6px 6px 0 0 var(--sv-paper)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translate(0, 0)";
            e.currentTarget.style.boxShadow = "4px 4px 0 0 var(--sv-paper)";
          }}
        >
          Mandar sugestão →
        </a>
      </motion.section>
    </div>
  );
}
