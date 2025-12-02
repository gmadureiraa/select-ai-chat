import { memo } from "react";
import { useReactFlow, useStore } from "reactflow";
import { ZoomIn, ZoomOut, Maximize, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const zoomSelector = (state: any) => state.transform[2];

export const ZoomControls = memo(() => {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const zoom = useStore(zoomSelector);
  const zoomPercentage = Math.round(zoom * 100);

  const handleZoomIn = () => zoomIn({ duration: 200 });
  const handleZoomOut = () => zoomOut({ duration: 200 });
  const handleFitView = () => fitView({ duration: 300, padding: 0.2 });
  const handleResetZoom = () => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 });

  return (
    <TooltipProvider delayDuration={0}>
      <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-1">
        <div className="flex flex-col items-center gap-1 px-2 py-2 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={handleZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Zoom In (Cmd +)</p>
            </TooltipContent>
          </Tooltip>

          {/* Zoom Percentage Display */}
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground min-w-[48px] text-center">
            {zoomPercentage}%
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={handleZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Zoom Out (Cmd -)</p>
            </TooltipContent>
          </Tooltip>

          <div className="w-full h-px bg-border my-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={handleFitView}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Ajustar à Tela</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={handleResetZoom}
              >
                <Home className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Reset (100%)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
});

ZoomControls.displayName = "ZoomControls";
