/**
 * Converte um AdaptResponse em markdown completo pra download/copy.
 *
 * Formato pensado pra ser legível tanto cru quanto renderizado: sections
 * claras, code blocks, scenes em tabela. Inclui metadata da fonte pra
 * rastrear depois de qual reel foi adaptado.
 */

import type { AdaptResponse, SourceMeta } from "../types";

const PAPEL_LABEL: Record<string, string> = {
  hook: "HOOK",
  promessa: "PROMESSA",
  demo: "DEMONSTRAÇÃO",
  prova: "PROVA SOCIAL",
  transicao: "TRANSIÇÃO",
  cta: "CTA",
};

function pickSource(data: AdaptResponse): SourceMeta {
  return data.source ?? data.sourceMeta ?? {};
}

export function buildMarkdown(data: AdaptResponse): string {
  const source = pickSource(data);
  const { analysis, script } = data;
  const lines: string[] = [];

  lines.push(`# ${script.titulo}`);
  lines.push("");
  lines.push(
    `> Roteiro adaptado pelo **Reels Viral** a partir de [@${source.ownerUsername ?? "—"}](${source.url ?? source.videoUrl ?? ""}).`,
  );
  lines.push("");

  // ── FONTE ──
  lines.push("## Reel original");
  lines.push("");
  if (source.ownerUsername) lines.push(`- **Criador:** @${source.ownerUsername}`);
  if (source.ownerFullName) lines.push(`- **Nome:** ${source.ownerFullName}`);
  if (source.url || source.videoUrl)
    lines.push(`- **Link:** ${source.url ?? source.videoUrl}`);
  if (source.videoDuration)
    lines.push(`- **Duração:** ${source.videoDuration.toFixed(1)}s`);
  const plays = source.plays ?? source.videoPlayCount;
  if (plays) lines.push(`- **Plays:** ${plays.toLocaleString("pt-BR")}`);
  const likes = source.likes ?? source.likesCount;
  if (likes) lines.push(`- **Likes:** ${likes.toLocaleString("pt-BR")}`);
  const comments = source.comments ?? source.commentsCount;
  if (comments)
    lines.push(`- **Comments:** ${comments.toLocaleString("pt-BR")}`);
  const publishedAt = source.publishedAt ?? source.timestamp;
  if (publishedAt) {
    const date = new Date(publishedAt).toLocaleDateString("pt-BR");
    lines.push(`- **Publicado:** ${date}`);
  }
  if (source.caption) {
    lines.push("");
    lines.push("**Caption original:**");
    lines.push("");
    lines.push("```");
    lines.push(source.caption);
    lines.push("```");
  }
  lines.push("");

  // ── ANÁLISE ──
  lines.push("## Análise estrutural");
  lines.push("");
  lines.push(`> _${analysis.resumo}_`);
  lines.push("");
  lines.push("### Por que viralizou");
  lines.push("");
  for (const r of analysis.porQueViralizou) lines.push(`- ${r}`);
  lines.push("");

  lines.push("### Esqueleto do reel original");
  lines.push("");
  lines.push("| Bloco | Tempo | Texto |");
  lines.push("|-------|-------|-------|");
  const blocks: Array<[string, { texto: string; tempo: string }]> = [
    ["Hook", analysis.estrutura.hook],
    ["Promessa", analysis.estrutura.promessa],
    ["Demonstração", analysis.estrutura.demonstracao],
    ["Prova social", analysis.estrutura.provaSocial],
    ["CTA", analysis.estrutura.cta],
  ];
  for (const [name, b] of blocks) {
    lines.push(
      `| **${name}** | \`${b.tempo}\` | ${b.texto.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`,
    );
  }
  lines.push("");

  if (analysis.padroesTransferiveis?.length) {
    lines.push("### Padrões transferíveis");
    lines.push("");
    for (const p of analysis.padroesTransferiveis) lines.push(`- ${p}`);
    lines.push("");
  }

  // ── SEU NOVO ROTEIRO ──
  lines.push("---");
  lines.push("");
  lines.push("## Seu novo roteiro");
  lines.push("");
  lines.push("### Hook (0–3s)");
  lines.push("");
  lines.push(`> **"${script.hook}"**`);
  lines.push("");

  lines.push("### Roteiro completo");
  lines.push("");
  lines.push(script.roteiroCompleto);
  lines.push("");

  // ── STORYBOARD ──
  lines.push("### Storyboard cena por cena");
  lines.push("");
  for (const scene of script.scenes) {
    const papel = PAPEL_LABEL[scene.papel] ?? scene.papel.toUpperCase();
    lines.push(
      `#### Cena ${String(scene.n).padStart(2, "0")} · \`${scene.tempo}\` · ${papel}`,
    );
    lines.push("");
    lines.push(`**Visual:** ${scene.visual}`);
    lines.push("");
    lines.push(`**Copy:** "${scene.copy}"`);
    if (scene.broll) {
      lines.push("");
      lines.push(`**B-roll:** ${scene.broll}`);
    }
    lines.push("");
  }

  // ── CAPTION + NOTAS ──
  lines.push("### Caption sugerida");
  lines.push("");
  lines.push("```");
  lines.push(script.captionSugerida);
  lines.push("```");
  lines.push("");

  if (script.notasProducao?.length) {
    lines.push("### Notas de produção");
    lines.push("");
    script.notasProducao.forEach((n, i) => {
      lines.push(`${i + 1}. ${n}`);
    });
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(
    `_Gerado por Reels Viral · KAI · Combo viral Kaleidos_`,
  );

  return lines.join("\n");
}

export function downloadMarkdown(data: AdaptResponse, filename?: string): void {
  if (typeof window === "undefined") return;
  const md = buildMarkdown(data);
  const safeTitle = data.script.titulo
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  const fallback = pickSource(data).shortCode ?? "reel";
  const name = filename ?? `roteiro-${safeTitle || fallback}.md`;

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
