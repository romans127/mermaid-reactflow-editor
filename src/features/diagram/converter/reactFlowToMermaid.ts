import type { Edge, Node } from "reactflow";

/**
 * Serializes the React Flow canvas back to Mermaid `flowchart` / `graph` text.
 *
 * **Scope:** Only flowcharts / graphs that the forward converter (`mermaidToReactFlow`)
 * can parse into React Flow. This is NOT a general Mermaid serializer: ERD, Gantt,
 * sequence diagrams, etc. are out of scope and are not represented as editable RF nodes.
 */
export type FlowchartDirection = "TB" | "BT" | "LR" | "RL";

export type FlowchartKeyword = "flowchart" | "graph";

export interface ReactFlowToMermaidOptions {
  /** `flowchart` (default) or `graph` — taken from `previousSource` when omitted. */
  diagramKeyword?: FlowchartKeyword;
  /** Layout direction; taken from `previousSource` or defaults to TB when omitted. */
  direction?: FlowchartDirection;
  /** Prior editor source: preserves heading (`graph` vs `flowchart`) and direction. */
  previousSource?: string;
}

export interface ParsedFlowchartHeading {
  keyword: FlowchartKeyword;
  direction: FlowchartDirection;
}

const SUBGRAPH_PREFIX = "subgraph-";

/** Read `flowchart`/`graph` + direction from existing Mermaid (best-effort). */
export function parseFlowchartHeadingFromSource(
  source: string | undefined
): ParsedFlowchartHeading {
  const s = (source ?? "").trim();
  const m = s.match(/(?:^|\n)\s*(flowchart|graph)\s+(TB|TD|BT|RL|LR)\b/i);
  if (!m) {
    return { keyword: "flowchart", direction: "TB" };
  }
  const keyword = m[1].toLowerCase() as FlowchartKeyword;
  let direction = m[2].toUpperCase() as FlowchartDirection | "TD";
  if (direction === "TD") direction = "TB";
  return { keyword, direction };
}

function normalizeDirection(d: string): FlowchartDirection {
  const u = d.toUpperCase();
  if (u === "TD") return "TB";
  if (u === "TB" || u === "BT" || u === "LR" || u === "RL") return u;
  return "TB";
}

function graphId(rfSubgraphNodeId: string): string {
  return rfSubgraphNodeId.startsWith(SUBGRAPH_PREFIX)
    ? rfSubgraphNodeId.slice(SUBGRAPH_PREFIX.length)
    : rfSubgraphNodeId;
}

/** Escape text used inside Mermaid double-quoted bracket / subgraph titles. */
export function escapeForMermaidQuotedText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "<br/>")
    .replace(/"/g, "#quot;");
}

function needsQuotedBracketInner(inner: string): boolean {
  return (
    inner === "" ||
    /[\s"#\[\]{}<>|]/.test(inner) ||
    inner.includes("<br/>")
  );
}

function formatBracketLabelContent(raw: string): string {
  const inner = escapeForMermaidQuotedText(raw);
  if (needsQuotedBracketInner(inner)) {
    return `"${inner}"`;
  }
  return inner;
}

function getNodeLabel(n: Node): string {
  const d = n.data as Record<string, unknown> | undefined;
  let text =
    typeof d?.label === "string"
      ? d.label
      : typeof n.data === "object" && n.data && "label" in n.data
        ? String((n.data as { label?: unknown }).label ?? "")
        : "";
  const imageUrl =
    typeof d?.imageUrl === "string" ? (d.imageUrl as string) : "";
  if (imageUrl) {
    text = `${text} ${imageUrl}`.trim();
  }
  return text;
}

function getNodeShape(n: Node): string {
  if (n.type === "diamond") return "diamond";
  const d = n.data as Record<string, unknown> | undefined;
  const shape = typeof d?.shape === "string" ? d.shape : "rect";
  return shape || "rect";
}

function emitNodeDefinition(n: Node): string {
  const id = n.id;
  const label = getNodeLabel(n);
  const shape = getNodeShape(n);
  const inner = formatBracketLabelContent(label || id);
  let def: string;
  switch (shape) {
    case "diamond":
      def = `${id}{${inner}}`;
      break;
    case "circle":
      def = `${id}((${inner}))`;
      break;
    case "stadium":
      def = `${id}([${inner}])`;
      break;
    case "round":
      def = `${id}(${inner})`;
      break;
    default:
      def = `${id}[${inner}]`;
      break;
  }
  return def;
}

function getMermaidLinkOperator(edge: Edge): string {
  const data = edge.data as { mermaidLinkStyle?: string } | undefined;
  if (typeof data?.mermaidLinkStyle === "string" && data.mermaidLinkStyle.length) {
    return data.mermaidLinkStyle;
  }
  const sty = edge.style as
    | { strokeDasharray?: string | number; strokeWidth?: number | string }
    | undefined;
  const dash = String(sty?.strokeDasharray ?? "");
  const sw = sty?.strokeWidth;
  const swNum = typeof sw === "number" ? sw : typeof sw === "string" ? parseFloat(sw) : NaN;
  if (dash.includes("8")) return "---";
  if (dash.includes("4")) return "-.->";
  if (!Number.isNaN(swNum) && Math.abs(swNum - 4) < 0.01) return "==>";
  return "-->";
}

function formatEdgeMiddle(link: string, label: string | undefined): string {
  const l = typeof label === "string" ? label.trim() : "";
  if (!l) return link;
  const pipe =
    l.includes("|") || l.includes('"')
      ? `"${l.replace(/"/g, "#quot;")}"`
      : l;
  return `${link}|${pipe}|`;
}

export function rfEndpointToMermaid(nodeId: string): string {
  return graphId(nodeId);
}

function sortNodesStable(list: Node[]): Node[] {
  return [...list].sort((a, b) => a.id.localeCompare(b.id));
}

function sortEdgesStable(list: Edge[]): Edge[] {
  return [...list].sort((a, b) => {
    const s = a.source.localeCompare(b.source);
    if (s !== 0) return s;
    const t = a.target.localeCompare(b.target);
    if (t !== 0) return t;
    const la = String(a.label ?? "");
    const lb = String(b.label ?? "");
    return la.localeCompare(lb);
  });
}

/**
 * Convert React Flow nodes/edges to a Mermaid flowchart string.
 * Node order: nested subgraphs (group) first, then standalone definitions, then edges.
 */
export function reactFlowToMermaid(
  nodes: Node[],
  edges: Edge[],
  options?: ReactFlowToMermaidOptions
): string {
  const heading = parseFlowchartHeadingFromSource(options?.previousSource);
  const keyword = options?.diagramKeyword ?? heading.keyword;
  const direction =
    options?.direction ?? heading.direction;

  const groupNodes = nodes.filter((n) => n.type === "group");
  const validGroupRfIds = new Set(groupNodes.map((g) => g.id));

  function effectiveParent(node: Node): string | undefined {
    const p = node.parentNode;
    if (!p) return undefined;
    return validGroupRfIds.has(p) ? p : undefined;
  }

  const childGroups = new Map<string, Node[]>();
  for (const g of groupNodes) {
    const p = effectiveParent(g) ?? "__root__";
    const arr = childGroups.get(p) ?? [];
    arr.push(g);
    childGroups.set(p, arr);
  }
  for (const [_k, arr] of childGroups) {
    arr.sort((a, b) => a.id.localeCompare(b.id));
  }

  const lines: string[] = [];
  lines.push(`${keyword} ${direction}`);

  const emittedGroupIds = new Set<string>();

  function emitSubgraph(group: Node, indent: string): void {
    if (emittedGroupIds.has(group.id)) return;
    emittedGroupIds.add(group.id);

    const gid = graphId(group.id);
    const titleRaw =
      typeof (group.data as { label?: unknown } | undefined)?.label === "string"
        ? String((group.data as { label: string }).label)
        : gid;
    lines.push(`${indent}subgraph ${gid} ["${escapeForMermaidQuotedText(titleRaw)}"]`);

    const dir = (group.data as { subgraphDirection?: string } | undefined)
      ?.subgraphDirection;
    if (dir) {
      lines.push(`${indent}  direction ${normalizeDirection(dir)}`);
    }

    const kids = childGroups.get(group.id) ?? [];
    for (const childSg of kids) {
      emitSubgraph(childSg, `${indent}  `);
    }

    const innerNodes = sortNodesStable(
      nodes.filter(
        (n) =>
          n.type !== "group" &&
          effectiveParent(n) === group.id
      )
    );
    for (const n of innerNodes) {
      lines.push(`${indent}  ${emitNodeDefinition(n)}`);
    }

    lines.push(`${indent}end`);
  }

  const roots = childGroups.get("__root__") ?? [];
  for (const rg of roots) {
    emitSubgraph(rg, "");
  }

  const standaloneNodes = sortNodesStable(
    nodes.filter((n) => n.type !== "group" && !effectiveParent(n))
  );
  for (const n of standaloneNodes) {
    lines.push(emitNodeDefinition(n));
  }

  for (const e of sortEdgesStable(edges)) {
    const src = rfEndpointToMermaid(e.source);
    const tgt = rfEndpointToMermaid(e.target);
    const link = getMermaidLinkOperator(e);
    const mid = formatEdgeMiddle(link, e.label as string | undefined);
    lines.push(`${src} ${mid} ${tgt}`);
  }

  return lines.join("\n") + "\n";
}
