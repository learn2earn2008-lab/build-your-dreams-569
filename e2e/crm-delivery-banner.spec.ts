import { test, expect, type Page, type Route } from "@playwright/test";
import { toCrossJSONAsync } from "seroval";

/**
 * End-to-end coverage for the /crm "Checking delivery status…" banner.
 *
 * These tests stub every network boundary the CRM page touches, so they run
 * without a real backend, credentials, or seeded data and stay deterministic:
 *   - Supabase auth  (`/auth/v1/*`)   -> a fake signed-in session
 *   - Supabase REST  (`/rest/v1/*`)   -> a single retryable lead
 *   - Server fns     (`/ln/*`)        -> GET = notifications, POST = retry
 *
 * TanStack server functions that return a plain `application/json` body (no
 * `x-tss-serialized` header) are handed back to the caller verbatim, which is
 * why these simple JSON stubs are enough.
 */

// Supabase derives its localStorage auth key from the project ref (the first
// label of the project URL host): sb-<ref>-auth-token.
const SUPABASE_REF = "qgooptqlfjumspfsvxvt";
const STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`;

const LEAD_ID = "11111111-1111-1111-1111-111111111111";
const LEAD_NAME = "Ada Retryable";
const LEAD_EMAIL = "ada@example.com";

const BANNER_TEXT = "Checking delivery status";

function fakeSession() {
  const nowSec = Math.floor(Date.now() / 1000);
  const user = {
    id: "00000000-0000-0000-0000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "team@example.com",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  return {
    access_token: "test-access-token",
    token_type: "bearer",
    expires_in: 3600,
    // Far in the future so the client never tries to refresh the token.
    expires_at: nowSec + 3600,
    refresh_token: "test-refresh-token",
    user,
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/**
 * Fulfills a TanStack server-function call. The Start client deserializes
 * server-fn responses with seroval (only when `x-tss-serialized` is set) and
 * returns the `result` field of the middleware envelope, so the body must be a
 * seroval cross-JSON `{ result, context }` object — not raw JSON.
 */
async function serverFnJson(route: Route, data: unknown) {
  const body = JSON.stringify(
    await toCrossJSONAsync({ result: data, context: {} }, {}),
  );
  return route.fulfill({
    status: 200,
    headers: {
      "content-type": "application/json",
      "x-tss-serialized": "true",
    },
    body,
  });
}



function leadRow() {
  return {
    id: LEAD_ID,
    name: LEAD_NAME,
    email: LEAD_EMAIL,
    phone: null,
    source: "test",
    status: "new",
    notes: null,
    created_at: new Date().toISOString(),
  };
}

function notification(status: string) {
  return [
    {
      message_id: `msg-${LEAD_ID}`,
      status,
      error_message: null,
      error_detail: null,
      created_at: new Date().toISOString(),
      lead_id: LEAD_ID,
      lead_email: LEAD_EMAIL,
    },
  ];
}

/**
 * Wires up all network stubs and injects a signed-in session.
 * `statusAfterRetry` decides what alert status the polling endpoint reports
 * once a retry has been submitted (before that it always reports "failed", so
 * the lead is retryable and its checkbox is available).
 */
async function installMocks(page: Page, statusAfterRetry: () => string) {
  const session = fakeSession();

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [STORAGE_KEY, JSON.stringify(session)] as const,
  );

  // Supabase auth: getUser() and any token refresh (plain PostgREST/GoTrue JSON).
  await page.route("**/auth/v1/**", (route) =>
    json(route, route.request().url().includes("/user") ? session.user : session),
  );

  // Supabase REST: the leads list; empty for anything else.
  await page.route("**/rest/v1/**", (route) => {
    if (route.request().url().includes("/rest/v1/leads")) {
      return json(route, [leadRow()]);
    }
    return json(route, []);
  });

  // TanStack server functions: `/ln/*` in production builds, `/_serverFn/*`
  // under the Vite dev server. GET -> getLeadNotifications, POST -> retry.
  // Their responses must be seroval-encoded and flagged `x-tss-serialized`
  // so the Start client deserializes them like a real server-fn response.
  let retried = false;
  const serverFn = (route: Route) => {
    if (route.request().method() === "POST") {
      retried = true;
      return serverFnJson(route, {
        requeued: 1,
        suppressed: 0,
        failed: 0,
        notFound: 0,
      });
    }
    return serverFnJson(route, notification(retried ? statusAfterRetry() : "failed"));
  };
  await page.route("**/_serverFn/**", serverFn);
  await page.route("**/ln/**", serverFn);
}

async function retrySelectedLead(page: Page) {
  await page.goto("/crm?notify=all");

  // Lead is retryable (alert = failed) so its selection checkbox is present.
  const checkbox = page.getByLabel(`Select ${LEAD_NAME}`);
  await checkbox.waitFor({ timeout: 15_000 });
  await checkbox.click();

  // Open the confirm dialog from the bulk action bar, then confirm.
  await page.getByRole("button", { name: "Retry 1 failed" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Retry 1 failed" })
    .click();
}

test("banner appears after Retry and clears once the lead settles", async ({
  page,
}) => {
  // Report "pending" for the first couple of polls (banner stays up), then
  // "sent" so the lead reaches a final status and the banner clears.
  let polls = 0;
  await installMocks(page, () => (++polls <= 2 ? "pending" : "sent"));

  await retrySelectedLead(page);

  const banner = page.getByText(BANNER_TEXT, { exact: false });
  await expect(banner).toBeVisible();
  // Once the lead settles to "sent", polling stops and the banner disappears.
  await expect(banner).toBeHidden({ timeout: 15_000 });
});

test("banner clears after 30 seconds when the lead never settles", async ({
  page,
}) => {
  // Always "pending": the lead never reaches a final status, so only the
  // 30-second hard deadline can stop the polling window.
  await installMocks(page, () => "pending");

  await retrySelectedLead(page);

  const banner = page.getByText(BANNER_TEXT, { exact: false });
  await expect(banner).toBeVisible();

  // It must NOT clear early while the lead is still pending.
  await page.waitForTimeout(10_000);
  await expect(banner).toBeVisible();

  // The hard 30s deadline eventually clears it even without a final status.
  await expect(banner).toBeHidden({ timeout: 25_000 });
});
