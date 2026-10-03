import { permanentRedirect } from 'next/navigation';

// Online exhibitions are listed in the journal, with the other exhibitions.
export default function ExhibitionsPage() {
  permanentRedirect('/journal?c=exhibition');
}
