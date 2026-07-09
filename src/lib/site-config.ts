// Central place for the external links used across the funnel.
// Replace these placeholder URLs with your real destinations.
export const siteConfig = {
  brand: "Freedom Legacy Elevation Group",
  brandShort: "Freedom Legacy",
  // The eBook is bundled as an app asset — see src/routes/thank-you.tsx.
  ebookDownloadUrl: "/thank-you",
  // Scheduling link for the free 15-minute discovery call.
  discoveryCallUrl: "http://calendar.freedomlegacyelevationgroup.com",
  // Sign-up link for the free 7-day AI platform trial.
  aiTrialUrl: "https://agentmidas.xyz/lp/scale?ref=MID-DB3418",
  supportEmail: "hello@freedomlegacyelevationgroup.com",
  // Inbox that receives an alert whenever a new lead is captured.
  // Replace with the address where you want new-lead notifications delivered.
  leadNotificationEmail: "hello@freedomlegacyelevationframework.com",
};

export const PIPELINE_STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number]["value"];
