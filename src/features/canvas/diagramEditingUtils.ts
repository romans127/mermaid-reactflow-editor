import { Node, Edge } from 'reactflow';
import { ALIGNMENT_TYPES, DISTRIBUTION_TYPES, AlignmentType, DistributionType } from '@/constants';

export function alignNodes(
  nodes: Node[],
  selectedNodes: Node[],
  alignment: AlignmentType
): Node[] {
  if (selectedNodes.length < 2) return nodes;
  const bounds = selectedNodes.map(node => ({
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width: node.width || 150,
    height: node.height || 50,
  }));
  let newNodes = [...nodes];
  switch (alignment) {
    case ALIGNMENT_TYPES.LEFT:
      const leftX = Math.min(...bounds.map(b => b.x));
      bounds.forEach(bound => {
        const nodeIndex = newNodes.findIndex(n => n.id === bound.id);
        if (nodeIndex !== -1) {
          newNodes[nodeIndex] = { ...newNodes[nodeIndex], position: { ...newNodes[nodeIndex].position, x: leftX } };
        }
      });
      break;
    case ALIGNMENT_TYPES.RIGHT:
      const rightX = Math.max(...bounds.map(b => b.x + b.width));
      bounds.forEach(bound => {
        const nodeIndex = newNodes.findIndex(n => n.id === bound.id);
        if (nodeIndex !== -1) {
          newNodes[nodeIndex] = { ...newNodes[nodeIndex], position: { ...newNodes[nodeIndex].position, x: rightX - bound.width } };
        }
      });
      break;
    case ALIGNMENT_TYPES.TOP:
      const topY = Math.min(...bounds.map(b => b.y));
      bounds.forEach(bound => {
        const nodeIndex = newNodes.findIndex(n => n.id === bound.id);
        if (nodeIndex !== -1) {
          newNodes[nodeIndex] = { ...newNodes[nodeIndex], position: { ...newNodes[nodeIndex].position, y: topY } };
        }
      });
      break;
    case ALIGNMENT_TYPES.BOTTOM:
      const bottomY = Math.max(...bounds.map(b => b.y + b.height));
      bounds.forEach(bound => {
        const nodeIndex = newNodes.findIndex(n => n.id === bound.id);
        if (nodeIndex !== -1) {
          newNodes[nodeIndex] = { ...newNodes[nodeIndex], position: { ...newNodes[nodeIndex].position, y: bottomY - bound.height } };
        }
      });
      break;
    // Center nodes horizontally (align their centers on the X axis)
    case ALIGNMENT_TYPES.CENTER_HORIZONTAL: {
      const avgX = bounds.reduce((sum, b) => sum + b.x + b.width / 2, 0) / bounds.length;
      bounds.forEach(bound => {
        const nodeIndex = newNodes.findIndex(n => n.id === bound.id);
        if (nodeIndex !== -1) {
          newNodes[nodeIndex] = { ...newNodes[nodeIndex], position: { ...newNodes[nodeIndex].position, x: avgX - bound.width / 2 } };
        }
      });
    }
      break;

    // Center nodes vertically (align their centers on the Y axis)
    case ALIGNMENT_TYPES.CENTER_VERTICAL: {
      const avgY = bounds.reduce((sum, b) => sum + b.y + b.height / 2, 0) / bounds.length;
      bounds.forEach(bound => {
        const nodeIndex = newNodes.findIndex(n => n.id === bound.id);
        if (nodeIndex !== -1) {
          newNodes[nodeIndex] = { ...newNodes[nodeIndex], position: { ...newNodes[nodeIndex].position, y: avgY - bound.height / 2 } };
        }
      });
    }
      break;
  }
  return newNodes;
}

export function distributeNodes(
  nodes: Node[],
  selectedNodes: Node[],
  direction: DistributionType
): Node[] {
  if (selectedNodes.length < 3) return nodes;
  const bounds = selectedNodes.map(node => ({
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width: node.width || 150,
    height: node.height || 50,
    // keep centers available if needed elsewhere
    centerX: node.position.x + (node.width || 150) / 2,
    centerY: node.position.y + (node.height || 50) / 2,
  }));
  let newNodes = [...nodes];
  if (direction === DISTRIBUTION_TYPES.HORIZONTAL) {
    // Sort by left edge
    bounds.sort((a, b) => a.x - b.x);
    const leftEdge = bounds[0].x;
    const rightEdge = bounds[bounds.length - 1].x + bounds[bounds.length - 1].width;
    const totalWidths = bounds.reduce((s, b) => s + b.width, 0);
    // available space between outer edges minus widths
    const available = rightEdge - leftEdge - totalWidths;
    // spacing between adjacent node edges (clamp to 0 to avoid negative spacing)
    const spacing = Math.max(0, available / (bounds.length - 1));
    // place nodes sequentially starting from leftEdge
    let cursor = leftEdge;
    bounds.forEach((bound) => {
      const nodeIndex = newNodes.findIndex(n => n.id === bound.id);
      if (nodeIndex !== -1) {
        const newX = cursor;
        newNodes[nodeIndex] = { ...newNodes[nodeIndex], position: { ...newNodes[nodeIndex].position, x: newX } };
        cursor += bound.width + spacing;
      }
    });
  } else {
    // Sort by top edge
    bounds.sort((a, b) => a.y - b.y);
    const topEdge = bounds[0].y;
    const bottomEdge = bounds[bounds.length - 1].y + bounds[bounds.length - 1].height;
    const totalHeights = bounds.reduce((s, b) => s + b.height, 0);
    const available = bottomEdge - topEdge - totalHeights;
    const spacing = Math.max(0, available / (bounds.length - 1));
    let cursor = topEdge;
    bounds.forEach((bound) => {
      const nodeIndex = newNodes.findIndex(n => n.id === bound.id);
      if (nodeIndex !== -1) {
        const newY = cursor;
        newNodes[nodeIndex] = { ...newNodes[nodeIndex], position: { ...newNodes[nodeIndex].position, y: newY } };
        cursor += bound.height + spacing;
      }
    });
  }
  return newNodes;
}

export function bringToFront(nodes: Node[], selectedNodes: Node[]): Node[] {
  const maxZ = Math.max(...nodes.map(n => n.zIndex || 0));
  return nodes.map(node =>
    selectedNodes.some(sn => sn.id === node.id)
      ? { ...node, zIndex: maxZ + 1 }
      : node
  );
}

export function sendToBack(nodes: Node[], selectedNodes: Node[]): Node[] {
  const minZ = Math.min(...nodes.map(n => n.zIndex || 0));
  return nodes.map(node =>
    selectedNodes.some(sn => sn.id === node.id)
      ? { ...node, zIndex: minZ - 1 }
      : node
  );
}

// Counter to ensure unique IDs even when duplicating rapidly
let duplicateCounter = 0;

function nextEdgeId(prefix: string): string {
  try {
    return `${prefix}_${crypto.randomUUID?.() ?? Date.now()}_${duplicateCounter++}`;
  } catch {
    return `${prefix}_${Date.now()}_${duplicateCounter++}`;
  }
}

/** Clipboard / cross-session paste payload (also used for internal fallback). */
export const DIAGRAM_CLIPBOARD_VERSION = 1 as const;

export type DiagramClipboardPayload = {
  v: typeof DIAGRAM_CLIPBOARD_VERSION;
  nodes: Node[];
  edges: Edge[];
};

/** Clipboard text wrapper so paste is self-describing in plain text. */
export const CLIPBOARD_MAGIC = 'mermaid-reactflow-editor:clipboard:v1:';

export function parseDiagramClipboardText(text: string): DiagramClipboardPayload | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(CLIPBOARD_MAGIC)) return null;
  try {
    const raw = JSON.parse(trimmed.slice(CLIPBOARD_MAGIC.length)) as unknown;
    if (
      raw &&
      typeof raw === 'object' &&
      (raw as DiagramClipboardPayload).v === DIAGRAM_CLIPBOARD_VERSION &&
      Array.isArray((raw as DiagramClipboardPayload).nodes) &&
      Array.isArray((raw as DiagramClipboardPayload).edges)
    ) {
      return raw as DiagramClipboardPayload;
    }
  } catch {
    return null;
  }
  return null;
}

export function serializeDiagramClipboard(payload: DiagramClipboardPayload): string {
  return CLIPBOARD_MAGIC + JSON.stringify(payload);
}

/** Nodes and edges fully contained in the current selection (internal wiring only). */
export function extractSelectedSubgraph(
  nodes: Node[],
  edges: Edge[],
  selectedNodes: Node[]
): { nodes: Node[]; edges: Edge[] } {
  const ids = new Set(selectedNodes.map((n) => n.id));
  const subNodes = selectedNodes.map((n) => JSON.parse(JSON.stringify(n)) as Node);
  const subEdges = edges
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e) => JSON.parse(JSON.stringify(e)) as Edge);
  return { nodes: subNodes, edges: subEdges };
}

export type DuplicateSubgraphOptions = {
  /** When true (default), only the new copies are selected. */
  selectDuplicates?: boolean;
};

/**
 * Duplicate selected nodes offset by `offset`, including edges whose endpoints are both selected.
 * Remaps `parentNode` when the parent is part of the same selection.
 */
export function duplicateSelectedSubgraph(
  nodes: Node[],
  edges: Edge[],
  selectedNodes: Node[],
  offset: { x: number; y: number },
  options: DuplicateSubgraphOptions = {}
): { newNodes: Node[]; newEdges: Edge[] } {
  const { selectDuplicates = true } = options;
  if (selectedNodes.length === 0) return { newNodes: nodes, newEdges: edges };

  const selectedIds = new Set(selectedNodes.map((n) => n.id));
  const idMap = new Map<string, string>();
  const timestamp = Date.now();

  for (const n of selectedNodes) {
    idMap.set(n.id, `${n.id}_copy_${timestamp}_${duplicateCounter++}`);
  }

  const deselectOriginals = nodes.map((n) =>
    selectedIds.has(n.id) ? { ...n, selected: false } : n
  );

  const duplicates: Node[] = selectedNodes.map((node) => {
    const newId = idMap.get(node.id)!;
    const parentId =
      node.parentNode && selectedIds.has(node.parentNode)
        ? idMap.get(node.parentNode)
        : node.parentNode;
    return {
      ...node,
      id: newId,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
      parentNode: parentId,
      selected: selectDuplicates,
    };
  });

  const newInternalEdges: Edge[] = [];
  for (const e of edges) {
    if (!selectedIds.has(e.source) || !selectedIds.has(e.target)) continue;
    newInternalEdges.push({
      ...e,
      id: nextEdgeId(`e_${e.source}_${e.target}`),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      selected: selectDuplicates,
    });
  }

  return {
    newNodes: [...deselectOriginals, ...duplicates],
    newEdges: [...edges, ...newInternalEdges],
  };
}

/**
 * Alt/Option-drag clone finish: originals jump back to `startPositions`; copies stay at drop
 * positions (current node positions when this runs). Duplicate internal edges for the copy set.
 */
export function finalizeAltDragDuplicate(
  currentNodes: Node[],
  currentEdges: Edge[],
  duplicatedNodeIds: string[],
  startPositions: Map<string, { x: number; y: number }>
): { newNodes: Node[]; newEdges: Edge[] } {
  const selectedIds = new Set(duplicatedNodeIds);
  const selectedNodes = currentNodes.filter((n) => selectedIds.has(n.id));
  if (selectedNodes.length === 0) return { newNodes: currentNodes, newEdges: currentEdges };

  const idMap = new Map<string, string>();
  const timestamp = Date.now();
  for (const n of selectedNodes) {
    idMap.set(n.id, `${n.id}_copy_${timestamp}_${duplicateCounter++}`);
  }

  const duplicates: Node[] = selectedNodes.map((node) => {
    const newId = idMap.get(node.id)!;
    const parentId =
      node.parentNode && selectedIds.has(node.parentNode)
        ? idMap.get(node.parentNode)
        : node.parentNode;
    return {
      ...node,
      id: newId,
      position: { ...node.position },
      parentNode: parentId,
      selected: true,
    };
  });

  const resetNodes = currentNodes.map((n) => {
    if (!selectedIds.has(n.id)) return n;
    const start = startPositions.get(n.id);
    if (!start) return { ...n, selected: false };
    return {
      ...n,
      position: { x: start.x, y: start.y },
      selected: false,
    };
  });

  const newInternalEdges: Edge[] = [];
  for (const e of currentEdges) {
    if (!selectedIds.has(e.source) || !selectedIds.has(e.target)) continue;
    newInternalEdges.push({
      ...e,
      id: nextEdgeId(`e_alt_${e.id}`),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      selected: false,
    });
  }

  return {
    newNodes: [...resetNodes, ...duplicates],
    newEdges: [...currentEdges, ...newInternalEdges],
  };
}

/** Remap pasted subgraph ids and shift positions (for Cmd+V / paste). */
export function remapPastedSubgraph(
  payload: DiagramClipboardPayload,
  pasteOffset: { x: number; y: number }
): { nodes: Node[]; edges: Edge[] } {
  const oldIds = new Set(payload.nodes.map((n) => n.id));
  const idMap = new Map<string, string>();
  const ts = Date.now();
  for (const n of payload.nodes) {
    idMap.set(n.id, `paste_${n.id}_${ts}_${duplicateCounter++}`);
  }

  const nodes: Node[] = payload.nodes.map((node) => ({
    ...node,
    id: idMap.get(node.id)!,
    position: {
      x: node.position.x + pasteOffset.x,
      y: node.position.y + pasteOffset.y,
    },
    parentNode:
      node.parentNode && oldIds.has(node.parentNode)
        ? idMap.get(node.parentNode)
        : undefined,
    selected: true,
  }));

  const edges: Edge[] = payload.edges.map((e) => ({
    ...e,
    id: nextEdgeId(`paste_e`),
    source: idMap.get(e.source)!,
    target: idMap.get(e.target)!,
    selected: true,
  }));

  return { nodes, edges };
}

/** @deprecated Prefer duplicateSelectedSubgraph(nodes, edges, …) for edge-aware duplication. */
export function duplicateNodes(nodes: Node[], selectedNodes: Node[]): Node[] {
  const { newNodes } = duplicateSelectedSubgraph(nodes, [], selectedNodes, { x: 50, y: 50 });
  return newNodes;
}

export function deleteSelected(nodes: Node[], edges: Edge[], selectedNodes: Node[], selectedEdges: Edge[]) {
  const nodeIdsToDelete = selectedNodes.map(n => n.id);
  const edgeIdsToDelete = selectedEdges.map(e => e.id);
  const newNodes = nodes.filter(n => !nodeIdsToDelete.includes(n.id));
  // Remove selected edges AND edges connected to deleted nodes
  const newEdges = edges.filter(e => 
    !edgeIdsToDelete.includes(e.id) && 
    !nodeIdsToDelete.includes(e.source) && 
    !nodeIdsToDelete.includes(e.target)
  );
  return { newNodes, newEdges };
}

export function lockNodes(nodes: Node[], selectedNodes: Node[]): Node[] {
  return nodes.map(node =>
    selectedNodes.some(sn => sn.id === node.id)
      ? { ...node, draggable: false, data: { ...node.data, locked: true } }
      : node
  );
}

export function unlockNodes(nodes: Node[], selectedNodes: Node[]): Node[] {
  return nodes.map(node =>
    selectedNodes.some(sn => sn.id === node.id)
      ? { ...node, draggable: true, data: { ...node.data, locked: false } }
      : node
  );
}
