'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { getOwnedSite } from '@/lib/sites/queries';
import { checkAnalysisAllowed } from '@/lib/ai/guards';
import { AdvisorError, runAnalysis, storeAnalysis } from '@/lib/ai/analyze';

const schema = z.object({
  siteId: z.coerce.number().int().positive(),
  force: z.coerce.boolean().optional()
});

export const generateAnalysis = validatedActionWithUser(
  schema,
  async (data, _formData, user) => {
    const site = await getOwnedSite(data.siteId, user.id);
    if (!site) return { error: 'Site not found.' };

    // Every cost control is re-checked here, on the server, immediately before spending. The UI
    // also renders the reason it cannot generate, but that is a courtesy — this is the control.
    const verdict = await checkAnalysisAllowed({
      user,
      site,
      force: Boolean(data.force)
    });

    if (!verdict.allowed) {
      return { error: verdict.message };
    }

    try {
      const result = await runAnalysis(site);
      await storeAnalysis(site.id, user.id, result);
    } catch (error) {
      if (error instanceof AdvisorError) {
        return { error: error.message };
      }
      console.error('Analysis failed:', error);
      return {
        error:
          'The analysis could not be completed. Nothing was stored and nothing was charged for a stored report.'
      };
    }

    revalidatePath(`/dashboard/sites/${site.id}/insights`);
    return { success: 'Analysis complete.' };
  }
);
