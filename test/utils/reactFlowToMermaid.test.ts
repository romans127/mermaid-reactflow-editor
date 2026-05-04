import { describe, expect, it } from "vitest";
import type { Edge, Node } from "reactflow";
import {
  escapeForMermaidQuotedText,
  parseFlowchartHeadingFromSource,
  reactFlowToMermaid,
  rfEndpointToMermaid,
} from "../../src/features/diagram/converter/reactFlowToMermaid";
import {
  convertMermaidToReactFlow,
  parseMermaidCode,
} from "../../src/features/diagram/converter/mermaidToReactFlow";

describe("reactFlowToMermaid", () => {
  it("parses heading from existing source", () => {
    expect(parseFlowchartHeadingFromSource(`graph LR\nA-->B`).keyword).toBe("graph");
    expect(parseFlowchartHeadingFromSource(`graph LR\nA-->B`).direction).toBe("LR");
    expect(parseFlowchartHeadingFromSource(`flowchart TD\n`).direction).toBe("TB");
  });

  it("escapes quoted label text for Mermaid compatibility", () => {
    expect(escapeForMermaidQuotedText('say "hello"')).toContain("#quot;");
    expect(escapeForMermaidQuotedText("a\nb")).toContain("<br/>");
  });

  it("serializes subgraph and maps subgraph-prefixed RF endpoints", () => {
    const sgId = `subgraph-sg`;
    const nodes: Node[] = [
      {
        id: sgId,
        type: "group",
        position: { x: 0, y: 0 },
        data: { label: "My Group", subgraphDirection: "LR" },
      },
      {
        id: "A",
        type: "custom",
        position: { x: 10, y: 10 },
        parentNode: sgId,
        extent: "parent",
        data: { label: "Inside", shape: "rect" },
      },
      {
        id: "Z",
        type: "custom",
        position: { x: 0, y: 0 },
        data: { label: "Lonely", shape: "round" },
      },
    ];
    const edges: Edge[] = [
      {
        id: "e1",
        source: sgId,
        target: "Z",
        data: { mermaidLinkStyle: "-->" },
      },
    ];
    const txt = reactFlowToMermaid(nodes, edges);
    expect(txt).toContain("subgraph sg");
    expect(txt).toContain("direction LR");
    expect(txt).toContain("Lonely)");
    expect(txt).toContain("sg --> Z");

    expect(rfEndpointToMermaid(sgId)).toBe("sg");
  });

  it("round-trips a minimal parsed flowchart (parse → RF → text → parse)", async () => {
    const sample =
      `flowchart TB\n` +
      `subgraph Outer ["Outside"]\n` +
      `  direction LR\n` +
      `  D{"Diamond?"}\n` +
      `  C(("Round"))\n` +
      `end\n` +
      `A[Test node] ==> B([Stadium])\n` +
      `A -.->|maybe| D\n`;

    const { nodes: mn, edges: me, subgraphs } = parseMermaidCode(sample);

    expect(mn.length).toBeGreaterThanOrEqual(2);
    expect(subgraphs.length).toBeGreaterThanOrEqual(1);

    const rf = await convertMermaidToReactFlow(sample);

    expect(rf.nodes.length).toBeGreaterThan(0);
    expect(rf.edges.length).toBeGreaterThan(0);

    const back = reactFlowToMermaid(rf.nodes, rf.edges, {
      previousSource: sample,
    });

    const reparsedNodes = parseMermaidCode(back).nodes;
    const origIds = new Set(mn.map((n) => n.id));

    expect(reparsedNodes.map((r) => r.id).sort()).toEqual([...origIds].sort());

    expect(reparsedNodes.find((x) => x.id === "A")?.shape).toBe("rect");

    expect(reparsedNodes.find((x) => x.id === "D")?.shape).toBe("diamond");
  });

  it("emits skeleton for empty graphs", () => {
    expect(reactFlowToMermaid([], []).trim()).toBe("flowchart TB");
  });

  it("infer link style when mermaid metadata is absent", () => {
    const nodes: Node[] = [
      { id: "A", position: { x: 0, y: 0 }, data: { label: "a" } },
      { id: "B", position: { x: 0, y: 0 }, data: { label: "b" } },
    ];
    const dashed: Edge = {
      id: "e-d",
      source: "A",
      target: "B",
      style: { strokeDasharray: "8,4" },
    };
    expect(reactFlowToMermaid(nodes, [dashed])).toContain("A --- B");
  });
});
