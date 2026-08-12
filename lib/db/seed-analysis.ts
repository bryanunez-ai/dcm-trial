import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import { sites, users } from './schema';
import { runAnalysis, storeAnalysis } from '@/lib/ai/analyze';
import { DEMO_EMAIL } from '@/lib/demo';

/**
 * Generates ONE real analysis and stores it.
 *
 * Deliberately not part of `pnpm db:seed`. This makes a live API call and spends real money, and a
 * seed script that silently bills you is a bad seed script — especially one a contributor might
 * run repeatedly while setting the project up.
 *
 * Its output is what the shared demo account shows on the Insights page. Reviewers therefore read
 * a genuine report, of real traffic on real pages, while being unable to spend anything
 * themselves — the demo account is barred from generating.
 *
 * Usage: pnpm db:seed-analysis <domain>
 */
async function main() {
  const domain = process.argv[2];

  if (!domain) {
    console.error(
      'Usage: pnpm db:seed-analysis <domain>\n' +
        'The domain must belong to a site that already exists and has traffic.'
    );
    process.exit(1);
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY is not set. Nothing to do.');
    process.exit(1);
  }

  const [site] = await db.select().from(sites).where(eq(sites.domain, domain)).limit(1);

  if (!site) {
    console.error(`No site registered for ${domain}.`);
    process.exit(1);
  }

  if (site.isSample) {
    console.error(
      'Refusing to analyse the sample site: its domain does not resolve, so this would spend money to produce nothing.'
    );
    process.exit(1);
  }

  const [demo] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  console.log(`Analysing ${site.domain}. This makes one real API call.`);

  const result = await runAnalysis(site);
  const row = await storeAnalysis(site.id, demo?.id ?? null, result);

  console.log(
    `Stored analysis ${row.id}: ${result.analysis.recommendations.length} recommendations, ` +
      `${result.inputTokens} in / ${result.outputTokens} out, ` +
      `$${(result.costMicros / 1_000_000).toFixed(4)}.`
  );

  const unreadable = result.pages.filter((p) => !p.ok);
  if (unreadable.length > 0) {
    console.log(
      `Pages that could not be read: ${unreadable
        .map((p) => `${p.path} (${'reason' in p ? p.reason : 'unknown'})`)
        .join(', ')}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Analysis seeding failed:', error);
    process.exit(1);
  });
