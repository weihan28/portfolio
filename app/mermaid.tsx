"use client";

import { useEffect, useId, useState } from "react";

// The first `%% caption: ...` line in the chart is shown under the diagram.
export default function Mermaid({ chart }: { chart: string }) {
  const id = "mermaid-" + useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const caption = chart.match(/^%%\s*caption:\s*(.*)$/m)?.[1];

  useEffect(() => {
    let cancelled = false;
    import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: "neutral" });
      const { svg } = await mermaid.render(id, chart);
      if (!cancelled) setSvg(svg);
    });
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  return (
    <figure>
      <div className="diagram" dangerouslySetInnerHTML={{ __html: svg }} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
