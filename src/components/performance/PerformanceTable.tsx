import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ExternalLink, Play, Image, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Column {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  format?: (value: any, row: any) => React.ReactNode;
}

interface PerformanceTableProps {
  title: string;
  description?: string;
  data: any[];
  columns: Column[];
  maxValue?: number;
  metricKey?: string;
  emptyMessage?: string;
}

// Performance badge based on relative performance
function getPerformanceBadge(value: number, maxValue: number, average: number) {
  const ratio = value / maxValue;
  const vsAverage = value / average;

  if (ratio >= 0.8 || vsAverage >= 1.5) {
    return <Badge className="bg-emerald-500/20 text-emerald-500 border-0 text-[10px] px-1.5">🔥 Viral</Badge>;
  }
  if (ratio >= 0.4 || vsAverage >= 1.0) {
    return <Badge className="bg-primary/20 text-primary border-0 text-[10px] px-1.5">✓ Bom</Badge>;
  }
  if (ratio >= 0.15) {
    return <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5">Normal</Badge>;
  }
  return <Badge className="bg-amber-500/20 text-amber-500 border-0 text-[10px] px-1.5">⚠️ Baixo</Badge>;
}

// Progress bar with gradient
function ProgressBar({ value, max, color = "primary" }: { value: number; max: number; color?: string }) {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full bg-gradient-to-r ${
            color === "primary" 
              ? "from-primary/60 to-primary" 
              : color === "secondary"
              ? "from-secondary/60 to-secondary"
              : "from-accent/60 to-accent"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
        {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
      </span>
    </div>
  );
}

// Content type icon
function ContentTypeIcon({ type }: { type: string }) {
  const typeLC = type?.toLowerCase() || "";
  
  if (typeLC.includes("video") || typeLC.includes("reel") || typeLC.includes("short")) {
    return <Play className="h-3.5 w-3.5 text-secondary" />;
  }
  if (typeLC.includes("image") || typeLC.includes("photo") || typeLC.includes("carousel")) {
    return <Image className="h-3.5 w-3.5 text-primary" />;
  }
  return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function PerformanceTable({
  title,
  description,
  data,
  columns,
  maxValue,
  metricKey = "views",
  emptyMessage = "Nenhum dado disponível",
}: PerformanceTableProps) {
  // Calculate stats for performance badges
  const values = data.map(row => row[metricKey] || 0);
  const max = maxValue || Math.max(...values, 1);
  const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  if (data.length === 0) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>
          <Badge variant="outline" className="text-xs">
            {data.length} itens
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                {columns.map((col) => (
                  <TableHead 
                    key={col.key}
                    className={`text-xs font-medium text-muted-foreground ${
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                    }`}
                  >
                    {col.label}
                  </TableHead>
                ))}
                <TableHead className="text-xs font-medium text-muted-foreground text-center">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => (
                <TableRow 
                  key={row.id || index} 
                  className="border-border/30 hover:bg-muted/30 transition-colors"
                >
                  {columns.map((col) => (
                    <TableCell 
                      key={col.key}
                      className={`py-3 ${
                        col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                      }`}
                    >
                      {col.format ? col.format(row[col.key], row) : (
                        <span className="text-sm">{row[col.key]}</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    {getPerformanceBadge(row[metricKey] || 0, max, average)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export { ProgressBar, ContentTypeIcon, getPerformanceBadge };
