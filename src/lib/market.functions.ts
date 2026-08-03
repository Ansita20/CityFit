import { createServerFn } from "@tanstack/react-start";

export type MarketOverview = {
  totalJobs: number;
  cities: { city: string; jobs: number; avgMin: number; avgMax: number; tier: string | null }[];
  categories: { name: string; jobs: number }[];
  workModes: { name: string; jobs: number }[];
  topSkills: { name: string; jobs: number }[];
  topCompanies: { name: string; jobs: number }[];
  lastRun: {
    started_at: string;
    finished_at: string | null;
    rows_inserted: number;
    status: string;
  } | null;
};

export const getMarketOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<MarketOverview> => {
    const { fetchAllJobs, fetchLastRun } = await import("@/lib/jobs.server");
    const { splitSkills } = await import("@/lib/matching");

    const jobs = await fetchAllJobs();
    const lastRun = await fetchLastRun();

    const cityMap = new Map<string, { jobs: number; min: number; max: number; tier: string | null }>();
    const categories = new Map<string, number>();
    const workModes = new Map<string, number>();
    const skills = new Map<string, number>();
    const companies = new Map<string, number>();

    for (const job of jobs) {
      const city = (job.location ?? "").trim();
      if (city) {
        const entry = cityMap.get(city) ?? { jobs: 0, min: 0, max: 0, tier: job.tier ?? null };
        entry.jobs += 1;
        entry.min += job.min_experience ?? 0;
        entry.max += job.max_experience ?? job.min_experience ?? 0;
        if (!entry.tier && job.tier) entry.tier = job.tier;
        cityMap.set(city, entry);
      }
      if (job.category) categories.set(job.category, (categories.get(job.category) ?? 0) + 1);
      if (job.work_mode) workModes.set(job.work_mode, (workModes.get(job.work_mode) ?? 0) + 1);
      if (job.company) companies.set(job.company, (companies.get(job.company) ?? 0) + 1);
      for (const skill of splitSkills(job)) {
        const clean = skill.replace(/\s+/g, " ");
        skills.set(clean, (skills.get(clean) ?? 0) + 1);
      }
    }

    const top = (map: Map<string, number>, n: number) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([name, jobs]) => ({ name, jobs }));

    return {
      totalJobs: jobs.length,
      cities: [...cityMap.entries()]
        .sort((a, b) => b[1].jobs - a[1].jobs)
        .slice(0, 12)
        .map(([city, v]) => ({
          city,
          jobs: v.jobs,
          avgMin: Number((v.min / v.jobs).toFixed(1)),
          avgMax: Number((v.max / v.jobs).toFixed(1)),
          tier: v.tier,
        })),
      categories: top(categories, 8),
      workModes: top(workModes, 5),
      topSkills: top(skills, 14),
      topCompanies: top(companies, 10),
      lastRun,
    };
  },
);
