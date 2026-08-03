import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMarketOverview, type MarketOverview } from "@/lib/market.functions";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "India tech job market insights — CityFit" },
      {
        name: "description",
        content:
          "Live dashboard of cleaned Naukri hiring data: openings per city, experience expected, in-demand skills, work modes and the most active companies.",
      },
      { property: "og:title", content: "India tech job market insights" },
      {
        property: "og:description",
        content: "Openings per city, experience expected and the skills employers ask for.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData<MarketOverview>({
      queryKey: ["market-overview"],
      queryFn: () => getMarketOverview(),
    }),
  component: Insights,
  errorComponent: ({ error }) => (
    <div className="p-10 text-center" role="alert">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Nothing here.</div>,
});

function Insights() {
  const data = Route.useLoaderData() as MarketOverview;

  return (
    <main className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Link to="/" className="font-display text-lg font-bold">
          city<span className="text-primary">fit</span>
        </Link>
        <Link
          to="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Get your report
        </Link>
      </header>

      <section className="mx-auto max-w-6xl space-y-6 px-5 pb-20">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Market insights</h1>
          <p className="mt-2 text-muted-foreground">
            {data.totalJobs.toLocaleString()} cleaned listings.{" "}
            {data.lastRun
              ? `Last automated refresh ${new Date(data.lastRun.started_at).toLocaleDateString()} — ${data.lastRun.rows_inserted} new listings.`
              : "Weekly automated refresh is armed; no run recorded yet."}
          </p>
        </div>

        <div className="panel p-6">
          <h2 className="text-lg font-semibold">Openings by city</h2>
          <div className="mt-5 space-y-3">
            {data.cities.map((city) => {
              const max = data.cities[0]?.jobs ?? 1;
              return (
                <div key={city.city} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm text-muted-foreground">
                    {city.city}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      style={{ width: `${Math.max(3, (city.jobs / max) * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-sm font-medium">{city.jobs}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="panel p-6">
            <h2 className="text-lg font-semibold">Experience expected per city</h2>
            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Listings</TableHead>
                  <TableHead className="text-right">Years</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cities.map((city) => (
                  <TableRow key={city.city}>
                    <TableCell className="font-medium">{city.city}</TableCell>
                    <TableCell className="text-muted-foreground">{city.tier ?? "—"}</TableCell>
                    <TableCell className="text-right">{city.jobs}</TableCell>
                    <TableCell className="text-right">
                      {city.avgMin}-{city.avgMax}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-6">
            <div className="panel p-6">
              <h2 className="text-lg font-semibold">Most requested skills</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.topSkills.map((skill) => (
                  <Badge key={skill.name} variant="secondary" className="font-normal">
                    {skill.name} · {skill.jobs}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="panel p-6">
              <h2 className="text-lg font-semibold">Most active companies</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.topCompanies.map((company) => (
                  <Badge key={company.name} variant="secondary" className="font-normal">
                    {company.name} · {company.jobs}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="panel p-6">
              <h2 className="text-lg font-semibold">Categories & work modes</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.categories.map((c) => (
                  <Badge key={c.name} className="bg-accent/15 font-normal text-accent">
                    {c.name} · {c.jobs}
                  </Badge>
                ))}
                {data.workModes.map((m) => (
                  <Badge key={m.name} variant="secondary" className="font-normal">
                    {m.name} · {m.jobs}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
