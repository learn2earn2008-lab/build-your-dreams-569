// Central place for the external links used across the funnel.
// Replace these placeholder URLs with your real destinations.
export const siteConfig = {
  brand: "Freedom Legacy Elevation Group",
  brandShort: "Freedom Legacy",
  // Direct download link to your eBook PDF (e.g. a public storage / Google Drive link).
  ebookDownloadUrl: "#",
  // Your scheduling link for the free 30-minute discovery call (e.g. Calendly).
  discoveryCallUrl: "https://calendly.com/",
  // Sign-up link for the free 7-day AI platform trial.
  aiTrialUrl: "#",
  supportEmail: "hello@freedomlegacyelevationgroup.com",
};

export const PIPELINE_STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number]["value"];
