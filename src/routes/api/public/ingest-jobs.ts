import "@/lib/env.server";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const JobSchema = z.object({
  category: z.string().max(200).nullish(),
  company: z.string().max(300).nullish(),
  job_title: z.string().max(400).nullish(),
  role: z.string().max(300).nullish(),
  job_description: z.string().max(8000).nullish(),
  location: z.string().max(200).nullish(),
  work_mode: z.string().max(60).nullish(),
  skills: z.string().max(2000).nullish(),
  key_skills: z.string().max(2000).nullish(),
  work_type: z.string().max(100).nullish(),
  keyword: z.string().max(200).nullish(),
  one_liner: z.string().max(500).nullish(),
  min_experience: z.number().min(0).max(60).nullish(),
  max_experience: z.number().min(0).max(60).nullish(),
  tier: z.string().max(40).nullish(),
  external_id: z.string().max(200).nullish(),
});

const BodySchema = z.object({
  jobs: z.array(JobSchema).min(1).max(5000),
});

export const Route = createFileRoute("/api/public/ingest-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["INGEST_TOKEN"];
        if (!expected) {
          return Response.json({ error: "Ingest token is not configured" }, { status: 503 });
        }
        const provided = request.headers.get("x-ingest-token") ?? "";
        if (provided.length !== expected.length || provided !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch (error) {
          return Response.json(
            { error: "Invalid payload", detail: (error as Error).message.slice(0, 500) },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: run } = await supabaseAdmin
          .from("scrape_runs")
          .insert({ rows_seen: body.jobs.length, status: "running" })
          .select("id")
          .maybeSingle();

        const rows = body.jobs.map((job) => {
          const row: Record<string, string | number | null> = { source: "naukri-selenium" };
          for (const [key, value] of Object.entries(job)) {
            row[key] = value === undefined ? null : value;
          }
          return row as never;
        });
        let inserted = 0;

        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const { error, data } = await supabaseAdmin.from("jobs").insert(chunk).select("id");
          if (!error) {
            inserted += data?.length ?? 0;
            continue;
          }
          // Duplicates in the batch: retry row by row and skip existing listings.
          for (const row of chunk) {
            const single = await supabaseAdmin.from("jobs").insert(row).select("id");
            if (!single.error) inserted += 1;
          }
        }

        if (run?.id) {
          await supabaseAdmin
            .from("scrape_runs")
            .update({
              finished_at: new Date().toISOString(),
              rows_inserted: inserted,
              status: "completed",
            })
            .eq("id", run.id);
        }

        return Response.json({ ok: true, received: rows.length, inserted });
      },
    },
  },
});
