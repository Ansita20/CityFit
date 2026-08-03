import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportView } from "@/components/ReportView";
import { generateReport } from "@/lib/report.functions";
import { getMarketOverview, type MarketOverview } from "@/lib/market.functions";
import { supabase } from "@/integrations/supabase/client";
import { FileUp, Loader2, LogIn, LogOut, UserPlus } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CityFit — Find the Indian city where you'll get hired fastest" },
      {
        name: "description",
        content:
          "Upload your resume and get a free report on the best Indian cities for your skills: matching roles, experience needed and companies hiring, from thousands of cleaned Naukri listings.",
      },
      { property: "og:title", content: "CityFit — Where should you job hunt next?" },
      {
        property: "og:description",
        content:
          "Resume in, city report out: matching roles, experience needed and companies hiring across India.",
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
  component: Home,
  errorComponent: ({ error }) => (
    <div className="p-10 text-center" role="alert">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Nothing here.</div>,
});

const MAX_BYTES = 6 * 1024 * 1024;

function Home() {
  const overview = Route.useLoaderData() as MarketOverview;
  const run = useServerFn(generateReport);

  const [fullName, setFullName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setSessionLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const accountEmail = session?.user.email ?? "";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!accountEmail) {
        throw new Error("Sign in or create an account before generating a report.");
      }

      let fileDataUrl: string | undefined;
      if (file) {
        if (file.size > MAX_BYTES) throw new Error("Resume must be smaller than 6 MB.");
        fileDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read that file."));
          reader.readAsDataURL(file);
        });
      }
      return run({
        data: {
          ...(fullName ? { fullName } : {}),
          ...(targetRole ? { targetRoleOverride: targetRole } : {}),
          ...(resumeText ? { resumeText } : {}),
          ...(file ? { fileName: file.name } : {}),
          ...(fileDataUrl ? { fileDataUrl } : {}),
        },
      });
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: (data) => {
      toast.success("Report ready below.");
    },
  });

  const result = mutation.data;

  return (
    <main className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <span className="font-display text-lg font-bold">
          city<span className="text-primary">fit</span>
        </span>
        <div className="flex items-center gap-3 text-sm">
          <Link
            to="/insights"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Market insights
          </Link>
          {accountEmail ? (
            <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              <span>{accountEmail}</span>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setSession(null);
                }}
                className="inline-flex items-center gap-1 text-foreground"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="#auth"
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-foreground transition-colors hover:bg-accent"
            >
              <LogIn className="size-3.5" />
              Sign in / Sign up
            </Link>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-6">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <Badge className="bg-primary/15 text-primary hover:bg-primary/20">
              {overview.totalJobs.toLocaleString()} cleaned listings · refreshed weekly
            </Badge>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-6xl">
              Find the city where <span className="text-gradient">your resume wins</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              We continuously collect and clean Naukri job data. Drop in your resume and get a free
              report: the cities with the most openings for your skills, the experience each city
              expects, the roles to target and the companies actually hiring.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {overview.cities.slice(0, 6).map((city) => (
                <span key={city.city} className="rounded-full border border-border px-3 py-1">
                  {city.city} · {city.jobs}
                </span>
              ))}
            </div>
          </div>

          <div className="panel p-6 sm:p-8" id="auth">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Account access</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign in to save reports, or create an account to get started.
                </p>
              </div>
              <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                {sessionLoading ? "Checking session..." : accountEmail ? "Signed in" : "Signed out"}
              </div>
            </div>

            {accountEmail ? (
              <div className="mt-6 rounded-2xl border border-border bg-surface/60 p-4 text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{accountEmail}</span>.
                Reports will be saved to this account.
              </div>
            ) : (
              <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as "sign-in" | "sign-up")} className="mt-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sign-in">Sign in</TabsTrigger>
                  <TabsTrigger value="sign-up">Sign up</TabsTrigger>
                </TabsList>
                <TabsContent value="sign-in" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="auth-email-signin">Email</Label>
                    <Input
                      id="auth-email-signin"
                      type="email"
                      autoComplete="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auth-password-signin">Password</Label>
                    <Input
                      id="auth-password-signin"
                      type="password"
                      autoComplete="current-password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    size="lg"
                    disabled={authBusy || !authEmail || !authPassword}
                    onClick={async () => {
                      setAuthBusy(true);
                      setAuthMessage(null);
                      const { error } = await supabase.auth.signInWithPassword({
                        email: authEmail,
                        password: authPassword,
                      });
                      setAuthBusy(false);
                      if (error) {
                        toast.error(error.message);
                        return;
                      }
                      toast.success("Signed in successfully.");
                    }}
                  >
                    {authBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LogIn className="mr-2 size-4" />}
                    Sign in
                  </Button>
                </TabsContent>
                <TabsContent value="sign-up" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="auth-email-signup">Email</Label>
                    <Input
                      id="auth-email-signup"
                      type="email"
                      autoComplete="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auth-password-signup">Password</Label>
                    <Input
                      id="auth-password-signup"
                      type="password"
                      autoComplete="new-password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Create a password"
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    size="lg"
                    disabled={authBusy || !authEmail || !authPassword}
                    onClick={async () => {
                      setAuthBusy(true);
                      setAuthMessage(null);
                      const { data, error } = await supabase.auth.signUp({
                        email: authEmail,
                        password: authPassword,
                      });
                      setAuthBusy(false);
                      if (error) {
                        toast.error(error.message);
                        return;
                      }
                      if (data.session) {
                        toast.success("Account created and signed in.");
                        return;
                      }
                      setAuthMessage("Account created. Check your email to confirm the account, then sign in.");
                      toast.success("Account created. Check your email to confirm it.");
                    }}
                  >
                    {authBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />}
                    Create account
                  </Button>
                </TabsContent>
              </Tabs>
            )}

            {authMessage ? (
              <p className="mt-4 text-sm text-muted-foreground">{authMessage}</p>
            ) : null}
          </div>

          <div className="panel p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">Get your free city report</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              PDF, DOCX or plain text. We read skills and experience automatically.
            </p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!file && resumeText.trim().length < 40) {
                  toast.error("Upload a resume file or paste at least a few lines of resume text.");
                  return;
                }
                mutation.mutate();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={fullName}
                    maxLength={120}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Target role (optional)</Label>
                <Input
                  id="role"
                  value={targetRole}
                  maxLength={120}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Data Analyst"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resume">Resume file</Label>
                <label
                  htmlFor="resume"
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-primary/60"
                >
                  <FileUp className="size-5 text-primary" />
                  {file ? file.name : "Click to choose a PDF, DOCX or TXT file"}
                </label>
                <input
                  id="resume"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="text">Or paste your resume text</Label>
                <Textarea
                  id="text"
                  rows={4}
                  maxLength={40000}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your experience and skills here"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={mutation.isPending || !accountEmail}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Analysing your resume…
                  </>
                ) : (
                  "Generate my report"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Sign in first so we can save your report under your account. Nothing is shared with recruiters.
              </p>
            </form>
          </div>
        </div>

        {result ? (
          <div className="mt-16 space-y-4">
            <ReportView report={result.report} seniority={result.seniority} />
          </div>
        ) : null}
      </section>
    </main>
  );
}
