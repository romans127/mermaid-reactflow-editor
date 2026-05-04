/**
 * Detect Mermaid diagram type from source and choose React Flow vs SVG rendering.
 * Keywords align with Mermaid diagram families (see https://mermaid.js.org/intro/syntax-reference.html).
 */

export type RenderMode = "reactflow" | "mermaid-svg";

export type DiagramKind =
  | "flowchart"
  | "sequence"
  | "class"
  | "state"
  | "er"
  | "gantt"
  | "pie"
  | "journey"
  | "git"
  | "mindmap"
  | "timeline"
  | "quadrant"
  | "xy"
  | "requirement"
  | "sankey"
  | "block"
  | "kanban"
  | "c4"
  | "packet"
  | "architecture"
  | "radar"
  | "venn"
  | "tree"
  | "ishikawa"
  | "wardley"
  | "info"
  | "zenuml"
  | "unknown";

/** Regex alternation for sanitizer: first diagram split + fence detection */
export const MERMAID_SYNTAX_START_ALTERNATION =
  [
    "graph\\b",
    "flowchart\\b",
    "sequenceDiagram\\b",
    "classDiagram\\b",
    "stateDiagram-v2\\b",
    "stateDiagram\\b",
    "erDiagram\\b",
    "gantt\\b",
    "pie\\b",
    "journey\\b",
    "gitGraph\\b",
    "mindmap\\b",
    "timeline\\b",
    "quadrantChart\\b",
    "xychart-beta\\b",
    "requirementDiagram\\b",
    "sankey-beta\\b",
    "block-beta\\b",
    "kanban\\b",
    "C4Context\\b",
    "C4Container\\b",
    "C4Component\\b",
    "C4Dynamic\\b",
    "C4Deployment\\b",
    "packet-beta\\b",
    "architecture-beta\\b",
    "radar-beta\\b",
    "venn\\b",
    "treeview\\b",
    "ishikawa\\b",
    "wardley-beta\\b",
    "info\\b",
    "zenuml\\b",
    "treemap-beta\\b",
  ].join("|");

function stripYamlFrontmatter(src: string): string {
  const t = src.trimStart();
  if (!t.startsWith("---")) return src;
  const end = t.indexOf("\n---", 3);
  if (end === -1) return src;
  return t.slice(end + 4).trimStart();
}

/** First non-empty, non-%% line after optional ```mermaid fence and frontmatter */
export function firstDiagramLine(source: string): string {
  let s = source.trim();
  const fence = /^```(?:\s*mermaid\s*)?\n?/i;
  if (fence.test(s)) {
    s = s.replace(fence, "");
    const close = s.indexOf("```");
    if (close !== -1) s = s.slice(0, close);
  }
  s = stripYamlFrontmatter(s);
  const lines = s.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("%%")) continue;
    return line;
  }
  return "";
}

export function detectDiagramKind(source: string): DiagramKind {
  const line = firstDiagramLine(source);
  if (!line.trim()) return "unknown";
  if (/^\s*(graph|flowchart)(\s|$)/i.test(line)) return "flowchart";
  if (/^\s*sequenceDiagram\b/i.test(line)) return "sequence";
  if (/^\s*classDiagram\b/i.test(line)) return "class";
  if (/^\s*stateDiagram-v2\b/i.test(line) || /^\s*stateDiagram\b/i.test(line)) return "state";
  if (/^\s*erDiagram\b/i.test(line)) return "er";
  if (/^\s*gantt\b/i.test(line)) return "gantt";
  if (/^\s*pie\b/i.test(line)) return "pie";
  if (/^\s*journey\b/i.test(line)) return "journey";
  if (/^\s*gitGraph\b/i.test(line)) return "git";
  if (/^\s*mindmap\b/i.test(line)) return "mindmap";
  if (/^\s*timeline\b/i.test(line)) return "timeline";
  if (/^\s*quadrantChart\b/i.test(line)) return "quadrant";
  if (/^\s*xychart-beta\b/i.test(line)) return "xy";
  if (/^\s*requirementDiagram\b/i.test(line)) return "requirement";
  if (/^\s*sankey-beta\b/i.test(line)) return "sankey";
  if (/^\s*block-beta\b/i.test(line)) return "block";
  if (/^\s*kanban\b/i.test(line)) return "kanban";
  if (/^\s*C4(Context|Container|Component|Dynamic|Deployment)\b/i.test(line)) return "c4";
  if (/^\s*packet-beta\b/i.test(line)) return "packet";
  if (/^\s*architecture-beta\b/i.test(line)) return "architecture";
  if (/^\s*radar-beta\b/i.test(line)) return "radar";
  if (/^\s*venn\b/i.test(line)) return "venn";
  if (/^\s*treeview\b/i.test(line)) return "tree";
  if (/^\s*ishikawa\b/i.test(line)) return "ishikawa";
  if (/^\s*wardley(?:-beta)?\b/i.test(line)) return "wardley";
  if (/^\s*info\b/i.test(line)) return "info";
  if (/^\s*zenuml\b/i.test(line)) return "zenuml";
  if (/^\s*treemap-beta\b/i.test(line)) return "unknown";
  return "unknown";
}

export function getRenderMode(source: string): RenderMode {
  const line = firstDiagramLine(source);
  if (!line.trim()) return "mermaid-svg";
  return /^\s*(graph|flowchart)(\s|$)/i.test(line) ? "reactflow" : "mermaid-svg";
}

export function diagramKindLabel(kind: DiagramKind): string {
  const labels: Record<DiagramKind, string> = {
    flowchart: "Flowchart",
    sequence: "Sequence",
    class: "Class",
    state: "State",
    er: "ER",
    gantt: "Gantt",
    pie: "Pie",
    journey: "User journey",
    git: "Git graph",
    mindmap: "Mindmap",
    timeline: "Timeline",
    quadrant: "Quadrant",
    xy: "XY chart",
    requirement: "Requirement",
    sankey: "Sankey",
    block: "Block",
    kanban: "Kanban",
    c4: "C4",
    packet: "Packet",
    architecture: "Architecture",
    radar: "Radar",
    venn: "Venn",
    tree: "Tree",
    ishikawa: "Ishikawa",
    wardley: "Wardley",
    info: "Info",
    zenuml: "ZenUML",
    unknown: "Mermaid",
  };
  return labels[kind];
}
