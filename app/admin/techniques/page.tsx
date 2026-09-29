import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { listTechniques } from '@/src/lib/catalog/techniques';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { ReferenceList } from '@/src/components/admin/reference-list';
import { addTechnique, renameTechniqueAction } from './actions';

export default async function AdminTechniquesPage() {
  const role = await requireStaff('admin');

  const techniques = await listTechniques(getDb());

  return (
    <main>
      <AdminNav role={role} />
      <ReferenceList
        title="Техники"
        items={techniques}
        renameAction={renameTechniqueAction}
        addAction={addTechnique}
        addPlaceholder="Новая техника"
      />
    </main>
  );
}
