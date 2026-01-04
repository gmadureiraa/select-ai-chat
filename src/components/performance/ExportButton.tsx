import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface ExportButtonProps {
  data: any[];
  filename: string;
  platform?: string;
}

export function ExportButton({ data, filename, platform = "instagram" }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const getColumnHeaders = () => {
    switch (platform) {
      case "instagram":
        return ["Data", "Tipo", "Legenda", "Alcance", "Impressões", "Engajamento %", "Curtidas", "Comentários", "Salvos", "Compartilhamentos"];
      case "youtube":
        return ["Data", "Título", "Views", "Horas Assistidas", "CTR %", "Inscritos Ganhos", "Duração (min)"];
      case "newsletter":
        return ["Data", "Inscritos", "Taxa Abertura %", "Taxa Cliques %", "Views"];
      default:
        return [];
    }
  };

  const getRowValues = (item: any) => {
    switch (platform) {
      case "instagram":
        return [
          item.date,
          item.type,
          `"${(item.caption || "").replace(/"/g, '""')}"`,
          item.reach,
          item.impressions,
          item.engagement?.toFixed(2),
          item.likes,
          item.comments,
          item.saves,
          item.shares,
        ];
      case "youtube":
        return [
          item.date,
          `"${(item.title || "").replace(/"/g, '""')}"`,
          item.views,
          item.watchHours?.toFixed(2),
          item.ctr?.toFixed(2),
          item.subscribers,
          item.duration,
        ];
      case "newsletter":
        return [
          item.date,
          item.subscribers,
          item.openRate?.toFixed(2),
          item.clickRate?.toFixed(2),
          item.views,
        ];
      default:
        return [];
    }
  };

  const exportToCSV = () => {
    if (data.length === 0) {
      toast({
        title: "Sem dados",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const headers = getColumnHeaders();
      const csvContent = [
        headers.join(","),
        ...data.map(item => getRowValues(item).join(","))
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportado com sucesso",
        description: `${data.length} registros exportados para CSV.`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = () => {
    if (data.length === 0) {
      toast({
        title: "Sem dados",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportado com sucesso",
        description: `${data.length} registros exportados para JSON.`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isExporting || data.length === 0}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4" />
          Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToJSON} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4" />
          Exportar JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
