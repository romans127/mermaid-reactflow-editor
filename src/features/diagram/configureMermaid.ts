import mermaid from "mermaid";
import type { EffectiveTheme } from "@/types";

let configuredForTheme: EffectiveTheme | null = null;

/**
 * Single app-wide Mermaid initialization. Call from layout when theme changes.
 */
export function configureMermaid(effectiveTheme: EffectiveTheme): void {
  if (configuredForTheme === effectiveTheme) return;
  configuredForTheme = effectiveTheme;
  const themeName = effectiveTheme === "dark" ? "dark" : "default";
  mermaid.initialize({
    startOnLoad: false,
    theme: themeName,
    securityLevel: "loose",
    flowchart: {
      htmlLabels: false,
      curve: "linear",
    },
  });
}

/** Test hook: reset memoized theme guard */
export function __resetConfigureMermaidForTests(): void {
  configuredForTheme = null;
}
