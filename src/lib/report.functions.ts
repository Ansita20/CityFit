import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const ReportInput = z.object({
  fullName: z.string().trim().max(120).optional(),
  resumeText: z.string().trim().max(40000).optional(),
  fileName: z.string().trim().max(200).optional(),
  fileDataUrl: z.string().max(9_000_000).optional(),
  targetRoleOverride: z.string().trim().max(120).optional(),
});

export const generateReport = createServerFn({ method: "POST" })
  .validator((input: unknown) => ReportInput.parse(input))
  .handler(async ({ data }) => {
    if (!data.resumeText && !data.fileDataUrl) {
      throw new Error("Upload a resume file or paste your resume text.");
    }

    const request = getRequest();
    const authHeader = request?.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      throw new Error("Sign in before generating a report.");
    }

    const { extractProfileFromResume, fetchAllJobs } = await import("@/lib/jobs.server");
    const { buildReport } = await import("@/lib/matching");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const accountEmail = userData.user?.email ?? null;
    if (userError || !accountEmail) {
      throw new Error("Sign in before generating a report.");
    }

    const profile = await extractProfileFromResume({
      text: data.resumeText,
      fileName: data.fileName,
      fileDataUrl: data.fileDataUrl,
    });

    if (data.targetRoleOverride) profile.targetRole = data.targetRoleOverride;

    const jobs = await fetchAllJobs();
    const report = buildReport(jobs, {
      skills: profile.skills,
      years: profile.years,
      targetRole: profile.targetRole,
    });

    const { data: saved } = await supabaseAdmin
      .from("resume_reports")
      .insert({
        email: accountEmail,
        full_name: data.fullName ?? profile.fullName,
        target_role: profile.targetRole,
        extracted_skills: profile.skills,
        years_experience: profile.years,
        seniority: profile.seniority,
        report: JSON.parse(JSON.stringify(report)),
        email_sent: false,
      })
      .select("id")
      .maybeSingle();

    return {
      reportId: saved?.id ?? null,
      seniority: profile.seniority,
      fullName: profile.fullName,
      report,
    };
  });
