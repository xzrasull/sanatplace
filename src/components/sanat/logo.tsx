import Image from 'next/image';
import Link from 'next/link';
import { BRAND_NAME } from '@/src/lib/brand';

// The word mark with the diamond ornament, drawn black; over the home banner
// CSS turns it white (see .stage:has(.hero) .nav .logo img).
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label={`${BRAND_NAME}, на главную`}>
      <Image src="/logo.svg" alt="" width={779} height={172} priority />
    </Link>
  );
}
