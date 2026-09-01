import { jsPDF } from "jspdf";
import type { MatchReport } from "./matching";

const MARGIN = 46;
const INK = [24, 26, 32] as const;
const MUTED = [110, 116, 128] as const;
const BRAND = [56, 122, 255] as const;

export function downloadReportPdf(report: MatchReport, seniority?: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  let y = MARGIN;

  const room = (needed: number) => {
    if (y + needed > pageH - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const text = (
    value: string,
    opts: { size?: number; bold?: boolean; color?: readonly number[]; gap?: number } = {},
  ) => {
    const { size = 10, bold = false, color = INK, gap = 6 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0]!, color[1]!, color[2]!);
    const lines = doc.splitTextToSize(value, contentW) as string[];
    const lineH = size * 1.35;
    room(lines.length * lineH);
    doc.text(lines, MARGIN, y + size);
    y += lines.length * lineH + gap;
  };

  const rule = (gap = 12) => {
    room(gap);
    doc.setDrawColor(224, 227, 232);
    doc.setLineWidth(0.8);
    doc.line(MARGIN, y, pageW - MARGIN, y);
    y += gap;
  };

  // Header
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(0, 0, pageW, 8, "F");
  y = MARGIN + 4;
  text("Job Market Report", { size: 22, bold: true, gap: 2 });
  text(
    `Generated ${new Date(report.generatedAt).toLocaleString()} · based on ${report.totalJobsAnalyzed.toLocaleString()} cleaned Naukri listings, ${report.matchedJobs.toLocaleString()} matched your profile`,
    { size: 9, color: MUTED, gap: 14 },
  );

  // Profile
  const tags = [
    seniority,
    `${report.profile.years} yrs experience`,
    report.profile.targetRole || null,
  ].filter(Boolean) as string[];
  text("Your profile", { size: 12, bold: true, gap: 4 });
  text(tags.join("  ·  "), { size: 10, color: MUTED, gap: 4 });
  if (report.profile.skills.length) {
    text(`Skills detected: ${report.profile.skills.join(", ")}`, { size: 9, color: MUTED });
  }
  rule();

  // Best city
  const best = report.cities[0];
  if (best) {
    text("Best city for you right now", { size: 9, color: MUTED, gap: 2 });
    text(best.city, { size: 20, bold: true, color: BRAND, gap: 6 });
    text(report.experienceVerdict, { size: 10, gap: 10 });
    text(
      [
        `Matching roles: ${best.matchingJobs}`,
        `In your experience band: ${best.jobsInYourBand}`,
        `Experience asked: ${best.avgMinExperience}-${best.avgMaxExperience} yrs`,
        `Remote / hybrid: ${best.remoteFriendlyShare}%`,
      ].join("   |   "),
      { size: 10, bold: true },
    );
  } else {
    text(report.experienceVerdict, { size: 10 });
  }
  rule();

  // City breakdown
  text("City breakdown", { size: 13, bold: true, gap: 8 });
  report.cities.forEach((city, i) => {
    room(90);
    text(`${i + 1}. ${city.city}`, { size: 12, bold: true, gap: 2 });
    text(
      `${city.tier ?? "Tier n/a"} · ${city.totalJobs} total listings · ${city.matchingJobs} matches`,
      {
        size: 9,
        color: MUTED,
        gap: 4,
      },
    );
    text(
      `Roles inside your band: ${city.jobsInYourBand}/${city.matchingJobs} · typical experience ${city.avgMinExperience}-${city.avgMaxExperience} yrs · ${city.entryFriendlyShare}% open to 0-2 yrs`,
      { size: 9, gap: 4 },
    );
    if (city.topCompanies.length) {
      text(
        `Companies hiring: ${city.topCompanies.map((c) => `${c.name} (${c.jobs})`).join(", ")}`,
        { size: 9, gap: 4 },
      );
    }
    if (city.topRoles.length) {
      text(`Roles to target: ${city.topRoles.map((r) => r.name).join(", ")}`, { size: 9, gap: 4 });
    }
    if (city.missingSkills.length) {
      text(`Skills to add: ${city.missingSkills.join(", ")}`, { size: 9, gap: 4 });
    }
    y += 6;
  });

  // Skill gaps
  if (report.globalSkillGaps.length) {
    rule();
    text("Highest-leverage skills missing from your resume", { size: 13, bold: true, gap: 2 });
    text("Ranked by how often they appear in listings that matched your profile.", {
      size: 9,
      color: MUTED,
      gap: 6,
    });
    text(report.globalSkillGaps.map((s) => `${s.name} (${s.jobs} listings)`).join(", "), {
      size: 10,
    });
  }

  // Page numbers
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`Page ${p} of ${pages}`, pageW - MARGIN, pageH - 22, { align: "right" });
    doc.text("Naukri job market analysis", MARGIN, pageH - 22);
  }

  const city = best?.city?.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  doc.save(`job-market-report${city ? `-${city}` : ""}.pdf`);
}
