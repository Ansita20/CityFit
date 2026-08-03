# Job Matcher Pro

Local job-market matching app for resume-based city reports.

## Development

Install dependencies and run the app locally:

```sh
bun install
bun run dev
```

If you prefer npm:

```sh
npm install
npm run dev
```

## Environment

Set the Supabase variables used by the app and server functions:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

For the client build, the Vite-prefixed equivalents also work:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Stack

- TanStack Start
- TypeScript
- React
- Tailwind CSS
