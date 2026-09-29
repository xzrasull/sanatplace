'use server';

import { requireStaff } from '@/src/lib/auth/staff';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/src/db';
import { createTechnique, renameTechnique } from '@/src/lib/catalog/techniques';

export async function addTechnique(formData: FormData) {
  await requireStaff('admin');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/admin/techniques');
  await createTechnique(getDb(), name);
  revalidatePath('/admin/techniques');
}

export async function renameTechniqueAction(formData: FormData) {
  await requireStaff('admin');
  const id = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  if (!id || !name) redirect('/admin/techniques');
  await renameTechnique(getDb(), { id, name });
  revalidatePath('/admin/techniques');
}
