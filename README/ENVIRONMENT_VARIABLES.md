# Environment Variables

The application relies on several environment variables for external services and secure operations. Make sure **all** of these are defined in your deployment platform (e.g. Vercel → Project → Settings → Environment Variables) and in your local `.env.local` when developing locally.

| Variable | Description |
|----------|-------------|
| `CRON_SECRET_TOKEN` | Shared secret used by the two cron endpoints (`/api/cron-process-reminders` and `/api/cron-monthly-statements`) for manual invocations. Set this to any random string and keep it private. |
| `SENDGRID_API_KEY` | Your SendGrid API key. Required for sending the monthly statement e-mails. |
| `SENDGRID_FROM_EMAIL` | The "from" address used when sending statements (e.g. `no-reply@yourdomain.com`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Public URL for your Supabase instance. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-side only) used by API routes that need elevated access, such as ledger queries. |

Add, update, or rotate these variables without redeploying code by using Vercel's environment variable UI. Remember to redeploy (or restart locally) after changing any values so the Node process picks them up.