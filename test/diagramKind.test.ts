import { describe, it, expect } from "vitest";
import {
  detectDiagramKind,
  getRenderMode,
  firstDiagramLine,
} from "../src/features/diagram/diagramKind";

describe("diagramKind", () => {
  it("routes flowcharts to reactflow mode", () => {
    expect(getRenderMode("flowchart LR\n  A-->B")).toBe("reactflow");
    expect(getRenderMode("graph TD\n  A-->B")).toBe("reactflow");
    expect(detectDiagramKind("graph TB\n")).toBe("flowchart");
  });

  it("routes other diagram starters to svg mode", () => {
    expect(getRenderMode("sequenceDiagram\n  Alice->Bob: hi")).toBe("mermaid-svg");
    expect(detectDiagramKind("sequenceDiagram")).toBe("sequence");
    expect(getRenderMode("erDiagram\n  CUSTOMER ||--o{ ORDER : places")).toBe(
      "mermaid-svg",
    );
    expect(detectDiagramKind("gantt\ntitle A")).toBe("gantt");
  });

  it("skips directives and picks first diagram line", () => {
    expect(firstDiagramLine("%% comment\nsequenceDiagram")).toContain("sequenceDiagram");
    expect(firstDiagramLine("---\ntitle: x\n---\nclassDiagram")).toContain("classDiagram");
  });
});
