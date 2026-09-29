import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { listCategories } from '@/src/lib/catalog/categories';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { ReferenceList } from '@/src/components/admin/reference-list';
import { addCategory, renameCategoryAction } from './actions';

export default async function AdminCategoriesPage() {
  const role = await requireStaff('admin');

  const categories = await listCategories(getDb());

  return (
    <main>
      <AdminNav role={role} />
      <ReferenceList
        title="Категории картин"
        items={categories}
        renameAction={renameCategoryAction}
        addAction={addCategory}
        addPlaceholder="Новая категория"
      />
    </main>
  );
}
