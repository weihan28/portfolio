import { readFile } from "node:fs/promises";
import path from "node:path";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Mermaid from "./mermaid";

export default async function Page() {
  const markdown = await readFile(path.join(process.cwd(), "content", "incident.md"), "utf-8");

  return (
    <main className="post">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ```mermaid blocks become diagrams; the figure can't sit inside a <pre>, so unwrap it.
          pre: ({ node, children }) => {
            const code = node?.children[0];
            const isMermaid =
              code?.type === "element" && code.tagName === "code" && String(code.properties.className).includes("language-mermaid");
            return isMermaid ? <>{children}</> : <pre>{children}</pre>;
          },
          code: ({ className, children }) =>
            className?.includes("language-mermaid") ? (
              <Mermaid chart={String(children).replace(/\n$/, "")} />
            ) : (
              <code className={className}>{children}</code>
            ),
        }}
      >
        {markdown}
      </Markdown>
    </main>
  );
}
