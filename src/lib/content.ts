// All copy for the experience lives here.

export const site = {
  name: "BAGHA",
  email: "hello@bagha.studio",
  url: "https://bagha.studio",
  description:
    "Bagha is a web, AI and engineering studio. We build fast websites, keep them running, and teach them to think.",
  socials: [
    { label: "GitHub", href: "https://github.com" },
    { label: "LinkedIn", href: "https://linkedin.com" },
    { label: "X", href: "https://x.com" },
    { label: "Dribbble", href: "https://dribbble.com" },
  ],
};

export const statement = {
  lines: ["QUANTUM-GRADE", "DIGITAL", "ENGINEERING"],
  paragraphs: [
    "An engineering studio at the edge of the web.",
    "We design and build high-performance websites, keep them running, and teach them to think with AI.",
    "Every product starts in superposition — all possibilities at once. Our job is to collapse it into the one that works.",
  ],
};

export type Service = {
  id: string;
  title: string[];
  short: string;
  body: string;
  tags: string[];
  palette: [string, string, string];
  pattern: number;
};

export const services: Service[] = [
  {
    id: "web",
    title: ["WEB", "DEVELOPMENT"],
    short: "Websites",
    body: "Marketing sites, SaaS platforms and web apps — server-rendered, edge-deployed and fast on every device.",
    tags: ["Next.js", "React", "Headless CMS", "E-commerce"],
    palette: ["#0b3b4a", "#35d0ff", "#b8f4ff"],
    pattern: 0,
  },
  {
    id: "ai",
    title: ["AI & MACHINE", "LEARNING"],
    short: "AI / ML",
    body: "LLM copilots, RAG search, agents, vision and forecasting models — trained, evaluated and shipped to production.",
    tags: ["LLMs", "RAG", "Agents", "PyTorch"],
    palette: ["#2a0b4a", "#b05cff", "#ff8ad8"],
    pattern: 1,
  },
  {
    id: "care",
    title: ["WEB", "MAINTENANCE"],
    short: "Maintenance",
    body: "Monthly care plans: uptime monitoring, updates, backups, security patches and a team on call when something drifts.",
    tags: ["Monitoring", "Updates", "Backups", "SLA"],
    palette: ["#0b3a2a", "#3dffb0", "#d6ffe9"],
    pattern: 2,
  },
  {
    id: "design",
    title: ["UI / UX", "DESIGN"],
    short: "Design",
    body: "Interfaces people understand at a glance. Research, design systems, prototypes and motion — built to be engineered.",
    tags: ["Product", "Design systems", "Motion"],
    palette: ["#4a1a0b", "#ff7a45", "#ffd9a8"],
    pattern: 3,
  },
  {
    id: "cloud",
    title: ["CLOUD &", "DEVOPS"],
    short: "Cloud",
    body: "Infrastructure that scales without drama — CI/CD, containers, serverless and observability on the cloud you choose.",
    tags: ["AWS", "Docker", "Kubernetes", "Terraform"],
    palette: ["#0b1a4a", "#4d7dff", "#c4d3ff"],
    pattern: 4,
  },
  {
    id: "perf",
    title: ["PERFORMANCE", "& SEO"],
    short: "Performance",
    body: "Audits that find the noise and remove it: Core Web Vitals, accessibility, technical SEO and security hardening.",
    tags: ["Web Vitals", "SEO", "a11y", "Security"],
    palette: ["#4a0b22", "#ff3d7a", "#ffc2d6"],
    pattern: 5,
  },
];

export const process = [
  {
    ket: "|0⟩",
    title: "OBSERVE",
    body: "Every system starts in its ground state. We study yours — users, data, goals and constraints — before a single pixel moves.",
  },
  {
    ket: "|+⟩",
    title: "SUPERPOSE",
    body: "Strategy, design and architecture explored in parallel. Many possible products, prototyped and tested at once.",
  },
  {
    ket: "|Φ⁺⟩",
    title: "ENTANGLE",
    body: "Front end, back end and AI wired into one system. Change one part and the rest responds — by design.",
  },
  {
    ket: "|1⟩",
    title: "MEASURE",
    body: "Launch, monitor, iterate. The wavefunction collapses into a real product, and we keep it coherent after.",
  },
];

export const finale = {
  kicker: "MEASUREMENT",
  lines: ["EVERY IDEA STARTS", "IN SUPERPOSITION."],
  sub: "Let's collapse yours into reality.",
};
