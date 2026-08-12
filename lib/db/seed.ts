import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import { users, teams, teamMembers } from './schema';
import { hashPassword } from '@/lib/auth/session';
import { DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD } from '@/lib/demo';

/**
 * Seeds the demo account whose credentials are published on the sign-in page.
 *
 * Idempotent: re-running resets the demo account's password rather than failing on the unique
 * email constraint. That matters because the account is publicly usable — if a visitor manages
 * to change something, re-running the seed is the recovery path.
 *
 * The starter's version of this file imported `../payments/stripe` and created Stripe products.
 * That import alone made the seed unrunnable: lib/payments/stripe.ts constructs the Stripe client
 * at module scope from STRIPE_SECRET_KEY, which throws on an undefined key before a single row is
 * written. Stripe is being removed entirely (SPEC §2.1), so it goes now rather than later.
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

  let user = existing;

  if (user) {
    [user] = await db
      .update(users)
      .set({ passwordHash, name: DEMO_NAME, deletedAt: null, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    console.log(`Demo account reset: ${DEMO_EMAIL}`);
  } else {
    [user] = await db
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        name: DEMO_NAME,
        passwordHash,
        role: 'owner',
      })
      .returning();
    console.log(`Demo account created: ${DEMO_EMAIL}`);
  }

  // The starter scopes everything through a team, so the demo account needs one to look like any
  // other account until teams are removed in the whitelabel milestone (SPEC §2.2).
  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id))
    .limit(1);

  if (!membership) {
    const [team] = await db
      .insert(teams)
      .values({ name: 'Nova Analytics' })
      .returning();

    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: user.id,
      role: 'owner',
    });
    console.log('Team created for the demo account.');
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
