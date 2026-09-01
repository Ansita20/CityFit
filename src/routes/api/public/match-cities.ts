import "@/lib/env.server";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Server-to-server bridge for external apps (e.g. resumeBuilder) that already
// have a structured candidate profile and just want city-fit matches back —
// skips the resume-file-upload + Supabase-login flow that the in-app report
// generator (report.functions.ts) requires, since the caller here is another
// backend acting on behalf of its own already-authenticated user, not a
// CityFit account holder.
const ProfileSchema = z.object({
  skills: z.array(z.string().max(100)).max(100).default([]),
  years: z.number().min(0).max(60).default(0),
  targetRole: z.string().max(200).default(""),
  homeCity: z.string().max(120).nullish(),
});

export const Route = createFileRoute("/api/public/match-cities")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["BRIDGE_TOKEN"];
        if (!expected) {
          return Response.json({ error: "Bridge token is not configured" }, { status: 503 });
        }
        const provided = request.headers.get("x-bridge-token") ?? "";
        if (provided.length !== expected.length || provided !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let profile: z.infer<typeof ProfileSchema>;
        try {
          profile = ProfileSchema.parse(await request.json());
        } catch (error) {
          return Response.json(
            { error: "Invalid payload", detail: (error as Error).message.slice(0, 500) },
            { status: 400 },
          );
        }

        const { fetchAllJobs } = await import("@/lib/jobs.server");
        const { buildReport } = await import("@/lib/matching");

        const jobs = await fetchAllJobs();
        const report = buildReport(jobs, profile);

        return Response.json({ report });
      },
    },
  },
});
