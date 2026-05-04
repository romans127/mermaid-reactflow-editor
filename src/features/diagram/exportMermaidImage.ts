import * as htmlToImage from "html-to-image";

/** PNG export for a DOM subtree that wraps a rendered Mermaid SVG (e.g. MermaidRenderer outer container). */
export async function exportMermaidContainerPng(
  wrapper: HTMLElement,
  options?: { fileName?: string; pixelRatio?: number; backgroundColor?: string }
): Promise<void> {
  const fileName = options?.fileName ?? "mermaid-diagram.png";
  const pixelRatio = options?.pixelRatio ?? 3;
  const backgroundColor = options?.backgroundColor ?? "#ffffff";
  const svg = wrapper.querySelector("svg") as SVGSVGElement | null;
  if (!svg) {
    throw new Error("Nothing to export — no SVG in preview");
  }
  const dataUrl = await htmlToImage.toPng(wrapper, {
    cacheBust: true,
    pixelRatio,
    backgroundColor,
  });
  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}
