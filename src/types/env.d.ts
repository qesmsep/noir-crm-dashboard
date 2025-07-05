declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    SENDGRID_API_KEY: string;
    SENDGRID_FROM_EMAIL: string;
    CRON_SECRET_TOKEN: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    OPENPHONE_API_KEY: string;
    OPENPHONE_PHONE_NUMBER_ID: string;
    // Allow any extra variables without type errors
    [key: string]: string | undefined;
  }
}