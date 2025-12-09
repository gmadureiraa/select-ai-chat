import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudienceSentimentGaugeProps {
  score: number; // 0-100
  previousScore?: number;
  totalComments?: number;
  lastUpdated?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function AudienceSentimentGauge({ 
  score, 
  previousScore, 
  totalComments,
  lastUpdated,
  isLoading,
  onRefresh 
}: AudienceSentimentGaugeProps) {
  const getEmoji = (score: number) => {
    if (score >= 80) return "🥰";
    if (score >= 60) return "😊";
    if (score >= 40) return "😐";
    if (score >= 20) return "😕";
    return "😠";
  };

  const getLabel = (score: number) => {
    if (score >= 80) return "Excelente";
    if (score >= 60) return "Bom";
    if (score >= 40) return "Neutro";
    if (score >= 20) return "Regular";
    return "Ruim";
  };

  const getColor = (score: number) => {
    if (score >= 80) return "hsl(145, 100%, 40%)"; // Green
    if (score >= 60) return "hsl(90, 70%, 45%)"; // Light green
    if (score >= 40) return "hsl(45, 90%, 50%)"; // Yellow
    if (score >= 20) return "hsl(30, 90%, 50%)"; // Orange
    return "hsl(0, 70%, 50%)"; // Red
  };

  const change = previousScore !== undefined ? score - previousScore : undefined;

  // SVG Arc calculation
  const radius = 70;
  const strokeWidth = 12;
  const normalizedScore = Math.min(100, Math.max(0, score));
  const angle = (normalizedScore / 100) * 180;
  const radians = (angle - 180) * (Math.PI / 180);
  const x = 80 + radius * Math.cos(radians);
  const y = 85 + radius * Math.sin(radians);
  
  // Arc path
  const startX = 80 - radius;
  const startY = 85;
  const endX = 80 + radius;
  const largeArcFlag = angle > 90 ? 1 : 0;

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Satisfação da Audiência</CardTitle>
          </div>
          {onRefresh && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          {/* Gauge */}
          <div className="relative w-[160px] h-[100px]">
            <svg viewBox="0 0 160 100" className="w-full h-full overflow-visible">
              {/* Background arc */}
              <path
                d={`M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${startY}`}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              {/* Gradient definitions */}
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(0, 70%, 50%)" />
                  <stop offset="25%" stopColor="hsl(30, 90%, 50%)" />
                  <stop offset="50%" stopColor="hsl(45, 90%, 50%)" />
                  <stop offset="75%" stopColor="hsl(90, 70%, 45%)" />
                  <stop offset="100%" stopColor="hsl(145, 100%, 40%)" />
                </linearGradient>
              </defs>
              {/* Progress arc */}
              {score > 0 && (
                <path
                  d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x} ${y}`}
                  fill="none"
                  stroke="url(#gaugeGradient)"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              )}
              {/* Needle indicator */}
              <circle
                cx={x}
                cy={y}
                r={6}
                fill="hsl(var(--background))"
                stroke={getColor(score)}
                strokeWidth={3}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
              <span className="text-3xl mb-0">{getEmoji(score)}</span>
            </div>
          </div>

          {/* Score */}
          <div className="text-center mt-2">
            <div className="text-3xl font-bold" style={{ color: getColor(score) }}>
              {score}
            </div>
            <Badge 
              variant="outline" 
              className="mt-1"
              style={{ 
                borderColor: getColor(score),
                color: getColor(score)
              }}
            >
              {getLabel(score)}
            </Badge>
          </div>

          {/* Change indicator */}
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-3 text-sm ${
              change >= 0 ? 'text-emerald-500' : 'text-red-500'
            }`}>
              {change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="font-medium">
                {change >= 0 ? '+' : ''}{change} pts vs período anterior
              </span>
            </div>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            {totalComments !== undefined && (
              <span>{totalComments.toLocaleString('pt-BR')} comentários analisados</span>
            )}
            {lastUpdated && (
              <span>Atualizado: {lastUpdated}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}