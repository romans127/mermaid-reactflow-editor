import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import ReactFlow, {
  Connection,
  ConnectionLineType,
  ConnectionMode,
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  EdgeChange,
  MarkerType,
  MiniMap,
  Node,
  NodeChange,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '@/selected-edge.css';
import { exportReactFlowImage } from './exportImage';
import {
  alignNodes,
  bringToFront,
  deleteSelected,
  DIAGRAM_CLIPBOARD_VERSION,
  distributeNodes,
  duplicateSelectedSubgraph,
  extractSelectedSubgraph,
  finalizeAltDragDuplicate,
  type DiagramClipboardPayload,
  parseDiagramClipboardText,
  remapPastedSubgraph,
  serializeDiagramClipboard,
  lockNodes,
  sendToBack,
  unlockNodes,
} from './diagramEditingUtils';
import { CustomNode } from './nodes/CustomNode';
import { DiamondNode } from './nodes/DiamondNode';
import { NodeEditor } from '@/components/NodeEditor';
import { SubgraphNode } from './nodes/SubgraphNode';
import { EditingToolbar } from '@/components/EditingToolbar';
import { EdgeLabelEditor } from '@/components/EdgeLabelEditor';
import PaletteToolbar from '@/components/PaletteToolbar';
import { SearchControl } from '@/components/SearchControl';
import { NodeSearchDialog } from '@/components/NodeSearchDialog';
import { ALIGNMENT_TYPES, DISTRIBUTION_TYPES, AlignmentType, DistributionType } from '@/constants';

/** Skip canvas shortcuts while typing in Monaco, form fields, or open dialogs. */
function isCanvasShortcutBlocked(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return true;
  if (target.closest('[role="dialog"]')) return true;
  if (target.closest('.monaco-editor')) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

interface FlowDiagramProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onSelectionChange?: (selectedNodes: Node[], selectedEdges: Edge[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onRequestPreview?: () => void;
  onRegisterMethods?: (methods: { openSearch?: () => void; exportImage?: () => Promise<void>; selectSubgraphContents?: (id?: string) => void }) => void;
  interactive?: boolean; // when false, disable user interactions (used during streaming)
  theme?: 'light' | 'dark'; // Theme for styling the ReactFlow container
}

function FlowDiagramInternal({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange: onNodesChangeCallback,
  onEdgesChange: onEdgesChangeCallback,
  onSelectionChange,
  onRequestPreview,
  onRegisterMethods,
  interactive = true,
  theme = 'light',
}: FlowDiagramProps) {
  const reactFlowInstance = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const selectedNodesRef = useRef<Node[]>([]);
  const nodesRef = useRef<Node[]>(initialNodes);
  const internalClipboardRef = useRef<DiagramClipboardPayload | null>(null);
  const altDragSessionRef = useRef<{
    nodeIds: string[];
    startPositions: Map<string, { x: number; y: number }>;
  } | null>(null);

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([]);

  selectedNodesRef.current = selectedNodes;
  nodesRef.current = nodes;
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [edgeLabelEditor, setEdgeLabelEditor] = useState<{
    edgeId: string;
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // inspector removed per UX decision

  // keep local state in sync if parent props change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  const nodeTypes = useMemo(
    () => ({
      custom: CustomNode,
  diamond: DiamondNode,
      group: SubgraphNode,
    }),
    []
  );

  const onNodeDragStart = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setIsDragging(true);
      if (!interactive || !event.altKey) {
        altDragSessionRef.current = null;
        return;
      }
      // Alt/Option-drag: snapshot start positions; on drag end originals return here and
      // duplicates remain at drop positions (edges between selected nodes are duplicated too).
      const sel = selectedNodesRef.current;
      const toDup = sel.length > 0 ? sel : [node];
      const nodeIds = toDup.map((n) => n.id);
      const startPositions = new Map<string, { x: number; y: number }>();
      for (const id of nodeIds) {
        const n = nodesRef.current.find((x) => x.id === id);
        if (n) startPositions.set(id, { x: n.position.x, y: n.position.y });
      }
      altDragSessionRef.current = { nodeIds, startPositions };
    },
    [interactive]
  );

  const handleDownloadImage = async () => {
    if (!reactFlowWrapper.current || !reactFlowInstance) return;
    await exportReactFlowImage({
      wrapper: reactFlowWrapper.current,
      nodes,
      reactFlowInstance,
      setExporting,
      onError: (err) => alert('Failed to export image: ' + err),
      fileName: 'reactflow-diagram.png',
      pixelRatio: 8,
    });
  };

  // Register methods so parent can trigger search/export actions
  useEffect(() => {
    if (onRegisterMethods) {
      onRegisterMethods({
        openSearch: () => setShowSearch(true),
        exportImage: handleDownloadImage,
        // expose selectSubgraphContents so parent toolbar can trigger it
        selectSubgraphContents: (id?: string) => onSelectSubgraphContents(id),
      } as any);
    }
    // unregister on unmount
    return () => {
      if (onRegisterMethods) onRegisterMethods({});
    };
  }, [onRegisterMethods, handleDownloadImage]);

  // only update selected sets when selection actually changes
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const hasSelectChange = changes.some((c) => c.type === 'select');
      unstable_batchedUpdates(() => {
        setNodes((nds) => {
          const updated = applyNodeChanges(changes, nds);
          if (hasSelectChange) {
            const sel = updated.filter((n) => n.selected);
            setSelectedNodes(sel);
          }
          return updated;
        });
      });
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const hasSelectChange = changes.some((c) => c.type === 'select');
      unstable_batchedUpdates(() => {
        setEdges((eds) => {
          const updated = applyEdgeChanges(changes, eds);
          if (hasSelectChange) {
            const sel = updated.filter((e) => e.selected);
            setSelectedEdges(sel);
          }
          return updated;
        });
      });
    },
    [setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#1976D2', strokeWidth: 2.5 },
            data: { mermaidLinkStyle: '-->' },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
              color: '#1976D2',
            },
          },
          eds
        );
        if (onEdgesChangeCallback) onEdgesChangeCallback(next);
        return next;
      });
    },
    [setEdges, onEdgesChangeCallback]
  );

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id);
      setEdges((eds) => {
        const updated = eds.map((e) => ({ ...e, selected: e.id === edge.id }));
        setSelectedEdges(updated.filter((e) => e.selected));
        return updated;
      });
    },
    [setEdges]
  );

  const handleFocusNode = useCallback(
    (nodeId: string) => {
      if (!reactFlowInstance) return;
      reactFlowInstance.fitView({ nodes: [{ id: nodeId }], duration: 600, padding: 0.3 });
      // brief highlight
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, style: { ...n.style, outline: '3px solid #ff6b6b' } } : n
        )
      );
      setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) => (n.id === nodeId ? { ...n, style: { ...n.style, outline: undefined } } : n))
        );
      }, 1200);
    },
    [reactFlowInstance, setNodes]
  );

  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    const container = reactFlowWrapper.current;
    const rect = container ? container.getBoundingClientRect() : ({ left: 0, top: 0 } as any);
    setEdgeLabelEditor({
      edgeId: edge.id,
      text: String(edge.label ?? ''),
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }, []);

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setShowNodeEditor(true);
  }, []);

  const onNodeDragStopLocal = useCallback(() => {
    setIsDragging(false);
    const session = altDragSessionRef.current;
    altDragSessionRef.current = null;

    const latestNodes = reactFlowInstance.getNodes();
    const latestEdges = reactFlowInstance.getEdges();

    if (session && interactive) {
      const { newNodes, newEdges } = finalizeAltDragDuplicate(
        latestNodes,
        latestEdges,
        session.nodeIds,
        session.startPositions
      );
      unstable_batchedUpdates(() => {
        setNodes(newNodes);
        setEdges(newEdges);
        setSelectedNodes(newNodes.filter((n) => n.selected));
        setSelectedEdges(newEdges.filter((e) => e.selected));
      });
      if (onNodesChangeCallback) onNodesChangeCallback(newNodes);
      if (onEdgesChangeCallback) onEdgesChangeCallback(newEdges);
    } else {
      if (onNodesChangeCallback) onNodesChangeCallback(latestNodes);
      if (onEdgesChangeCallback) onEdgesChangeCallback(latestEdges);
    }
  }, [
    interactive,
    reactFlowInstance,
    setNodes,
    setEdges,
    onNodesChangeCallback,
    onEdgesChangeCallback,
  ]);

  // Notify parent about selection changes after React has updated local selection state
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedNodes, selectedEdges);
    }
  }, [selectedNodes, selectedEdges, onSelectionChange]);

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data, style: { ...n.data?.style, ...data?.style } } } : n
        );
        if (onNodesChangeCallback) onNodesChangeCallback(updated);
        return updated;
      });
    },
    [onNodesChangeCallback, setNodes]
  );

  const edgesWithSelection = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        className: edge.id === selectedEdgeId ? 'selected' : undefined,
      })),
    [edges, selectedEdgeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null);
    reactFlowWrapper.current?.focus({ preventScroll: true });
  }, []);

  // toolbar actions
  const onAlignNodes = useCallback(
    (alignment: AlignmentType) => {
      const newNodes = alignNodes(nodes, selectedNodes, alignment);
      setNodes(newNodes);
      if (onNodesChangeCallback) onNodesChangeCallback(newNodes);
    },
    [selectedNodes, nodes, onNodesChangeCallback]
  );

  const onDistributeNodes = useCallback(
    (direction: DistributionType) => {
      const newNodes = distributeNodes(nodes, selectedNodes, direction);
      setNodes(newNodes);
      if (onNodesChangeCallback) onNodesChangeCallback(newNodes);
    },
    [selectedNodes, nodes, onNodesChangeCallback]
  );

  const onBringToFront = useCallback(() => {
    const newNodes = bringToFront(nodes, selectedNodes);
    setNodes(newNodes);
    if (onNodesChangeCallback) onNodesChangeCallback(newNodes);
  }, [selectedNodes, nodes, onNodesChangeCallback]);

  const onSendToBack = useCallback(() => {
    const newNodes = sendToBack(nodes, selectedNodes);
    setNodes(newNodes);
    if (onNodesChangeCallback) onNodesChangeCallback(newNodes);
  }, [selectedNodes, nodes, onNodesChangeCallback]);

  const onDuplicateNodes = useCallback(() => {
    if (selectedNodes.length === 0) return;
    const { newNodes, newEdges } = duplicateSelectedSubgraph(nodes, edges, selectedNodes, { x: 50, y: 50 });
    unstable_batchedUpdates(() => {
      setNodes(newNodes);
      setEdges(newEdges);
      setSelectedNodes(newNodes.filter((n) => n.selected));
      setSelectedEdges(newEdges.filter((e) => e.selected));
    });
    if (onNodesChangeCallback) onNodesChangeCallback(newNodes);
    if (onEdgesChangeCallback) onEdgesChangeCallback(newEdges);
  }, [selectedNodes, nodes, edges, onNodesChangeCallback, onEdgesChangeCallback, setNodes, setEdges]);

  const onDeleteSelected = useCallback(() => {
    const { newNodes, newEdges } = deleteSelected(nodes, edges, selectedNodes, selectedEdges);
    setNodes(newNodes);
    setEdges(newEdges);
    setSelectedNodes([]);
    setSelectedEdges([]);
    if (onNodesChangeCallback) onNodesChangeCallback(newNodes);
    if (onEdgesChangeCallback) onEdgesChangeCallback(newEdges);
  }, [selectedNodes, selectedEdges, nodes, edges, onNodesChangeCallback, onEdgesChangeCallback]);

  const onSelectAllCanvas = useCallback(() => {
    const nextNodes = nodes.map((n) => ({ ...n, selected: true }));
    const nextEdges = edges.map((e) => ({ ...e, selected: true }));
    unstable_batchedUpdates(() => {
      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelectedNodes(nextNodes);
      setSelectedEdges(nextEdges);
    });
    if (onNodesChangeCallback) onNodesChangeCallback(nextNodes);
    if (onEdgesChangeCallback) onEdgesChangeCallback(nextEdges);
  }, [nodes, edges, setNodes, setEdges, onNodesChangeCallback, onEdgesChangeCallback]);

  const copySelection = useCallback(async () => {
    if (selectedNodes.length === 0) return;
    const { nodes: sn, edges: se } = extractSelectedSubgraph(nodes, edges, selectedNodes);
    const payload: DiagramClipboardPayload = { v: DIAGRAM_CLIPBOARD_VERSION, nodes: sn, edges: se };
    internalClipboardRef.current = payload;
    const text = serializeDiagramClipboard(payload);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* keep internalClipboardRef */
    }
  }, [nodes, edges, selectedNodes]);

  const cutSelection = useCallback(async () => {
    if (selectedNodes.length === 0) return;
    await copySelection();
    onDeleteSelected();
  }, [copySelection, onDeleteSelected, selectedNodes.length]);


  const pasteFromClipboard = useCallback(async () => {
    let payload: DiagramClipboardPayload | null = internalClipboardRef.current;
    try {
      const t = await navigator.clipboard.readText();
      const parsed = parseDiagramClipboardText(t);
      if (parsed) payload = parsed;
    } catch {
      /* use internalClipboardRef only */
    }
    if (!payload || payload.nodes.length === 0) return;

    const clearedNodes = nodes.map((n) => ({ ...n, selected: false }));
    const clearedEdges = edges.map((e) => ({ ...e, selected: false }));
    const { nodes: pn, edges: pe } = remapPastedSubgraph(payload, { x: 20, y: 20 });
    const nextNodes = [...clearedNodes, ...pn];
    const nextEdges = [...clearedEdges, ...pe];
    unstable_batchedUpdates(() => {
      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelectedNodes(pn);
      setSelectedEdges(pe);
    });
    if (onNodesChangeCallback) onNodesChangeCallback(nextNodes);
    if (onEdgesChangeCallback) onEdgesChangeCallback(nextEdges);
  }, [nodes, edges, onNodesChangeCallback, onEdgesChangeCallback, setNodes, setEdges]);

  /** Canvas shortcuts: require focus on the diagram wrapper (click toolbar/pane). Skipped in Monaco, dialogs, inputs. */
  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!interactive) return;
      if (!reactFlowWrapper.current?.contains(e.target as HTMLElement)) return;
      if (isCanvasShortcutBlocked(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (mod && key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        return;
      }

      if (key === 'Escape') {
        setShowSearch(false);
        return;
      }

      if (mod && key === 'a') {
        e.preventDefault();
        onSelectAllCanvas();
        return;
      }

      if (mod && key === 'd') {
        e.preventDefault();
        onDuplicateNodes();
        return;
      }

      if (mod && key === 'c') {
        e.preventDefault();
        void copySelection();
        return;
      }

      if (mod && key === 'x') {
        e.preventDefault();
        void cutSelection();
        return;
      }

      if (mod && key === 'v') {
        e.preventDefault();
        void pasteFromClipboard();
        return;
      }
    },
    [
      interactive,
      copySelection,
      cutSelection,
      pasteFromClipboard,
      onDuplicateNodes,
      onSelectAllCanvas,
    ]
  );

  const onLockNodes = useCallback(() => {
    const newNodes = lockNodes(nodes, selectedNodes);
    setNodes(newNodes);
    // Update selectedNodes to reflect the new locked state, filtering out any that no longer exist
    setSelectedNodes(prevSelected => 
      prevSelected
        .map(selectedNode => newNodes.find(n => n.id === selectedNode.id))
        .filter((node): node is Node => node !== undefined)
    );
    if (onNodesChangeCallback) onNodesChangeCallback(newNodes);
  }, [selectedNodes, nodes, onNodesChangeCallback]);

  const onUnlockNodes = useCallback(() => {
    const newNodes = unlockNodes(nodes, selectedNodes);
    setNodes(newNodes);
    // Update selectedNodes to reflect the new unlocked state, filtering out any that no longer exist
    setSelectedNodes(prevSelected => 
      prevSelected
        .map(selectedNode => newNodes.find(n => n.id === selectedNode.id))
        .filter((node): node is Node => node !== undefined)
    );
    if (onNodesChangeCallback) onNodesChangeCallback(newNodes);
  }, [selectedNodes, nodes, onNodesChangeCallback]);

  const onSelectSubgraphContents = useCallback(
    (subgraphNodeId?: string) => {
      if (!subgraphNodeId) return;
      const parentId = subgraphNodeId;
      setNodes((nds) => {
        const updated = nds.map((n) => ({ ...n, selected: n.parentNode === parentId }));
        setSelectedNodes(updated.filter((n) => n.selected));
        if (onNodesChangeCallback) onNodesChangeCallback(updated);
        return updated;
      });
      setEdges((eds) => {
        const nodeIds = new Set(nodes.filter((n) => n.parentNode === parentId).map((n) => n.id));
        const updated = eds.map((e) => ({ ...e, selected: nodeIds.has(e.source) && nodeIds.has(e.target) }));
        setSelectedEdges(updated.filter((e) => e.selected));
        if (onEdgesChangeCallback) onEdgesChangeCallback(updated);
        return updated;
      });
    },
    [nodes, onNodesChangeCallback, onEdgesChangeCallback]
  );

  const saveEdgeLabel = useCallback(
    (edgeId: string, text: string) => {
      setEdges((eds) => {
        const updated = eds.map((e) => (e.id === edgeId ? { ...e, label: text } : e));
        if (onEdgesChangeCallback) onEdgesChangeCallback(updated);
        return updated;
      });
      setEdgeLabelEditor(null);
    },
    [onEdgesChangeCallback]
  );

  const cancelEdgeLabelEdit = useCallback(() => setEdgeLabelEditor(null), []);

  return (
  <>
  {/* Search control moved to top nav; no floating search button */}

  {/* Download/export image moved to top nav; no floating download button */}

  {/* Preview is controlled by top nav in App; no floating preview buttons inside canvas */}

      {exporting && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: '#fff',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              border: '6px solid #e3e3e3',
              borderTop: '6px solid #1976D2',
              borderRadius: '50%',
              width: 48,
              height: 48,
              animation: 'spin 1s linear infinite',
              marginBottom: 16,
            }}
          />
          <div style={{ fontSize: 18, color: '#1976D2', fontWeight: 500 }}>Exporting image...</div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`}</style>
        </div>
      )}

      {/* Legacy floating search retained for now (optional). The new dialog offers better UI. */}
      {/* <SearchControl nodes={nodes} onFocusNode={handleFocusNode} onClose={() => setShowSearch(false)} isVisible={showSearch} /> */}
      <NodeSearchDialog
        open={showSearch}
        nodes={nodes}
        onOpenChange={(o) => setShowSearch(o)}
        onSelectNode={(id) => {
          handleFocusNode(id);
          setShowSearch(false);
        }}
      />

  <div
      style={{ width: '100%', height: '100%' }}
      ref={reactFlowWrapper}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={handleCanvasKeyDown}
      onMouseDownCapture={(e) => {
        if (!interactive) return;
        if (isCanvasShortcutBlocked(e.target)) return;
        reactFlowWrapper.current?.focus({ preventScroll: true });
      }}
      className={`outline-none ${isDragging ? 'dragging' : ''} ${interactive ? '' : 'streaming-mode'} ${theme === 'dark' ? 'dark' : ''} relative flex flex-col`.trim()}
    >
        <div className="p-2">
          <div className="flex items-center gap-3">
            <EditingToolbar
              selectedNodes={selectedNodes}
              selectedEdges={selectedEdges}
              onAlignNodes={onAlignNodes}
              onDistributeNodes={onDistributeNodes}
              onDuplicateNodes={onDuplicateNodes}
              onDeleteSelected={onDeleteSelected}
              onLockNodes={onLockNodes}
              onUnlockNodes={onUnlockNodes}
              onSelectSubgraphContents={onSelectSubgraphContents}
              onOpenSearch={() => setShowSearch(true)}
              placement="inline"
            />
          </div>
          <div className="mt-2">
            <PaletteToolbar />
          </div>
        </div>
        <div className="flex-1 min-h-0">
        <ReactFlow
          minZoom={0.05}
          nodes={nodes}
          edges={edgesWithSelection}
          onlyRenderVisibleElements
          onNodeDragStart={interactive ? onNodeDragStart : undefined}
          onNodeDragStop={interactive ? onNodeDragStopLocal : undefined}
          onNodesChange={interactive ? onNodesChange : undefined}
          onEdgesChange={interactive ? onEdgesChange : undefined}
          onConnect={interactive ? onConnect : undefined}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Delete', 'Backspace']}
          nodesDraggable={interactive}
          nodesConnectable={interactive}
          elementsSelectable={interactive}
          // Allow panning the canvas even when node interactions are disabled (streaming)
          panOnDrag={true}
          // Always allow zooming with the mouse wheel; disable wheel-to-pan so scroll zooms
          panOnScroll={false}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={interactive}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#1976D2', strokeWidth: 2.5 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#1976D2' },
          }}
          connectionLineType={ConnectionLineType.SmoothStep}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          edgesUpdatable={true}
          connectionMode={ConnectionMode.Loose}
          onEdgeUpdate={(oldEdge, newConnection) => {
            if (!newConnection.source || !newConnection.target) return;
            setEdges((eds) => {
              const updated = eds.map((e) =>
                e.id === oldEdge.id
                  ? { ...e, ...newConnection, source: newConnection.source!, target: newConnection.target! }
                  : e
              );
              if (onEdgesChangeCallback) onEdgesChangeCallback(updated);
              return updated;
            });
          }}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/reactflow');
            if (!type) return;
            const bounds = reactFlowWrapper.current!.getBoundingClientRect();
            const position = reactFlowInstance.project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
            const id = `${type}-${Date.now()}`;
            let newNode: any;
            if (type === 'node') {
              newNode = { id, type: 'custom', position, data: { label: 'New Node' }, style: { width: 150, height: 50 } };
            } else if (type === 'subgraph') {
              newNode = { id, type: 'group', position, data: { label: 'New Subgraph' }, style: { width: 220, height: 120, background: '#e3f2fd', border: '2px dashed #1976D2' } };
            } else if (type === 'diamond') {
              newNode = { id, type: 'diamond', position, data: { label: 'Conditional' }, style: { width: 120, height: 120, backgroundColor: '#FFF3E0', borderColor: '#F57C00' } };
            }
            if (newNode) {
              setNodes((nds) => {
                const updated = [...nds, newNode];
                if (onNodesChangeCallback) onNodesChangeCallback(updated);
                return updated;
              });
            }
          }}
  >
          <Background variant={BackgroundVariant.Dots} />
          <Controls />
          <MiniMap />
        </ReactFlow>
  </div>
      </div>

  {/* Inspector removed per user request */}

      {edgeLabelEditor && (
        <EdgeLabelEditor
          open={true}
          x={edgeLabelEditor.x}
          y={edgeLabelEditor.y}
          text={edgeLabelEditor.text}
          onChange={(t) => setEdgeLabelEditor({ ...edgeLabelEditor, text: t })}
          onSave={() => saveEdgeLabel(edgeLabelEditor.edgeId, edgeLabelEditor.text)}
          onCancel={cancelEdgeLabelEdit}
        />
      )}

      {showNodeEditor && (
        <NodeEditor
          node={selectedNode}
          onUpdate={handleNodeUpdate}
          onClose={() => {
            setShowNodeEditor(false);
            setSelectedNode(null);
          }}
        />
      )}
    </>
  );
}

export function FlowDiagram(props: FlowDiagramProps) {
  return (
    <ReactFlowProvider>
      <FlowDiagramInternal {...props} />
    </ReactFlowProvider>
  );
}
