'use server';

import { requireStaff } from '@/src/lib/auth/staff';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/src/db';
import { createCategory, renameCategory } from '@/src/lib/catalog/categories';

export async function addCategory(formData: FormData) {
  await requireStaff('admin');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/admin/categories');
  await createCategory(getDb(), name);
  revalidatePath('/admin/categories');
}

export async function renameCategoryAction(formData: FormData) {
  await requireStaff('admin');
  const id = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  if (!id || !name) redirect('/admin/categories');
  await renameCategory(getDb(), { id, name });
  revalidatePath('/admin/categories');
}
