'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/drizzle';
import { activityLogs, sites, ActivityType } from '@/lib/db/schema';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { generateShareToken, generateSiteKey } from '@/lib/analytics/keys';
import { normalizeDomain } from '@/lib/analytics/normalize';
import { getOwnedSite, userHasDomain } from '@/lib/sites/queries';
import { isDemoAccount } from '@/lib/demo';

const createSiteSchema = z.object({
  name: z.string().min(1, 'Give the site a name').max(100),
  domain: z.string().min(1, 'Enter the domain you want to track').max(253)
});

export const createSite = validatedActionWithUser(
  createSiteSchema,
  async (data, _formData, user) => {
    // Normalised the same way the collector normalises an incoming Origin header, by calling the
    // same function. If these two ever diverged, every event would be rejected for a mismatch
    // that is invisible on screen.
    const domain = normalizeDomain(data.domain);

    if (!domain || !domain.includes('.')) {
      return {
        name: data.name,
        domain: data.domain,
        error: 'That does not look like a domain. Try something like example.com.'
      };
    }

    if (await userHasDomain(user.id, domain)) {
      return {
        name: data.name,
        domain: data.domain,
        error: `You already track ${domain}.`
      };
    }

    const [site] = await db
      .insert(sites)
      .values({
        userId: user.id,
        name: data.name.trim(),
        domain,
        siteKey: generateSiteKey()
      })
      .returning();

    await db.insert(activityLogs).values({
      userId: user.id,
      action: ActivityType.CREATE_SITE
    });

    redirect(`/dashboard/sites/${site.id}/install`);
  }
);

const shareSchema = z.object({
  siteId: z.coerce.number().int().positive()
});

export const enableSharing = validatedActionWithUser(
  shareSchema,
  async (data, _formData, user) => {
    const site = await getOwnedSite(data.siteId, user.id);
    if (!site) return { error: 'Site not found.' };

    // Always mint a fresh token, even if one already exists. Re-enabling after a revoke must not
    // resurrect the old URL — someone revoked it for a reason.
    const shareToken = generateShareToken();

    await db
      .update(sites)
      .set({ shareToken })
      .where(and(eq(sites.id, site.id), eq(sites.userId, user.id)));

    await db.insert(activityLogs).values({
      userId: user.id,
      action: ActivityType.ENABLE_SHARING
    });

    revalidatePath(`/dashboard/sites/${site.id}/install`);
    return { success: 'Share link published.' };
  }
);

export const disableSharing = validatedActionWithUser(
  shareSchema,
  async (data, _formData, user) => {
    const site = await getOwnedSite(data.siteId, user.id);
    if (!site) return { error: 'Site not found.' };

    // Cleared, not flagged. A token kept in the row behind an "enabled" boolean is a URL that
    // still exists — one schema change or one careless query away from working again. Setting it
    // to null destroys it, so a leaked link is dead permanently rather than merely ignored.
    await db
      .update(sites)
      .set({ shareToken: null })
      .where(and(eq(sites.id, site.id), eq(sites.userId, user.id)));

    await db.insert(activityLogs).values({
      userId: user.id,
      action: ActivityType.DISABLE_SHARING
    });

    revalidatePath(`/dashboard/sites/${site.id}/install`);
    return { success: 'Share link revoked. The old URL no longer works.' };
  }
);

const deleteSiteSchema = z.object({
  siteId: z.coerce.number().int().positive()
});

export const deleteSite = validatedActionWithUser(
  deleteSiteSchema,
  async (data, _formData, user) => {
    // getOwnedSite can never match the sample site — its user_id is null and null equals nothing
    // — so the unowned demo data is safe from every account without a special case here.
    const site = await getOwnedSite(data.siteId, user.id);

    if (!site) {
      // Deliberately the same answer whether the site does not exist or belongs to someone else.
      return { error: 'Site not found.' };
    }

    // The self-tracking site is what makes the deployed demo show real traffic. The demo
    // credentials are published, so without this any visitor could delete it for everyone.
    if (isDemoAccount(user.email)) {
      return {
        error:
          'The demo account cannot delete sites. Create your own account to manage sites.'
      };
    }

    // Events cascade from the foreign key.
    await db
      .delete(sites)
      .where(and(eq(sites.id, site.id), eq(sites.userId, user.id)));

    await db.insert(activityLogs).values({
      userId: user.id,
      action: ActivityType.DELETE_SITE
    });

    revalidatePath('/dashboard/sites');
    revalidatePath('/dashboard');

    return { success: `${site.domain} and its history were deleted.` };
  }
);
