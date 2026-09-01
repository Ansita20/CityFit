import "@/lib/env.server";
import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { fileURLToPath } from "node:url";
import type { Database } from "@/integrations/supabase/types";
import type { JobRow, Profile } from "./matching";

// The production bundle (.output/server/_libs/...) references its PDF.js
// worker via a relative "./pdf.worker.mjs" path that the bundler never
// actually copies alongside it — the worker only exists inside
// node_modules/pdfjs-dist. Without this, PDF.js silently fails to extract
// any text (surfacing as "We couldn't read text from that file" for every
// PDF, even normal ones), while working fine when run directly from
// source, where Node's own module resolution finds the real file. Resolve
// it explicitly here so both contexts use the same real worker.
try {
  PDFParse.setWorker(fileURLToPath(import.meta.resolve("pdfjs-dist/build/pdf.worker.mjs")));
} catch (error) {
  console.error("[resume] could not resolve pdf.worker.mjs, PDF parsing may fail:", error);
}

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const JOB_COLUMNS =
  "category, company, role, location, work_mode, key_skills, skills, min_experience, max_experience, tier";

export async function fetchAllJobs(): Promise<JobRow[]> {
  const supabase = publicClient();
  const rows: JobRow[] = [];
  const pageSize = 1000;
  for (let page = 0; page < 20; page++) {
    const from = page * pageSize;
    const { data, error } = await supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as JobRow[]));
    if (data.length < pageSize) break;
  }
  return rows;
}

export async function fetchLastRun() {
  const supabase = publicClient();
  const { data } = await supabase
    .from("scrape_runs")
    .select("started_at, finished_at, rows_inserted, status")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export type ExtractedProfile = Profile & { fullName: string | null; seniority: string };

const SKILL_KEYWORDS = [
  // Languages
  "typescript",
  "javascript",
  "python",
  "java",
  "c#",
  "c++",
  "golang",
  "go",
  "rust",
  "php",
  "ruby",
  "swift",
  "kotlin",
  "scala",
  "r",
  "matlab",
  "bash",
  "shell scripting",
  "html",
  "css",
  "sass",
  "scss",
  // Frontend
  "react",
  "next.js",
  "nextjs",
  "redux",
  "vue",
  "vue.js",
  "angular",
  "svelte",
  "tailwind",
  "tailwindcss",
  "bootstrap",
  "material ui",
  "jquery",
  "webpack",
  "vite",
  "figma",
  "adobe xd",
  "sketch",
  "photoshop",
  // Backend
  "node.js",
  "nodejs",
  "express",
  "django",
  "flask",
  "fastapi",
  "spring",
  "spring boot",
  ".net",
  "asp.net",
  "laravel",
  "ruby on rails",
  "graphql",
  "rest api",
  "grpc",
  "microservices",
  // Data / ML
  "sql",
  "postgres",
  "postgresql",
  "mysql",
  "sqlite",
  "oracle",
  "mongodb",
  "redis",
  "elasticsearch",
  "dynamodb",
  "cassandra",
  "snowflake",
  "bigquery",
  "redshift",
  "pandas",
  "numpy",
  "scikit-learn",
  "tensorflow",
  "pytorch",
  "keras",
  "opencv",
  "nlp",
  "machine learning",
  "deep learning",
  "computer vision",
  "data analysis",
  "data analytics",
  "data visualization",
  "power bi",
  "tableau",
  "excel",
  "spark",
  "hadoop",
  "hive",
  "kafka",
  "airflow",
  "dbt",
  "etl",
  "sas",
  // Cloud / DevOps
  "aws",
  "gcp",
  "azure",
  "docker",
  "kubernetes",
  "terraform",
  "ansible",
  "jenkins",
  "github actions",
  "ci/cd",
  "linux",
  "nginx",
  "git",
  // Mobile
  "android",
  "ios",
  "flutter",
  "react native",
  // Testing
  "testing",
  "jest",
  "mocha",
  "playwright",
  "cypress",
  "selenium",
  "junit",
  // Tools / methodology
  "jira",
  "confluence",
  "agile",
  "scrum",
  "salesforce",
  "sap",
  "servicenow",
  "power automate",
  "seo",
  "google analytics",
  "wordpress",
  "shopify",
  "firebase",
  "supabase",
];

const SKILL_ALIASES: Record<string, string> = {
  golang: "Go",
  "vue.js": "Vue",
  ".net": ".NET",
  "asp.net": "ASP.NET",
};

/** Whole-token match so short keywords like "go" or "r" don't fire on "google" or "director". */
function containsToken(haystack: string, keyword: string) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i").test(haystack);
}

const ROLE_KEYWORDS: Array<[string, string[]]> = [
  ["Data Analyst", ["data analyst", "analytics", "business intelligence", "bi analyst"]],
  ["Data Engineer", ["data engineer", "etl", "airflow", "spark", "dbt"]],
  ["Data Scientist", ["data scientist", "machine learning", "ml engineer", "deep learning"]],
  ["Frontend Developer", ["frontend", "front end", "react", "ui engineer", "web developer"]],
  ["Backend Developer", ["backend", "back end", "api developer", "server-side", "microservices"]],
  ["DevOps Engineer", ["devops", "sre", "platform engineer", "kubernetes", "ci/cd"]],
  ["Product Manager", ["product manager", "product owner", "roadmap", "product strategy"]],
  ["Business Analyst", ["business analyst", "requirements", "stakeholder", "process analyst"]],
  [
    "Software Engineer",
    ["software engineer", "software developer", "full stack", "fullstack", "developer"],
  ],
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.\s/-]/g, " ");
}

function inferYears(text: string): number {
  const normalized = normalizeText(text);

  const explicit = [
    ...normalized.matchAll(
      /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:relevant |total |overall )?exp(?:erience)?\b/g,
    ),
    ...normalized.matchAll(
      /(?:total |overall )?exp(?:erience)?\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/g,
    ),
  ];
  const explicitYears = explicit
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 45);
  if (explicitYears.length) return Math.max(...explicitYears);

  // No explicit "X years experience" phrase — many resumes just list a work
  // history instead. Fall back to the span since the earliest role still
  // marked "present/current": an unambiguous signal it's an active job, not
  // an education date range (which is almost never phrased as ongoing).
  const MONTH = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
  const presentRe = new RegExp(
    `(?:(?:${MONTH})[a-z]*\\.?\\s+)?(\\d{4})\\s*(?:-|\\u2013|to)\\s*(?:present|current|now)\\b`,
    "gi",
  );
  const currentYear = new Date().getFullYear();
  const starts = [...normalized.matchAll(presentRe)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 1980 && value <= currentYear);
  if (starts.length) return Math.min(currentYear - Math.min(...starts), 45);

  return 0;
}

function inferSeniority(years: number) {
  if (years <= 0) return "Fresher";
  if (years < 2) return "Junior";
  if (years < 5) return "Mid";
  if (years < 8) return "Senior";
  return "Lead";
}

function inferTargetRole(text: string, fileName?: string): string {
  const haystack = normalizeText(`${fileName ?? ""} ${text}`);

  // A literal role title ("Backend Developer") beats one merely inferred from
  // an associated skill keyword ("react") — otherwise a backend resume that
  // happens to list React anywhere gets mislabeled as frontend.
  for (const [role] of ROLE_KEYWORDS) {
    if (containsToken(haystack, role.toLowerCase())) return role;
  }

  let best: { role: string; score: number } | null = null;
  for (const [role, keywords] of ROLE_KEYWORDS) {
    const score = keywords.filter((keyword) => containsToken(haystack, keyword)).length;
    if (score > 0 && (!best || score > best.score)) best = { role, score };
  }
  return best?.role ?? "Software Engineer";
}

function inferSkills(text: string) {
  const haystack = normalizeText(text);
  const skills = SKILL_KEYWORDS.filter((keyword) => containsToken(haystack, keyword)).map(
    (keyword) => SKILL_ALIASES[keyword] ?? keyword,
  );
  return [...new Set(skills)].slice(0, 40);
}

function inferFullName(text: string) {
  const firstLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);

  for (const line of firstLines) {
    if (line.length > 60) continue;
    if (/resume|curriculum vitae|cv|profile/i.test(line)) continue;
    if (/[@\d]/.test(line)) continue;
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/.test(line)) return line;
  }

  return null;
}

function inferProfile(input: {
  text?: string | undefined;
  fileName?: string | undefined;
}): ExtractedProfile {
  const text = input.text ?? "";
  const years = inferYears(text);
  const skills = inferSkills(text);
  const targetRole = inferTargetRole(text, input.fileName);

  return {
    fullName: inferFullName(text),
    targetRole,
    years,
    seniority: inferSeniority(years),
    skills,
  };
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function textFromDataUrl(dataUrl: string): Promise<string> {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return "";
  const header = dataUrl.slice(5, commaIndex); // strip leading "data:"
  const mime = header.split(";")[0] ?? "";
  const isBase64 = header.includes(";base64");
  const encoded = dataUrl.slice(commaIndex + 1);
  const buffer = isBase64
    ? Buffer.from(encoded, "base64")
    : Buffer.from(decodeURIComponent(encoded), "utf8");

  if (mime.startsWith("text/")) {
    return buffer.toString("utf8");
  }

  if (mime === "application/pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (mime === DOCX_MIME) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Legacy .doc (application/msword) has no reliable pure-JS parser here.
  return "";
}

export async function extractProfileFromResume(input: {
  text?: string | undefined;
  fileName?: string | undefined;
  fileDataUrl?: string | undefined;
}): Promise<ExtractedProfile> {
  let text = input.text ?? "";
  if (!text && input.fileDataUrl) {
    try {
      text = await textFromDataUrl(input.fileDataUrl);
    } catch (error) {
      console.error("[resume] failed to extract text from uploaded file:", error);
      text = "";
    }
    if (text.trim().length < 40) {
      throw new Error(
        "We couldn't read text from that file — it may be a scanned image, password-protected, or an older .doc format. Please try a PDF/DOCX export or paste your resume text instead.",
      );
    }
  }

  return inferProfile({ text, fileName: input.fileName });
}
