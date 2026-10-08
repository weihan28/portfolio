"use client";

import { useEffect } from "react";
import { mountProjects } from "../lab/projects";

// The list and the preview card are filled in by app/lab/projects.js.
export default function Projects() {
  useEffect(() => mountProjects(), []);
  return (
    <div className="projects">
      <ul className="plist" id="plist" aria-label="Projects" />
      <div className="pside">
        <article className="pcard" id="pcard" aria-live="polite">
          <div className="pchrome" aria-hidden="true">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
            <span className="pill" id="p-kind" />
          </div>
          <div className="pglow" id="p-glow" aria-hidden="true" />
          <div className="pbody">
            <span className="pmeta" id="p-meta" />
            <h3 id="p-title" />
            <p className="pdesc" id="p-desc" />
            <span className="pstack" id="p-stack" />
            <div className="plinks" id="p-links" />
          </div>
        </article>
        <div className="pprog" aria-hidden="true">
          <i id="p-prog" />
        </div>
      </div>
    </div>
  );
}
