export type JobRow = {
  category: string | null;
  company: string | null;
  role: string | null;
  location: string | null;
  work_mode: string | null;
  key_skills: string | null;
  skills: string | null;
  min_experience: number | null;
  max_experience: number | null;
  tier: string | null;
};

export type Profile = {
  skills: string[];
  years: number;
  targetRole: string;
};

export type CityInsight = {
  city: string;
  tier: string | null;
  totalJobs: number;
  matchingJobs: number;
  jobsInYourBand: number;
  avgMinExperience: number;
  avgMaxExperience: number;
  entryFriendlyShare: number;
  remoteFriendlyShare: number;
  topCompanies: { name: string; jobs: number }[];
  topRoles: { name: string; jobs: number }[];
  topSkills: { name: string; jobs: number }[];
  missingSkills: string[];
  score: number;
};

export type MatchReport = {
  generatedAt: string;
  profile: Profile;
  totalJobsAnalyzed: number;
  matchedJobs: number;
  cities: CityInsight[];
  globalSkillGaps: { name: string; jobs: number }[];
  experienceVerdict: string;
};

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#.]/g, "");

const SKILL_NOISE = new Set([
  "early applicant",
  "posted few days ago",
  "walk in",
  "walkin",
  "job",
  "jobs",
  "full time",
  "part time",
  "permanent",
  "hybrid",
  "remote",
  "work from home",
  "work from office",
  "immediate joiner",
  "immediate joiners",
  "na",
  "n a",
]);

export function splitSkills(job: JobRow): string[] {
  const raw = [job.key_skills, job.skills].filter(Boolean).join(",");
  return raw
    .split(/[,/|;]+/)
    .map((s) => s.trim())
    .filter(
      (s) => s.length > 1 && s.length < 40 && !SKILL_NOISE.has(s.toLowerCase().replace(/[-_]/g, " ")),
    );
}


function skillOverlap(profileSkills: Set<string>, jobSkills: string[]) {
  if (jobSkills.length === 0) return 0;
  let hits = 0;
  for (const skill of jobSkills) {
    const n = norm(skill);
    for (const p of profileSkills) {
      if (n === p || n.includes(p) || p.includes(n)) {
        hits += 1;
        break;
      }
    }
  }
  return hits / jobSkills.length;
}

function roleAffinity(job: JobRow, targetRole: string) {
  if (!targetRole) return 0;
  const target = targetRole.toLowerCase();
  const words = target.split(/\s+/).filter((w) => w.length > 2);
  const haystack = `${job.role ?? ""} ${job.category ?? ""}`.toLowerCase();
  if (!words.length) return 0;
  const hits = words.filter((w) => haystack.includes(w)).length;
  return hits / words.length;
}

function topN(counter: Map<string, number>, n: number) {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, jobs]) => ({ name, jobs }));
}

export function buildReport(jobs: JobRow[], profile: Profile): MatchReport {
  const profileSkills = new Set(profile.skills.map(norm).filter(Boolean));

  type Bucket = {
    city: string;
    tier: string | null;
    total: number;
    matching: number;
    inBand: number;
    entryFriendly: number;
    remoteFriendly: number;
    minSum: number;
    maxSum: number;
    expCount: number;
    companies: Map<string, number>;
    roles: Map<string, number>;
    skills: Map<string, number>;
  };

  const buckets = new Map<string, Bucket>();
  const globalSkills = new Map<string, number>();
  let matchedJobs = 0;

  for (const job of jobs) {
    const city = (job.location ?? "").trim();
    if (!city) continue;

    let bucket = buckets.get(city);
    if (!bucket) {
      bucket = {
        city,
        tier: job.tier ?? null,
        total: 0,
        matching: 0,
        inBand: 0,
        entryFriendly: 0,
        remoteFriendly: 0,
        minSum: 0,
        maxSum: 0,
        expCount: 0,
        companies: new Map(),
        roles: new Map(),
        skills: new Map(),
      };
      buckets.set(city, bucket);
    }
    bucket.total += 1;
    if (!bucket.tier && job.tier) bucket.tier = job.tier;

    const jobSkills = splitSkills(job);
    const overlap = skillOverlap(profileSkills, jobSkills);
    const affinity = roleAffinity(job, profile.targetRole);
    const relevance = Math.max(overlap, affinity * 0.9);
    const isMatch = relevance >= 0.25;

    const min = job.min_experience ?? 0;
    const max = job.max_experience ?? min + 3;
    const inBand = profile.years >= min - 1 && profile.years <= max + 1;

    if (min <= 2) bucket.entryFriendly += 1;
    if ((job.work_mode ?? "").toLowerCase() !== "on-site") bucket.remoteFriendly += 1;
    bucket.minSum += min;
    bucket.maxSum += max;
    bucket.expCount += 1;

    if (!isMatch) continue;

    matchedJobs += 1;
    bucket.matching += 1;
    if (inBand) bucket.inBand += 1;

    if (job.company) bucket.companies.set(job.company, (bucket.companies.get(job.company) ?? 0) + 1);
    if (job.role) bucket.roles.set(job.role, (bucket.roles.get(job.role) ?? 0) + 1);
    for (const skill of jobSkills) {
      const clean = skill.replace(/\s+/g, " ");
      bucket.skills.set(clean, (bucket.skills.get(clean) ?? 0) + 1);
      globalSkills.set(clean, (globalSkills.get(clean) ?? 0) + 1);
    }
  }

  const isKnown = (skill: string) => {
    const n = norm(skill);
    for (const p of profileSkills) if (n === p || n.includes(p) || p.includes(n)) return true;
    return false;
  };

  const cities: CityInsight[] = [...buckets.values()]
    .filter((b) => b.matching > 0)
    .map((b) => {
      const topSkills = topN(b.skills, 8);
      return {
        city: b.city,
        tier: b.tier,
        totalJobs: b.total,
        matchingJobs: b.matching,
        jobsInYourBand: b.inBand,
        avgMinExperience: b.expCount ? Number((b.minSum / b.expCount).toFixed(1)) : 0,
        avgMaxExperience: b.expCount ? Number((b.maxSum / b.expCount).toFixed(1)) : 0,
        entryFriendlyShare: b.total ? Math.round((b.entryFriendly / b.total) * 100) : 0,
        remoteFriendlyShare: b.total ? Math.round((b.remoteFriendly / b.total) * 100) : 0,
        topCompanies: topN(b.companies, 6),
        topRoles: topN(b.roles, 5),
        topSkills,
        missingSkills: topSkills.filter((s) => !isKnown(s.name)).map((s) => s.name).slice(0, 5),
        score: Number((b.inBand * 2 + b.matching).toFixed(1)),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const best = cities[0];
  const experienceVerdict = best
    ? `In ${best.city}, roles matching your profile ask for roughly ${best.avgMinExperience}-${best.avgMaxExperience} years of experience. With ${profile.years} year${profile.years === 1 ? "" : "s"}, ${best.jobsInYourBand} of ${best.matchingJobs} matching openings sit inside your experience band.`
    : "We could not match your skills to the current dataset. Try adding a target role or more specific skills.";

  return {
    generatedAt: new Date().toISOString(),
    profile,
    totalJobsAnalyzed: jobs.length,
    matchedJobs,
    cities,
    globalSkillGaps: topN(globalSkills, 20).filter((s) => !isKnown(s.name)).slice(0, 8),
    experienceVerdict,
  };
}
