CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text,
  company text,
  job_title text,
  role text,
  job_description text,
  location text,
  work_mode text,
  skills text,
  key_skills text,
  work_type text,
  keyword text,
  one_liner text,
  min_experience numeric,
  max_experience numeric,
  tier text,
  source text NOT NULL DEFAULT 'seed',
  external_id text,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_location_idx ON public.jobs (location);
CREATE INDEX jobs_role_idx ON public.jobs (role);
CREATE INDEX jobs_category_idx ON public.jobs (category);
CREATE UNIQUE INDEX jobs_dedupe_idx ON public.jobs (md5(coalesce(company,'') || '|' || coalesce(role,'') || '|' || coalesce(location,'') || '|' || coalesce(min_experience::text,'') || '|' || coalesce(max_experience::text,'')));

GRANT SELECT ON public.jobs TO anon, authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Jobs are publicly readable" ON public.jobs FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.resume_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  email text NOT NULL,
  target_role text,
  extracted_skills text[] NOT NULL DEFAULT '{}',
  years_experience numeric,
  seniority text,
  report jsonb,
  email_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.resume_reports TO service_role;
ALTER TABLE public.resume_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.scrape_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  rows_inserted integer NOT NULL DEFAULT 0,
  rows_seen integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  error text
);
GRANT SELECT ON public.scrape_runs TO anon, authenticated;
GRANT ALL ON public.scrape_runs TO service_role;
ALTER TABLE public.scrape_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scrape runs are publicly readable" ON public.scrape_runs FOR SELECT TO anon, authenticated USING (true);