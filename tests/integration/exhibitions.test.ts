// tests/integration/exhibitions.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { like } from 'drizzle-orm';
import { getDb } from '../../src/db';
import { exhibitions } from '../../src/db/schema';
import { listReferencedImageUrls } from '../../src/lib/uploads/references';

const PREFIX = 'test-ex-';

describe('exhibitions schema', () => {
  afterAll(async () => {
    await getDb().delete(exhibitions).where(like(exhibitions.slug, `${PREFIX}%`));
  });

  it('keeps exhibition covers among the referenced images', async () => {
    const cover = `https://example.com/${PREFIX}cover-${Date.now()}.jpg`;
    await getDb().insert(exhibitions).values({
      slug: `${PREFIX}refs`,
      title: 'Тест',
      coverUrl: cover,
      startsOn: '2090-01-01',
      endsOn: '2090-01-31',
    });
    expect(await listReferencedImageUrls(getDb())).toContain(cover);
  });
});
