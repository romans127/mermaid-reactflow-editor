import { Button, Badge, Card } from "@/components/ui";
import { CodePanel, CanvasPanel } from "@/components/panels";
import { MermaidRenderer } from "@/features/diagram/MermaidRenderer";
import { Minimize2, FileText } from "lucide-react";
import { Node, Edge } from "reactflow";
import type {
  UseDiagramReturn,
  UseThemeReturn,
  UseToastReturn,
  UseAccordionReturn,
  FullscreenPanel,
} from "@/types";
import type { RenderMode } from "@/features/diagram/diagramKind";
import { AISettings } from "@/components/AppUI";

export interface FullscreenViewProps {
  fullscreenPanel: FullscreenPanel;
  diagram: UseDiagramReturn;
  theme: UseThemeReturn;
  accordion: UseAccordionReturn;
  toast: UseToastReturn;
  showAiGenerator: boolean;
  toggleAiGenerator: () => void;
  toggleFullscreen: (panel: FullscreenPanel) => void;
  aiSettings: AISettings;
  setAiSettings: React.Dispatch<React.SetStateAction<AISettings>>;
  aiPrompt: string;
  setAiPrompt: (prompt: string) => void;
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  canvasRenderMode: RenderMode;
  canvasKindDisplayLabel: string;
  onRegisterMethods: (
    methods:
      | {
          openSearch?: () => void;
          exportImage?: () => Promise<void>;
          selectSubgraphContents?: (id?: string) => void;
        }
      | Record<string, never>
  ) => void;
}

export function FullscreenView({
  fullscreenPanel,
  diagram,
  theme,
  accordion,
  toast,
  showAiGenerator,
  toggleAiGenerator,
  toggleFullscreen,
  aiSettings,
  setAiSettings,
  aiPrompt,
  setAiPrompt,
  onNodesChange,
  onEdgesChange,
  canvasRenderMode,
  canvasKindDisplayLabel,
  onRegisterMethods,
}: FullscreenViewProps) {
  const getPanelTitle = () => {
    switch (fullscreenPanel) {
      case "code":
        return "Code Editor";
      case "preview":
        return "Mermaid Preview";
      case "canvas":
        return "Diagram canvas";
      default:
        return "";
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col min-h-0 overflow-hidden">
      {/* Fullscreen Header */}
      <header className="border-b bg-card px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">{getPanelTitle()}</h1>
          <Badge variant="secondary" className="text-xs">
            Fullscreen
          </Badge>
          {fullscreenPanel === "canvas" && (
            <Badge variant="outline" className="text-xs">
              {canvasKindDisplayLabel}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toggleFullscreen(fullscreenPanel)}
          className="gap-2 hover:bg-muted/80 transition-colors"
        >
          <Minimize2 className="h-4 w-4" />
          <span className="hidden sm:inline">Exit Fullscreen</span>
        </Button>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        {fullscreenPanel === "code" && (
          <div className="h-full p-3 sm:p-6 flex flex-col min-h-0 overflow-hidden">
            <div className="mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAiGenerator}
                className="gap-2 mb-3 hover:bg-primary/10 transition-all duration-200"
              >
                <span>AI Generate</span>
              </Button>
            </div>

            <Card className="flex-1 min-h-0 p-6 bg-muted/30 hover:bg-muted/40 transition-colors flex flex-col overflow-hidden">
              <div className="font-mono text-sm text-muted-foreground mb-4">
                Mermaid Code Editor - Fullscreen
              </div>
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <CodePanel
                  diagram={diagram}
                  theme={theme.effectiveTheme}
                  toast={toast}
                  showAiGenerator={showAiGenerator}
                  toggleAiGenerator={toggleAiGenerator}
                  toggleFullscreen={() => toggleFullscreen("code")}
                  onClose={() => toggleFullscreen("code")}
                  aiSettings={aiSettings}
                  setAiSettings={setAiSettings}
                  aiPrompt={aiPrompt}
                  setAiPrompt={setAiPrompt}
                  isFullscreen={true}
                />
              </div>
            </Card>
          </div>
        )}

        {fullscreenPanel === "preview" && (
          <div className="h-full p-6">
            <Card className="h-full p-6 flex items-center justify-center bg-muted/30 hover:bg-muted/40 transition-colors">
              {diagram.mermaidSource ? (
                <MermaidRenderer
                  code={diagram.mermaidSource}
                  effectiveTheme={theme.effectiveTheme}
                  className="w-full h-full min-h-0"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Mermaid Preview - Fullscreen</p>
                  <p className="text-sm mt-2">Live preview will render here with full detail</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {fullscreenPanel === "canvas" && (
          <div className="h-full flex flex-col min-h-0 bg-background">
            <CanvasPanel
              nodes={diagram.flowData.nodes}
              edges={diagram.flowData.edges}
              isStreaming={diagram.isStreaming}
              theme={theme.effectiveTheme}
              mermaidSource={diagram.mermaidSource}
              renderMode={canvasRenderMode}
              kindDisplayLabel={canvasKindDisplayLabel}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onRegisterMethods={onRegisterMethods}
              toggleFullscreen={() => toggleFullscreen("canvas")}
              onClose={() => toggleFullscreen("canvas")}
              accordion={accordion}
              isFullscreen={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
