import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  id?: string;
  role: string;
  content: string;
  created_at?: string;
  image_urls?: string[] | null;
}

export async function exportToMarkdown(messages: Message[], clientName: string): Promise<string> {
  const date = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
  
  let markdown = `# Conversa com ${clientName}\n`;
  markdown += `_Exportado em ${date}_\n\n---\n\n`;

  for (const msg of messages) {
    const role = msg.role === "user" ? "👤 Você" : "🤖 Assistente";
    const time = msg.created_at 
      ? format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })
      : "";
    
    markdown += `### ${role} ${time ? `(${time})` : ""}\n\n`;
    markdown += `${msg.content}\n\n`;

    if (msg.image_urls && msg.image_urls.length > 0) {
      markdown += `_[${msg.image_urls.length} imagem(ns) anexada(s)]_\n\n`;
    }

    markdown += `---\n\n`;
  }

  return markdown;
}

export async function exportToPDF(messages: Message[], clientName: string): Promise<Blob> {
  const doc = new jsPDF();
  const date = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
  
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`Conversa com ${clientName}`, margin, yPos);
  yPos += 10;

  // Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(128);
  doc.text(`Exportado em ${date}`, margin, yPos);
  yPos += 15;
  doc.setTextColor(0);

  // Separator
  doc.setDrawColor(200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  for (const msg of messages) {
    // Check if we need a new page
    if (yPos > 260) {
      doc.addPage();
      yPos = 20;
    }

    const role = msg.role === "user" ? "Você" : "Assistente";
    const time = msg.created_at 
      ? format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })
      : "";

    // Role header
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(msg.role === "user" ? 0 : 80);
    doc.text(`${role} ${time ? `(${time})` : ""}`, margin, yPos);
    yPos += 6;

    // Content
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);

    // Split content into lines that fit the page
    const lines = doc.splitTextToSize(msg.content, maxWidth);
    
    for (const line of lines) {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, margin, yPos);
      yPos += 5;
    }

    // Images indicator
    if (msg.image_urls && msg.image_urls.length > 0) {
      yPos += 2;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`[${msg.image_urls.length} imagem(ns) anexada(s)]`, margin, yPos);
      yPos += 5;
    }

    yPos += 8;

    // Separator between messages
    doc.setDrawColor(220);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
  }

  return doc.output("blob");
}

export function downloadFile(content: Blob | string, filename: string, type: string) {
  const blob = typeof content === "string" 
    ? new Blob([content], { type }) 
    : content;
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
