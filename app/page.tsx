import { ArrowUpRight, Envelope, GithubLogo, LinkedinLogo } from "@phosphor-icons/react/ssr";
import DoomLab from "./components/DoomLab";
import MlaFlow from "./components/MlaFlow";
import Projects from "./components/Projects";

const THEMES = [
  ["Backend Engineering", "Distributed systems, from race conditions to safe rollouts and production debugging."],
  ["Model Architectures", "Rebuilding Llama 3 and DeepSeek-V2 from their papers, and designing attention that costs constant time per token."],
  ["Computer Vision", "A YOLOv8 detector that counts steel rebar from a single photo, at 96.82% counting accuracy."],
  ["LLM Applications", "Retrieval-augmented question answering and Gemini-powered tools, with a human kept in the loop."],
];

const JOBS = [
  {
    company: "LynkSphere", role: "AI & Software Developer", dates: "Nov 2025 – Present", status: "Current",
    place: "Melbourne, Australia · Remote",
    points: [
      "Co-building MailHQ, an AI outreach platform in Next.js and TypeScript.",
      "Integrated Google Gemini to draft a personalised email per recipient, with human review and a server-side daily quota.",
      "Secured the Supabase PostgreSQL schema with row-level security on every table.",
      "Encrypted per-user Resend API keys with AES-256-GCM, with per-recipient open, click and reply tracking.",
      "Built CSV contact import and a Recharts analytics dashboard, deployed on Vercel.",
    ],
  },
  {
    company: "Ant International", role: "Backend Engineer Intern · Blockchain Team", dates: "Jun 2025 – Oct 2025",
    status: "Completed", place: "Kuala Lumpur, Malaysia",
    points: [
      "Diagnosed a race condition in a multi-region batch job's distributed lock from lock-database logs.",
      "Rewrote the write path in Java and Spring Boot to insert first, closing the race and halving database round trips per statement.",
      "Released through a 1% → 100% grey-scale rollout behind a runtime feature flag, with 0 production incidents.",
      "Proposed a centralised scheduler microservice to remove duplicates by design, documented in a system-analysis report.",
      "Validated a partner-bank payment integration, mocking bank responses from production traces when UAT was unreachable.",
      "Documented in-house middleware systems as onboarding guides for new joiners.",
    ],
  },
];

const SKILLS = [
  ["Languages", "Python, Java, TypeScript, JavaScript, Kotlin, SQL, Bash, C++, HTML/CSS"],
  ["Technologies", "Spring Boot, FastAPI, Node.js, Next.js, React, PostgreSQL, MongoDB, Supabase, Redis, Kafka, Docker, Kubernetes, AWS, Google Cloud"],
  ["AI & Machine Learning", "PyTorch, Transformers, LLMs, RAG, LangChain, Vector Search, YOLOv8, Computer Vision, Hugging Face, Scikit-learn, NumPy, Pandas"],
  ["Tools", "Git, GitHub Actions, Jupyter, VS Code, Vercel, Render, Gemini API, Claude API, Claude Code, JUnit, pytest"],
  ["Soft Skills", "Technical Writing, Root-Cause Analysis, Stakeholder Communication, Code Review, Agile (Kanban)"],
];

const LEADERSHIP = [
  ["Bank Liaison", "Ant International", "Spoke for the team with partner banks during a payment integration, talking through the specification and the software decisions it raised."],
  ["Onboarding Guide", "Ant International", "Led new joiners through in-house middleware systems, from RPC to dynamic configuration, with onboarding documents written for the purpose."],
  ["Team Lead", "Monash University Malaysia", "Led a four-person final-year team in building an app that counts steel rebar from a single photograph, and took charge of training the model at its heart."],
];

// Contact channels, laid out like the reference: an icon, the label over the address, and an arrow.
const CHANNELS = [
  { label: "Email", value: "chinweihan28@gmail.com", href: "mailto:chinweihan28@gmail.com", Icon: Envelope },
  { label: "GitHub", value: "github.com/weihan28", href: "https://github.com/weihan28", Icon: GithubLogo },
  { label: "LinkedIn", value: "linkedin.com/in/chinweihan", href: "https://www.linkedin.com/in/chinweihan/", Icon: LinkedinLogo },
];

export default function Home() {
  return (
    <>
      <nav className="top" aria-label="Sections">
        <div className="wrap">
          <a href="#about-head">About</a>
          <a href="#lab">Lab</a>
          <a href="#writing">Writing</a>
          <a href="#projects">Projects</a>
          <a href="#experience">Experience</a>
          <a href="#skills">Skills</a>
          <a href="#leadership">Leadership</a>
          <a href="#contact">Contact</a>
        </div>
      </nav>

      <main className="wrap">
        {/* Intro: the greeting over the About sentence, with the MLA diagram beside both */}
        <div className="intro">
          <div className="hero-text">
            <h1>Hi, I&apos;m Wei Han.</h1>
            <div className="chips">
              <span className="chip">Kuala Lumpur · Malaysia</span>
              <span className="chip live">Available for selected opportunities</span>
            </div>
            <div><a className="touch" href="#contact">Get in touch</a></div>
          </div>
          <div className="about-head" id="about-head">
            <p className="eyebrow">About</p>
            <p className="about-intro">
              I am drawn to the edge of what AI can do, rebuilding its best ideas from their papers so that one day I can
              add new ones of my own.
            </p>
          </div>
          <MlaFlow />
        </div>

        <section id="about" aria-label="About">
          <div className="themes">
            {THEMES.map(([title, text]) => (
              <div className="theme" key={title}><h3>{title}</h3><p>{text}</p></div>
            ))}
          </div>
          <div className="timeline">
            <div className="tl-row">
              <span className="mono">2022 – 2025</span>
              <span>Bachelor of Computer Science, Monash University Malaysia</span>
              <span className="mono muted gpa">GPA 3.41 / 4.00</span>
            </div>
          </div>
        </section>

        <section id="lab">
          <p className="eyebrow">Lab</p>
          <h2>A System One model, running in this tab.</h2>
          <p className="muted" style={{ maxWidth: "none" }}>
            A small model that runs entirely in your browser, on your own CPU through WebAssembly, with no server, API or
            GPU behind it. It&apos;s a 29M-parameter 4-bit quantised language model (15 MB), repurposed as a System One
            aimbot for DOOM.
          </p>
          <p className="muted" style={{ marginTop: 12, maxWidth: "none" }}>
            Whenever an enemy comes into view, the model takes the aim and fires on your behalf.
          </p>
          <DoomLab />
        </section>

        <section id="writing">
          <p className="eyebrow">Writing</p>
          <h2>Written after the sleepless nights.</h2>
          <ul className="posts">
            <li>
              <a className="post" href="/incident">
                <span className="post-meta">2025 · 8 min read</span>
                <span className="post-body">
                  <span className="post-title">A distributed lock that didn&apos;t hold</span>
                  <span className="post-excerpt">
                    How a daily job running in several regions slipped past its lock, why the real fix was to stop locking
                    at all, and what a timing bug teaches about patience.
                  </span>
                </span>
                <span className="post-go" aria-hidden="true">Read more →</span>
              </a>
            </li>
          </ul>
        </section>

        <section id="projects">
          <p className="eyebrow">Projects</p>
          <h2>Highlights</h2>
          <Projects />
        </section>

        <section id="experience">
          <p className="eyebrow">Experience</p>
          <h2>Work</h2>
          <div className="missions">
            {JOBS.map(job => (
              <div className="mission" key={job.company}>
                <div className="side">
                  <span className="mono">{job.dates}</span>
                  <span className={job.status === "Current" ? "status" : "status done"}>{job.status}</span>
                  <span className="muted small">{job.place}</span>
                </div>
                <div>
                  <h3>{job.company}</h3>
                  <p className="muted">{job.role}</p>
                  <ul>{job.points.map(p => <li key={p}>{p}</li>)}</ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="skills">
          <p className="eyebrow">Skills</p>
          <h2>Toolkit</h2>
          <div className="skills">
            {SKILLS.map(([group, list]) => (
              <div className="skrow" key={group}>
                <h3>{group}</h3>
                <div className="tags">{list.split(", ").map(s => <span className="tag" key={s}>{s}</span>)}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="leadership">
          <p className="eyebrow">Leadership</p>
          <h2>Leadership</h2>
          <div className="lead">
            {LEADERSHIP.map(([title, org, text]) => (
              <article className="lead-card" key={title}>
                <h3>{title}</h3>
                <div className="lead-meta"><span>{org}</span><span className="mono">2025</span></div>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact">
          <p className="eyebrow">Contact</p>
          <div className="contact">
            <div>
              <h2>Have something worth building?</h2>
              <p className="muted">I&apos;m open to collaborations, research conversations and full-time opportunities in AI.</p>
              <ul className="channels">
                {CHANNELS.map(({ label, value, href, Icon }) => (
                  <li key={label}>
                    <a className="channel" href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}>
                      <span className="channel-icon"><Icon size={19} aria-hidden /></span>
                      <span className="channel-text"><span className="k">{label}</span><strong>{value}</strong></span>
                      <ArrowUpRight className="channel-arrow" size={17} aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mono muted" style={{ marginTop: 12 }}>Based in Kuala Lumpur · UTC+8</p>
            </div>
          </div>
        </section>

        <footer>
          <p className="tag-line">Made in Kuala Lumpur, with curiosity and a great deal of coffee.</p>
        </footer>
      </main>
    </>
  );
}
