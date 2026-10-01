'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// The public pages lay themselves out (hero, edge-to-edge band, grids). Every
// other page (cabinets, admin, forms) gets the standard content column.
function isPublicPage(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/gallery' ||
    pathname.startsWith('/gallery/') ||
    pathname === '/artists' ||
    pathname === '/exhibitions' ||
    pathname.startsWith('/exhibitions/') ||
    pathname === '/favorites' ||
    pathname === '/sell' ||
    pathname === '/sign-in' ||
    pathname === '/sanatadmin'
  );
}

export function PageFrame({ children }: { children: ReactNode }) {
  if (isPublicPage(usePathname())) return <div className="page">{children}</div>;
  return (
    <div className="page">
      <div className="wrap page-plain">{children}</div>
    </div>
  );
}
