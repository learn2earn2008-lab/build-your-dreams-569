import { test, expect } from "@playwright/test";

/**
 * Verifies the "Start Free Trial" button on /thank-you points at the correct
 * external free-trial URL. The page is a public, unauthenticated route, so the
 * test needs no backend, session, or network stubs.
 *
 * The same assertion holds for local dev builds and the deployed site because
 * the URL is a compile-time constant from src/lib/site-config.ts. To run the
 * check against a deployed environment, point the base URL at it:
 *   BASE_URL=https://build-your-dreams-569.lovable.app npm run test:e2e
 */

const FREE_TRIAL_URL = "https://agentmidas.xyz/lp/scale?ref=MID-DB3418";

test("Start Free Trial button links to the free trial URL", async ({ page }) => {
  await page.goto(process.env.BASE_URL ? `${process.env.BASE_URL}/thank-you` : "/thank-you");

  const trialLink = page.getByRole("link", { name: /start free trial/i });
  await expect(trialLink).toBeVisible();

  // The button opens the external trial page in a new tab.
  await expect(trialLink).toHaveAttribute("href", FREE_TRIAL_URL);
  await expect(trialLink).toHaveAttribute("target", "_blank");
});
