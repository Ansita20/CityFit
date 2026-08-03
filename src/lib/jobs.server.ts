import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { JobRow, Profile } from "./matching";

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
  "typescript",
  "javascript",
  "react",
  "next.js",
  "nextjs",
  "node.js",
  "nodejs",
  "python",
  "sql",
  "postgres",
  "postgresql",
  "mongodb",
  "docker",
  "kubernetes",
  "aws",
  "gcp",
  "azure",
  "git",
  "figma",
  "redux",
  "tailwind",
  "tailwindcss",
  "express",
  "django",
  "flask",
  "fastapi",
  "pandas",
  "numpy",
  "scikit-learn",
  "machine learning",
  "data analysis",
  "data analytics",
  "power bi",
  "tableau",
  "excel",
  "java",
  "spring",
  "c#",
  "c++",
  "go",
  "rust",
  "testing",
  "jest",
  "playwright",
  "cypress",
  "rest api",
  "graphql",
  "microservices",
];

const ROLE_KEYWORDS: Array<[string, string[]]> = [
  ["Data Analyst", ["data analyst", "analytics", "business intelligence", "bi analyst"]],
  ["Data Engineer", ["data engineer", "etl", "airflow", "spark", "dbt"]],
  ["Data Scientist", ["data scientist", "machine learning", "ml engineer", "deep learning"]],
  ["Frontend Developer", ["frontend", "front end", "react", "ui engineer", "web developer"]],
  ["Backend Developer", ["backend", "back end", "api developer", "server-side", "microservices"]],
  ["DevOps Engineer", ["devops", "sre", "platform engineer", "kubernetes", "ci/cd"]],
  ["Product Manager", ["product manager", "product owner", "roadmap", "product strategy"]],
  ["Business Analyst", ["business analyst", "requirements", "stakeholder", "process analyst"]],
  ["Software Engineer", ["software engineer", "software developer", "full stack", "fullstack", "developer"]],
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.\s/-]/g, " ");
}

function inferYears(text: string) {
  const normalized = normalizeText(text);
  const matches = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s*(?:of)?\s*experience/g)];
  const years = matches.map((match) => Number(match[1])).filter((value) => Number.isFinite(value));
  return years.length ? Math.max(...years) : 0;
}

function inferSeniority(years: number) {
  if (years <= 0) return "Fresher";
  if (years < 2) return "Junior";
  if (years < 5) return "Mid";
  if (years < 8) return "Senior";
  return "Lead";
}

function inferTargetRole(text: string, fileName?: string) {
  const haystack = normalizeText(`${fileName ?? ""} ${text}`);
  for (const [role, keywords] of ROLE_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return role;
  }
  return "Software Engineer";
}

function inferSkills(text: string) {
  const haystack = normalizeText(text);
  const skills = SKILL_KEYWORDS.filter((keyword) => haystack.includes(keyword));
  return [...new Set(skills)].slice(0, 30);
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

function inferProfile(input: { text?: string | undefined; fileName?: string | undefined }): ExtractedProfile {
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

export async function extractProfileFromResume(input: {
  text?: string | undefined;
  fileName?: string | undefined;
  fileDataUrl?: string | undefined;
}): Promise<ExtractedProfile> {
  let text = input.text ?? "";
  if (!text && input.fileDataUrl?.startsWith("data:text/")) {
    const commaIndex = input.fileDataUrl.indexOf(",");
    if (commaIndex >= 0) {
      const encoded = input.fileDataUrl.slice(commaIndex + 1);
      const isBase64 = input.fileDataUrl.slice(0, commaIndex).includes(";base64");
      text = isBase64 ? Buffer.from(encoded, "base64").toString("utf8") : decodeURIComponent(encoded);
    }
  }

  return inferProfile({ text, fileName: input.fileName });
}
