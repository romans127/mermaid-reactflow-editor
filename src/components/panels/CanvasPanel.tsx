import { Button, Badge } from "@/components/ui";
import { FlowDiagram } from "@/features/canvas/FlowDiagram";
import { MermaidRenderer } from "@/features/diagram/MermaidRenderer";
import { exportMermaidContainerPng } from "@/features/diagram/exportMermaidImage";
import Logo from "@/components/Logo";
import { X, Maximize2, PlusCircle } from "lucide-react";
import { Node, Edge } from "reactflow";
import type { EffectiveTheme, UseAccordionReturn } from "@/types";
import type { RenderMode } from "@/features/diagram/diagramKind";
import { useEffect, useRef } from "react";

export interface CanvasPanelProps {
  nodes: Node[];
  edges: Edge[];
  isStreaming: boolean;
  theme: EffectiveTheme;
  mermaidSource: string;
  renderMode: RenderMode;
  kindDisplayLabel: string;
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onRegisterMethods: (methods: {
    openSearch?: () => void;
    exportImage?: () => Promise<void>;
    selectSubgraphContents?: (id?: string) => void;
  } | {}) => void;
  toggleFullscreen: () => void;
  onClose: () => void;
  accordion: UseAccordionReturn;
  isFullscreen?: boolean;
}

export function CanvasPanel({
  nodes,
  edges,
  isStreaming,
  theme,
  mermaidSource,
  renderMode,
  kindDisplayLabel,
  onNodesChange,
  onEdgesChange,
  onRegisterMethods,
  toggleFullscreen,
  onClose,
  accordion,
  isFullscreen = false,
}: CanvasPanelProps) {
  const mermaidSvgHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const src = mermaidSource?.trim();
    if (renderMode !== "mermaid-svg" || !src) {
      return undefined;
    }

    const exportImage = async () => {
      const el = mermaidSvgHostRef.current;
      if (!el) return;
      try {
        const bg =
          theme === "dark" ? "#0a0a0a" : "#ffffff";
        await exportMermaidContainerPng(el, {
          fileName: "mermaid-diagram.png",
          pixelRatio: 3,
          backgroundColor: bg,
        });
      } catch (e) {
        alert("Failed to export image: " + e);
      }
    };

    onRegisterMethods({
      exportImage,
    });

    return () => {
      onRegisterMethods({});
    };
  }, [renderMode, mermaidSource, onRegisterMethods, theme]);

  const showReactFlow = renderMode === "reactflow" && nodes.length > 0;
  const showMermaidSvg = renderMode === "mermaid-svg" && mermaidSource.trim() !== "";

  const canvasTitle =
    renderMode === "reactflow" ? "React Flow Canvas" : "Mermaid canvas";
  const subtitle =
    renderMode === "reactflow"
      ? "Editable flowchart / graph nodes"
      : "SVG rendering for all diagram types (edit via code editor)";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-2 border-b flex items-center justify-between bg-muted/30 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Logo className="h-4 w-4 text-foreground shrink-0" aria-hidden />
          <span className="font-medium text-sm truncate">{canvasTitle}</span>
          <Badge variant="secondary" className="text-xs shrink-0">
            {kindDisplayLabel}
          </Badge>
        </div>
        {!isFullscreen && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:scale-105 transition-transform"
              onClick={toggleFullscreen}
              title="Fullscreen"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:scale-105 transition-transform"
              onClick={onClose}
              title="Close Panel"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      <p className="px-3 py-1 text-[11px] text-muted-foreground border-b bg-muted/20">
        {subtitle}
      </p>

      <div className="flex-1 relative overflow-hidden flex flex-col min-h-0">
        <div className="w-full h-full flex-1 min-h-0">
          {showReactFlow ? (
            <FlowDiagram
              nodes={nodes}
              edges={edges}
              interactive={!isStreaming}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onSelectionChange={() => {}}
              onRequestPreview={() => {}}
              onRegisterMethods={onRegisterMethods}
              theme={theme}
            />
          ) : showMermaidSvg ? (
            <div ref={mermaidSvgHostRef} className="w-full h-full min-h-[200px] p-2">
              <MermaidRenderer
                code={mermaidSource}
                effectiveTheme={theme}
                className="w-full h-full min-h-0 rounded-md border bg-background"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center px-4">
              <div>
                <div className="mx-auto mb-4 opacity-50">
                  <Logo
                    className="h-12 w-12 mx-auto text-muted-foreground"
                    aria-hidden
                  />
                </div>
                <h4 className="text-lg font-normal text-muted-foreground mb-2">
                  {renderMode === "reactflow"
                    ? "No flowchart parsed yet"
                    : "Nothing to render"}
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {renderMode === "reactflow"
                    ? "Add valid flowchart or graph Mermaid syntax to create editable nodes."
                    : "Add Mermaid code in the editor to see it here and in Preview."}
                </p>
                <Button
                  onClick={() => {
                    accordion.setAccordionOpen((prev) => ({
                      ...prev,
                      editor: true,
                    }));
                  }}
                  className="gap-2"
                >
                  <PlusCircle className="h-4 w-4" />
                  Open editor
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
