/**
 * Location logo for the no-login guest forms. Uses the logos already in
 * public/images; there is no logo field on locations yet, so the mapping is by
 * slug. Noir KC and Noir OP share the Noir script (the member portal uses the
 * same one). An unknown location shows no logo rather than a guess.
 */
import React from 'react';

interface LogoAsset {
  src: string;
  alt: string;
  /** The Noir script is near-white; darken it so it shows on the cream page. */
  darken?: boolean;
  heightClass: string;
}

const LOGOS: Record<string, LogoAsset> = {
  noirkc: { src: '/images/noir-wedding-day.png', alt: 'Noir', darken: true, heightClass: 'h-14' },
  noirop: { src: '/images/noir-wedding-day.png', alt: 'Noir', darken: true, heightClass: 'h-14' },
  rooftopkc: { src: '/images/rooftopkc-logo.png', alt: 'RooftopKC', heightClass: 'h-20' },
};

export function locationLogo(slug: string | null | undefined): LogoAsset | null {
  return (slug && LOGOS[slug.toLowerCase()]) || null;
}

export default function LocationLogo({ slug }: { slug: string | null | undefined }) {
  const logo = locationLogo(slug);
  if (!logo) return null;
  return (
    <div className="flex justify-center pt-2" data-testid="location-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.src}
        alt={logo.alt}
        className={`${logo.heightClass} w-auto max-w-full object-contain`}
        style={logo.darken ? { filter: 'brightness(0)', opacity: 0.85 } : undefined}
      />
    </div>
  );
}
