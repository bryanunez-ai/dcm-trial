import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import { users } from './schema';
import { hashPassword } from '@/lib/auth/session';
import { DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD } from '@/lib/demo';
import { seedSampleSite } from './seed-sample';
import { seedSelfTrackingSite } from './seed-self-tracking';

/**
 * Seeds the demo account whose credentials are published on the sign-in page, and the sample
 * site every account can read.
 *
 * Idempotent: re-running resets the demo account's password rather than failing on the unique
 * email constraint, and regenerates the sample history so its window still ends today. That
 * matters because the account is publicly usable — if a visitor manages to change something,
 * re-running the seed is the recovery path.
 *
 * `pnpm db:seed-analysis` is deliberately NOT part of this. It spends real money on a real API
 * call, and a seed script that silently bills you is a bad seed script.
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
  } else {
    await db.insert(users).values({
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      passwordHash,
      role: 'owner',
    });
    console.log(`Demo account created: ${DEMO_EMAIL}`);
  }

  const sample = await seedSampleSite();
  console.log(
    `Sample site seeded: ${sample.events} events across 90 days (site ${sample.siteId}).`
  );

  const self = await seedSelfTrackingSite();
  if (self.skipped) {
    console.log(`Self-tracking site skipped: ${self.reason}`);
  } else {
    console.log(
      `Self-tracking site ${self.created ? 'created' : 'already present'}: ${self.domain} (site ${self.siteId}).`
    );
  }
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
