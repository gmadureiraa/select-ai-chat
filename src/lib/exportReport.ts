import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReportExportData {
  title: string;
  platform: string;
  period: string;
  content: string;
  generatedAt: string;
}

export async function exportReportToPDF(report: ReportExportData): Promise<Blob> {
  const doc = new jsPDF();
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let yPos = 20;

  // Header - Main title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text(`Relatório de Performance`, margin, yPos);
  yPos += 10;
  
  // Platform
  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.text(report.platform, margin, yPos);
  yPos += 10;

  // Period in highlight
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`Período: ${report.period}`, margin, yPos);
  yPos += 6;
  doc.text(`Gerado em: ${report.generatedAt}`, margin, yPos);
  yPos += 12;

  // Separator line
  doc.setDrawColor(200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;

  // Clean markdown for PDF - basic conversion
  const cleanContent = report.content
    // Convert headers to uppercase with spacing
    .replace(/^#{1,2}\s+(.+)$/gm, (_, text) => `\n${text.toUpperCase()}\n`)
    .replace(/^###\s+(.+)$/gm, (_, text) => `\n${text}\n`)
    // Remove bold markdown
    .replace(/\*\*(.+?)\*\*/g, '$1')
    // Remove italic markdown
    .replace(/\*(.+?)\*/g, '$1')
    // Clean up emoji headers
    .replace(/[🥇🥈🥉📊📈💡🎯📝]/g, '')
    // Normalize bullets
    .replace(/^[-•]\s*/gm, '• ')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);

  const lines = doc.splitTextToSize(cleanContent, maxWidth);
  
  for (const line of lines) {
    // Check for new page
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    
    // Check if line is a header (uppercase lines)
    const isHeader = line === line.toUpperCase() && line.length > 3 && line.length < 100;
    
    if (isHeader) {
      yPos += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(line, margin, yPos);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      yPos += 6;
    } else {
      doc.text(line, margin, yPos);
      yPos += 5;
    }
  }

  return doc.output("blob");
}
