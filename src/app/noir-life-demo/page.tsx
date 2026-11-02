import { notFound } from 'next/navigation';
import NoirLifeDemo from './NoirLifeDemo';

// Preview-only page with sample content, used to show how Noir.life posts look.
// Returns 404 on production.
export const dynamic = 'force-dynamic';

export default function Page() {
  if (process.env.VERCEL_ENV === 'production') notFound();
  return <NoirLifeDemo />;
}
