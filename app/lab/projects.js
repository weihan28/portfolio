// The Projects section: a large index of titles that drives a preview card, which also moves on by itself on a
// timer. Mounted by app/components/Projects.tsx onto the elements it renders; returns a cleanup function.
export const projects = [
  { t: "Cross-Region Deduplication", g: ["#E87A8E", "#6A2433"], c: "Backend", y: "2025",
    d: "A race condition between regions, traced through lock-database logs and closed with an insert-first write path, then rolled out without a single production incident.",
    s: ["Java", "Spring Boot"], href: "#writing", hrefLabel: "Read the write-up" },
  { t: "LLM Architectures from Papers", g: ["#6CC0C8", "#1E6A72"], c: "Machine Learning", y: "2025–2026",
    d: "Llama 3 and DeepSeek-V2 rebuilt from their papers in PyTorch, from grouped-query and latent attention to KV caches and Mixture-of-Experts routing.",
    s: ["Python", "PyTorch"], href: "https://github.com/weihan28/paper_arch_implementations", hrefLabel: "github.com/weihan28/paper_arch_implementations" },
  { t: "MailHQ", g: ["#ff8a7a", "#8a2f3d"], c: "Web", y: "2026",
    d: "Outreach manager that organises contacts, personalises bulk cold emails with Gemini and tracks opens, clicks and replies.",
    s: ["Next.js", "TypeScript", "Supabase", "Gemini API", "Resend", "Tailwind CSS"],
    links: [["https://mail-hq.vercel.app", "mail-hq.vercel.app"], ["https://github.com/ekramjim/MailHQ", "github.com/ekramjim/MailHQ"]] },
  { t: "LinkedHive", g: ["#E8C66C", "#7A5A1E"], c: "Mobile", y: "2025–2026",
    d: "A community and business networking app for iOS, Android and the web that brings local businesses, events and jobs together, with AI that sorts and moderates posts.",
    s: [], href: "https://www.linkedhive.com.au/" },
  { t: "Rebar Counting", g: ["#E0A86A", "#6B4520"], c: "Computer Vision", y: "2025",
    d: "An app that counts steel rebar from a single photograph at 96.82% accuracy, powered by a YOLOv8 detector trained to 0.988 mAP and served to Android through FastAPI.",
    s: ["Python", "PyTorch", "YOLOv8", "FastAPI", "Docker", "GitHub Actions", "Kotlin"], href: "https://github.com/weihan28/rebar_counting", hrefLabel: "github.com/weihan28/rebar_counting" },
  { t: "RAG Document Q&A Chatbot", g: ["#9FD08A", "#2F5A2A"], c: "AI", y: "2025",
    d: "A retrieval-augmented assistant for an EY 2025 entry that answers questions from uploaded documents, remembers the conversation and maps how its sources relate.",
    s: ["Python", "FastAPI", "LangChain", "Gemini", "SAP HANA Cloud", "MongoDB", "Docker"], href: "https://github.com/weihan28/ey-fournity-chatbot", hrefLabel: "github.com/weihan28/ey-fournity-chatbot" },
  { t: "pi-tavily", g: ["#B49AE8", "#45307A"], c: "Developer Tools", y: "2026",
    d: "A published npm extension that lets the pi coding agent search, extract, crawl and map the web through the Tavily API.",
    s: ["TypeScript", "Node.js", "npm"], links: [["https://www.npmjs.com/package/@weihan28/pi-tavily", "npm"], ["https://github.com/weihan28/pi-tavily", "GitHub"]] },
];


export function mountProjects() {
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const plist = document.getElementById("plist");
  const kindOf = href => /github\.com/.test(href) ? "GitHub repo" : /npmjs\.com/.test(href) ? "npm package"
    : href === "#writing" ? "Write-up" : "Live site";
  // Repos and packages are named; a live site gets "Click to open", the write-up "Read more".
  const linkLabel = href => /github\.com/.test(href) ? "GitHub ↗" : /npmjs\.com/.test(href) ? "npm ↗"
    : href === "#writing" ? "Read more →" : "Click to open →";

  /* The preview card follows whichever title is hovered or focused. Left alone, it moves on to the next project
     every 15 seconds; the bar under the card is that timer. It pauses while the pointer rests on the card, while the
     section is off screen or the tab is hidden, and doesn't run at all for visitors who prefer reduced motion. */
  const AUTO_MS = 15000;
  let current = 0, elapsed = 0, onCard = false, projInView = false, lastTick = 0;
  function showProject(i) {
    const p = projects[i], n = projects.length, $ = id => document.getElementById(id);
    plist.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-selected", String(j === i)));
    const links = p.links || (p.href ? [[p.href, p.hrefLabel || p.href]] : []);
    $("p-kind").textContent = links.length ? kindOf(links[0][0]) : "Private";
    $("p-glow").style.setProperty("--c1", p.g[0]);
    $("p-glow").style.setProperty("--c2", p.g[1]);
    $("p-meta").textContent = `${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")} · ${p.c} · ${p.y}`;
    $("p-title").textContent = p.t;
    const desc = $("p-desc");
    desc.className = "pdesc" + (p.d ? "" : " todo");
    desc.textContent = p.d || p.todo || "";
    $("p-stack").textContent = p.s.join(" · ");
    $("p-links").innerHTML = links.length
      ? links.map(([href]) => {
          // Other sites open in a new tab; the write-up link scrolls within the page.
          const out = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : "";
          return `<a href="${esc(href)}"${out}>${esc(linkLabel(href))}</a>`;
        }).join("")
      : `<span class="dim">Not public yet</span>`;
    current = i;
    elapsed = 0;
  }

  projects.forEach((p, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<button type="button"><span class="num">${String(i + 1).padStart(2, "0")}</span><span class="row"><span class="name">${esc(p.t)}</span><span class="meta">${esc(p.c)} · ${esc(p.y)}</span></span></button>`;
    const b = li.querySelector("button");
    b.addEventListener("mouseenter", () => showProject(i));
    b.addEventListener("focus", () => showProject(i));
    b.addEventListener("click", () => {
      showProject(i);
      // On a phone the card sits above the list; bring it into view after a tap.
      const card = document.getElementById("pcard"), r = card.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) card.scrollIntoView({ block: "nearest" });
    });
    plist.appendChild(li);
  });
  showProject(0);

  const progEl = document.getElementById("p-prog"), cardEl = document.getElementById("pcard");
  cardEl.addEventListener("mouseenter", () => { onCard = true; });
  cardEl.addEventListener("mouseleave", () => { onCard = false; });
  const observer = new IntersectionObserver(es => { projInView = es[0].isIntersecting; });
  observer.observe(document.getElementById("projects"));
  function tick(now) {
    const dt = lastTick ? now - lastTick : 0;
    lastTick = now;
    if (!reducedMotion && projInView && !onCard && !document.hidden) {
      elapsed += Math.min(dt, 100);
      if (elapsed >= AUTO_MS) showProject((current + 1) % projects.length);
    }
    progEl.style.width = reducedMotion ? "0%" : (Math.min(1, elapsed / AUTO_MS) * 100).toFixed(2) + "%";
    raf = requestAnimationFrame(tick);
  }
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = requestAnimationFrame(tick);

  return () => { cancelAnimationFrame(raf); observer.disconnect(); plist.replaceChildren(); };
}
