import { test, expect, type Page, type Route } from "@playwright/test";
import { toCrossJSONAsync } from "seroval";

/**
 * End-to-end coverage for the /crm "Checking delivery status…" banner.
 *
 * These tests stub every network boundary the CRM page touches, so they run
 * without a real backend, credentials, or seeded data and stay deterministic:
 *   - Supabase auth  (`/auth/v1/*`)              -> a fake signed-in session
 *   - Supabase REST  (`/rest/v1/*`)              -> the retryable lead list
 *   - Server fns     (`/_serverFn/*` | `/ln/*`)  -> GET notifications, POST retry
 *
 * The banner is shown while any retried lead is still "settling" and clears
 * only when every retried lead reaches a terminal status (sent / suppressed /
 * failed-after-retry) or the 30-second hard deadline elapses.
 */

// Supabase derives its localStorage auth key from the project ref (the first
// label of the project URL host): sb-<ref>-auth-token.
const SUPABASE_REF = "qgooptqlfjumspfsvxvt";
const STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`;

const BANNER_TEXT = "Checking delivery status";

type LeadSpec = { id: string; name: string; email: string };

/**
 * Resolves the alert status a lead should report on a given notification poll.
 * `retried` flips to true once a retry POST has been submitted; `poll` counts
 * the notification GETs that happened after that retry (1-based).
 */
type StatusResolver = (
  lead: LeadSpec,
  ctx: { retried: boolean; poll: number },
) => string;

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

function leadRow(lead: LeadSpec) {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: null,
    source: "test",
    status: "new",
    notes: null,
    created_at: new Date().toISOString(),
  };
}

function notification(lead: LeadSpec, status: string) {
  return {
    message_id: `msg-${lead.id}`,
    status,
    error_message: null,
    error_detail: null,
    created_at: new Date().toISOString(),
    lead_id: lead.id,
    lead_email: lead.email,
  };
}

/**
 * Wires up all network stubs and injects a signed-in session.
 * Before any retry every lead reports "failed" (so it is retryable and its
 * checkbox is available); afterwards `status` drives each lead's alert status
 * per poll, which is what lets a test settle leads independently.
 */
async function installMocks(
  page: Page,
  leads: LeadSpec[],
  status: StatusResolver,
) {
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
      return json(route, leads.map(leadRow));
    }
    return json(route, []);
  });

  // TanStack server functions: `/ln/*` in production builds, `/_serverFn/*`
  // under the Vite dev server. GET -> getLeadNotifications, POST -> retry.
  // Tracks which leads have actually been re-queued. The retry POST body
  // carries the selected lead ids, so we can settle only the selected subset
  // and leave un-selected leads untouched — exactly what the CRM does.
  const retriedIds = new Set<string>();
  let poll = 0;
  const serverFn = (route: Route) => {
    if (route.request().method() === "POST") {
      // The server-fn POST body embeds the selected lead ids (regardless of
      // encoding), so match known ids against the raw payload.
      const raw = route.request().postData() ?? "";
      for (const lead of leads) if (raw.includes(lead.id)) retriedIds.add(lead.id);
      return serverFnJson(route, {
        requeued: retriedIds.size,
        suppressed: 0,
        failed: 0,
        notFound: 0,
      });
    }
    if (retriedIds.size > 0) poll += 1;
    const rows = leads.map((lead) => {
      const retried = retriedIds.has(lead.id);
      // Before any retry every lead is "failed" (retryable + selectable). After
      // a retry the resolver drives status; `retried` tells it whether THIS
      // lead was part of the selected set.
      const s = retriedIds.size > 0 ? status(lead, { retried, poll }) : "failed";
      return notification(lead, s);
    });
    return serverFnJson(route, rows);
  };

  await page.route("**/_serverFn/**", serverFn);
  await page.route("**/ln/**", serverFn);
}

/**
 * Selects every retryable lead and confirms the bulk retry dialog.
 * `count` is the expected number of retryable leads (used in the button label).
 */
async function retryAllLeads(page: Page, leads: LeadSpec[]) {
  await page.goto("/crm?notify=all");

  // Wait until the first lead is retryable (its checkbox exists), proving both
  // the leads list and the "failed" notifications have loaded.
  await page.getByLabel(`Select ${leads[0].name}`).waitFor({ timeout: 15_000 });

  await page.getByLabel("Select all retryable leads").click();

  const label = `Retry ${leads.length} failed`;
  await page.getByRole("button", { name: label }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: label }).click();
}

const ONE_LEAD: LeadSpec[] = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Ada Retryable", email: "ada@example.com" },
];

const THREE_LEADS: LeadSpec[] = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Ada Retryable", email: "ada@example.com" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Bea Retryable", email: "bea@example.com" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Cyd Retryable", email: "cyd@example.com" },
];

test("banner appears after Retry and clears once the lead settles", async ({
  page,
}) => {
  // "pending" for the first couple of polls (banner stays up), then "sent".
  await installMocks(page, ONE_LEAD, (_lead, { poll }) =>
    poll <= 2 ? "pending" : "sent",
  );

  await retryAllLeads(page, ONE_LEAD);

  const banner = page.getByText(BANNER_TEXT, { exact: false });
  await expect(banner).toBeVisible();
  await expect(banner).toBeHidden({ timeout: 15_000 });
});

test("banner clears after 30 seconds when the lead never settles", async ({
  page,
}) => {
  // Always "pending": only the 30-second hard deadline can stop polling.
  await installMocks(page, ONE_LEAD, () => "pending");

  await retryAllLeads(page, ONE_LEAD);

  const banner = page.getByText(BANNER_TEXT, { exact: false });
  await expect(banner).toBeVisible();

  await page.waitForTimeout(10_000);
  await expect(banner).toBeVisible();

  await expect(banner).toBeHidden({ timeout: 25_000 });
});

test("multi-lead: banner clears only once ALL retried leads settle", async ({
  page,
}) => {
  const [ada, bea, cyd] = THREE_LEADS;

  // Ada and Bea settle to "sent" early (poll >= 2 ≈ 2.5s); Cyd stays "pending"
  // until poll >= 5 (≈ 10s). While Cyd is still pending the banner must stay up
  // even though the other two have already settled.
  await installMocks(page, THREE_LEADS, (lead, { poll }) => {
    if (lead.id === cyd.id) return poll >= 5 ? "sent" : "pending";
    return poll >= 2 ? "sent" : "pending"; // ada & bea
  });

  await retryAllLeads(page, THREE_LEADS);

  const banner = page.getByText(BANNER_TEXT, { exact: false });
  await expect(banner).toBeVisible();

  // Ada and Bea have settled by now, but Cyd is still in flight: partial
  // settling must NOT clear the banner.
  await page.waitForTimeout(6_000);
  await expect(banner).toBeVisible();

  // Once Cyd finally settles too, the banner clears.
  await expect(banner).toBeHidden({ timeout: 15_000 });
});

test("multi-lead: banner clears at 30s when one retried lead never settles", async ({
  page,
}) => {
  const [ada, bea, cyd] = THREE_LEADS;

  // Ada and Bea settle quickly; Cyd never reaches a terminal status, so only
  // the 30-second deadline can end the polling window.
  await installMocks(page, THREE_LEADS, (lead, { poll }) => {
    if (lead.id === cyd.id) return "pending";
    return poll >= 2 ? "sent" : "pending"; // ada & bea
  });

  await retryAllLeads(page, THREE_LEADS);

  const banner = page.getByText(BANNER_TEXT, { exact: false });
  await expect(banner).toBeVisible();

  // Two of three settled, one still pending — the banner must remain.
  await page.waitForTimeout(12_000);
  await expect(banner).toBeVisible();

  // The 30-second hard deadline eventually clears it regardless.
  await expect(banner).toBeHidden({ timeout: 25_000 });
});
