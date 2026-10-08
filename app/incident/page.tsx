import { readFile } from "node:fs/promises";
import path from "node:path";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Metadata } from "next";
import Mermaid from "../mermaid";

export const metadata: Metadata = {
  title: "A distributed lock that didn't hold",
};

export default async function Page() {
  const markdown = await readFile(path.join(process.cwd(), "content", "incident.md"), "utf-8");

  return (
    <>
      <nav className="article-nav"><a href="/#writing">← Back to writing</a></nav>
      <main className="article">
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
            // Wide tables scroll inside their own box instead of widening the page.
            table: ({ children }) => (
              <div className="table-wrap"><table>{children}</table></div>
            ),
          }}
        >
          {markdown}
        </Markdown>
      </main>
      <nav className="article-nav bottom"><a href="/#writing">← Back to writing</a></nav>
    </>
  );
}
