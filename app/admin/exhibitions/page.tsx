import { redirect } from 'next/navigation';

// Online exhibitions are in the journal's list, with the other exhibitions.
export default function AdminExhibitionsPage() {
  redirect('/admin/journal?c=exhibition');
}
