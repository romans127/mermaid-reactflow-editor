# Mermaid + React Flow editor

Vite + React app: edit Mermaid in Monaco, preview with Mermaid (`mermaid-svg`), and use **editable React Flow** for **flowchart / graph** syntax only (`flowchart` / `graph`).

Other Mermaid diagram types (sequence, class, ER, Gantt, pie, git graph, quadrant chart, kanban, C4, etc.) render via the full Mermaid engine in Preview and on the Canvas in read-only SVG mode with pan/zoom.

## Scripts (Bun)

```bash
bun install
bun run dev
bun run build
bun run test
```

## Vercel

Project settings can use Bun for install/build (see `vercel.json`): `bun install` and `bun run build`; static output is `dist`.

## Pins

Application targets **Mermaid 11.x** (`mermaid` in `package.json`). Beta diagram keywords may change between Mermaid minor releases—verify against [syntax reference](https://mermaid.js.org/intro/syntax-reference.html) when upgrading.
