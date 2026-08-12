import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import { users } from './schema';
import { hashPassword } from '@/lib/auth/session';
import { DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD } from '@/lib/demo';

/**
 * Seeds the demo account whose credentials are published on the sign-in page.
 *
 * Idempotent: re-running resets the demo account's password rather than failing on the unique
 * email constraint. That matters because the account is publicly usable — if a visitor manages
 * to change something, re-running the seed is the recovery path.
 *
 * The sample site and the self-tracking site are not seeded here yet — `sites` does not exist
 * until the ingestion milestone. They arrive with it.
 */
async function seed() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, name: DEMO_NAME, deletedAt: null, updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    console.log(`Demo account reset: ${DEMO_EMAIL}`);
    return;
  }

  await db.insert(users).values({
    email: DEMO_EMAIL,
    name: DEMO_NAME,
    passwordHash,
    role: 'owner',
  });
  console.log(`Demo account created: ${DEMO_EMAIL}`);
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
