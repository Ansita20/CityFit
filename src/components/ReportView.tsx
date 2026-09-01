import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { MatchReport } from "@/lib/matching";
import { downloadReportPdf } from "@/lib/report-pdf";
import { Building2, Download, MapPin, Sparkles, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export function ReportView({ report, seniority }: { report: MatchReport; seniority?: string }) {
  const best = report.cities[0];
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      downloadReportPdf(report, seniority);
      toast.success("Report downloaded as PDF");
    } catch (error) {
      console.error(error);
      toast.error("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Your report</Badge>
          {seniority ? <Badge variant="secondary">{seniority}</Badge> : null}
          <Badge variant="secondary">{report.profile.years} yrs experience</Badge>
          {report.profile.targetRole ? (
            <Badge variant="secondary">{report.profile.targetRole}</Badge>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={handleDownload}
            disabled={downloading}
          >
            <Download className="size-4" />
            {downloading ? "Preparing..." : "Download PDF"}
          </Button>
        </div>

        {report.homeCity ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Ranked near <span className="font-medium text-foreground">{report.homeCity}</span>
            {report.homeState ? ` (${report.homeState})` : ""} first, then the rest of India.
            {report.suggestedHubs.length ? (
              <>
                {" "}
                No listings in {report.homeState} yet — showing the nearest job hubs (
                {report.suggestedHubs.join(", ")}) instead.
              </>
            ) : null}
          </p>
        ) : null}

        {best ? (
          <>
            <p className="mt-6 text-sm uppercase tracking-widest text-muted-foreground">
              Best city for you right now
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-4xl font-bold">
              <MapPin className="size-7 text-primary" />
              <span className="text-gradient">{best.city}</span>
              {best.proximity === "home-city" ? (
                <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Home city</Badge>
              ) : best.proximity === "home-state" ? (
                <Badge className="bg-primary/15 text-primary hover:bg-primary/20">
                  In {best.state}
                </Badge>
              ) : best.proximity === "nearby-hub" ? (
                <Badge className="bg-primary/15 text-primary hover:bg-primary/20">
                  Nearest hub
                </Badge>
              ) : null}
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">{report.experienceVerdict}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              <Stat label="Matching roles" value={best.matchingJobs} />
              <Stat label="In your band" value={best.jobsInYourBand} />
              <Stat
                label="Experience asked"
                value={`${best.avgMinExperience}-${best.avgMaxExperience} yr`}
              />
              <Stat label="Remote / hybrid" value={`${best.remoteFriendlyShare}%`} />
            </div>
          </>
        ) : (
          <p className="mt-6 text-muted-foreground">{report.experienceVerdict}</p>
        )}
        <p className="mt-6 text-xs text-muted-foreground">
          Based on {report.totalJobsAnalyzed.toLocaleString()} cleaned Naukri listings ·{" "}
          {report.matchedJobs.toLocaleString()} matched your profile
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {report.cities.map((city, index) => {
          const previousProximity = report.cities[index - 1]?.proximity;
          const dividerLabel =
            index > 0 && city.proximity !== previousProximity
              ? city.proximity === "nearby-hub"
                ? "Nearest job hubs"
                : city.proximity === "other"
                  ? "Rest of India"
                  : null
              : null;
          return (
            <Fragment key={city.city}>
              {dividerLabel ? (
                <p
                  key={`${city.city}-divider`}
                  className="col-span-full mt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground"
                >
                  {dividerLabel}
                </p>
              ) : null}
              <div key={city.city} className="panel p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-xl font-semibold">
                      <span className="text-muted-foreground">#{index + 1}</span>
                      {city.city}
                      {city.proximity === "home-city" ? (
                        <Badge variant="secondary" className="font-normal">
                          Home city
                        </Badge>
                      ) : city.proximity === "home-state" ? (
                        <Badge variant="secondary" className="font-normal">
                          {city.state}
                        </Badge>
                      ) : city.proximity === "nearby-hub" ? (
                        <Badge variant="secondary" className="font-normal">
                          Nearest hub
                        </Badge>
                      ) : null}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {city.tier ?? "Tier n/a"} · {city.totalJobs} total listings
                    </p>
                  </div>
                  <Badge className="bg-accent/15 text-accent hover:bg-accent/20">
                    {city.matchingJobs} matches
                  </Badge>
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <div>
                    <div className="mb-1 flex justify-between text-muted-foreground">
                      <span>Roles inside your experience band</span>
                      <span>
                        {city.jobsInYourBand}/{city.matchingJobs}
                      </span>
                    </div>
                    <Progress
                      value={
                        city.matchingJobs ? (city.jobsInYourBand / city.matchingJobs) * 100 : 0
                      }
                    />
                  </div>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="size-4 text-primary" />
                    Typical experience asked: {city.avgMinExperience}-{city.avgMaxExperience} years
                    · {city.entryFriendlyShare}% open to 0-2 yrs
                  </p>
                </div>

                <Section
                  icon={<Building2 className="size-4 text-primary" />}
                  title="Companies hiring"
                >
                  {city.topCompanies.map((c) => (
                    <Badge key={c.name} variant="secondary" className="font-normal">
                      {c.name} · {c.jobs}
                    </Badge>
                  ))}
                </Section>

                <Section icon={<Target className="size-4 text-primary" />} title="Roles to target">
                  {city.topRoles.map((r) => (
                    <Badge key={r.name} variant="secondary" className="font-normal">
                      {r.name}
                    </Badge>
                  ))}
                </Section>

                {city.missingSkills.length > 0 ? (
                  <Section icon={<Sparkles className="size-4 text-accent" />} title="Skills to add">
                    {city.missingSkills.map((s) => (
                      <Badge
                        key={s}
                        className="bg-accent/15 font-normal text-accent hover:bg-accent/20"
                      >
                        {s}
                      </Badge>
                    ))}
                  </Section>
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>

      {report.globalSkillGaps.length > 0 ? (
        <div className="panel p-6">
          <h3 className="text-lg font-semibold">
            Highest-leverage skills missing from your resume
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by how often they appear in listings that matched your profile.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {report.globalSkillGaps.map((skill) => (
              <Badge key={skill.name} variant="secondary" className="font-normal">
                {skill.name} · {skill.jobs} listings
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
