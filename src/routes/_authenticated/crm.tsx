import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, getRouteApi } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import {
  Landmark,
  LogOut,
  Search,
  Users,
  Sparkles,
  Trophy,
  Mail,
  Phone,
  Loader2,
  Send,
  StickyNote,
  Info,
  RotateCcw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { PIPELINE_STAGES } from "@/lib/site-config";
import {
  getLeadNotifications,
  retryLeadNotification,
  retryLeadNotifications,
  type LeadNotification,
} from "@/lib/leads.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

const notifyFilterSchema = z.object({
  notify: fallback(z.string(), "all").default("all"),
});

export const Route = createFileRoute("/_authenticated/crm")({
  validateSearch: zodValidator(notifyFilterSchema),
  component: CrmPage,
});

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  source: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type Activity = {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  created_at: string;
};

const stageStyles: Record<string, string> = {
  new: "bg-primary/15 text-primary",
  contacted: "bg-chart-2/15 text-chart-2",
  qualified: "bg-chart-3/15 text-chart-3",
  won: "bg-emerald-500/15 text-emerald-600",
  lost: "bg-muted text-muted-foreground",
};

type NotifyState = { label: string; className: string };

function notifyState(status: string | undefined): NotifyState {
  switch (status) {
    case "sent":
      return { label: "Sent", className: "bg-emerald-500/15 text-emerald-600" };
    case "pending":
      return { label: "Queued", className: "bg-chart-2/15 text-chart-2" };
    case "failed":
    case "dlq":
      return { label: "Failed", className: "bg-destructive/15 text-destructive" };
    case "suppressed":
      return { label: "Suppressed", className: "bg-muted text-muted-foreground" };
    default:
      return { label: "—", className: "bg-muted text-muted-foreground" };
  }
}

function CrmPage() {
  const navigate = useNavigate({ from: "/_authenticated/crm" });
  const { notify } = Route.useSearch();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRetryConfirmOpen, setBulkRetryConfirmOpen] = useState(false);
  const [alertDetail, setAlertDetail] = useState<
    { lead: Lead; notification: LeadNotification } | null
  >(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const fetchNotifications = useServerFn(getLeadNotifications);
  const { data: notifications = [] } = useQuery({
    queryKey: ["lead-notifications"],
    queryFn: () => fetchNotifications(),
  });

  const notifyByLead = useMemo(() => {
    const map = new Map<string, LeadNotification>();
    // notifications come newest-first; keep the first (latest) per lead.
    for (const n of notifications) {
      if (n.lead_id && !map.has(n.lead_id)) map.set(n.lead_id, n);
    }
    return map;
  }, [notifications]);

  const stats = useMemo(() => {
    const total = leads.length;
    const won = leads.filter((l) => l.status === "won").length;
    const newLeads = leads.filter((l) => l.status === "new").length;
    return { total, won, newLeads };
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchesStage = stageFilter === "all" || l.status === stageFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q);
      const status = notifyByLead.get(l.id)?.status;
      const matchesNotify =
        notify === "all" ||
        (notify === "none" && !status) ||
        (notify === "queued" && status === "pending") ||
        (notify === "sent" && status === "sent") ||
        (notify === "failed" && (status === "failed" || status === "dlq")) ||
        (notify === "suppressed" && status === "suppressed");
      return matchesStage && matchesSearch && matchesNotify;
    });
  }, [leads, search, stageFilter, notify, notifyByLead]);

  // A lead can be re-queued when its latest alert failed, hit the DLQ, or was
  // suppressed.
  const isRetryable = (leadId: string) => {
    const s = notifyByLead.get(leadId)?.status;
    return s === "failed" || s === "dlq" || s === "suppressed";
  };

  const retryableFiltered = useMemo(
    () => filtered.filter((l) => isRetryable(l.id)),
    [filtered, notifyByLead],
  );

  // Keep the selection in sync with what's actually retryable and visible.
  const visibleSelectedIds = useMemo(
    () => retryableFiltered.filter((l) => selectedIds.has(l.id)).map((l) => l.id),
    [retryableFiltered, selectedIds],
  );

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedIds((prev) => {
      const allSelected =
        retryableFiltered.length > 0 &&
        retryableFiltered.every((l) => prev.has(l.id));
      if (allSelected) return new Set();
      return new Set(retryableFiltered.map((l) => l.id));
    });

  const clearSelection = () => setSelectedIds(new Set());

  const fetchBulkRetry = useServerFn(retryLeadNotifications);
  const bulkRetry = useMutation({
    mutationFn: (leadIds: string[]) => fetchBulkRetry({ data: { leadIds } }),
    onSuccess: (r) => {
      const parts: string[] = [];
      if (r.requeued) parts.push(`${r.requeued} re-queued`);
      if (r.suppressed) parts.push(`${r.suppressed} suppressed`);
      if (r.failed) parts.push(`${r.failed} failed`);
      if (r.requeued > 0) {
        toast.success(parts.join(" · ") || "Done");
      } else {
        toast.error(parts.join(" · ") || "Nothing was re-queued");
      }
      qc.invalidateQueries({ queryKey: ["lead-notifications"] });
      clearSelection();
    },
    onError: () => toast.error("Could not re-queue notifications"),
  });



  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
    onError: () => toast.error("Could not update stage"),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-gold text-gold-foreground">
              <Landmark className="size-4" />
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.14em]">
              Freedom Legacy CRM
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-navy-foreground hover:bg-white/10 hover:text-navy-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        <h1 className="text-2xl">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Everyone who opts in through your landing &amp; sales pages lands here.
        </p>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard icon={Users} label="Total leads" value={stats.total} />
          <StatCard icon={Sparkles} label="New (unworked)" value={stats.newLeads} />
          <StatCard icon={Trophy} label="Won" value={stats.won} />
        </div>

        {/* Controls */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {PIPELINE_STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={notify}
            onValueChange={(v) =>
              navigate({
                search: (prev: { notify: string }) => ({ ...prev, notify: v }),
              })
            }
          >
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any alert status</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="suppressed">Suppressed</SelectItem>
              <SelectItem value="none">No alert</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk action bar */}
        {visibleSelectedIds.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
            <span className="text-sm">
              <span className="font-medium">{visibleSelectedIds.length}</span>{" "}
              selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setBulkRetryConfirmOpen(true)}
                disabled={bulkRetry.isPending}
              >
                {bulkRetry.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Retry {visibleSelectedIds.length} failed
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all retryable leads"
                    disabled={retryableFiltered.length === 0}
                    checked={
                      retryableFiltered.length > 0 &&
                      retryableFiltered.every((l) => selectedIds.has(l.id))
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden sm:table-cell">Source</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Alert</TableHead>
                <TableHead className="hidden lg:table-cell">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No leads yet. Share your landing page to start collecting them.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(lead)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isRetryable(lead.id) ? (
                        <Checkbox
                          aria-label={`Select ${lead.name}`}
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleSelected(lead.id)}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {lead.email}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {lead.source.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={lead.status}
                        onValueChange={(status) => updateStatus.mutate({ id: lead.id, status })}
                      >
                        <SelectTrigger className="h-8 w-32 border-0 bg-transparent px-0 shadow-none focus:ring-0">
                          <Badge
                            variant="secondary"
                            className={`${stageStyles[lead.status] ?? ""} capitalize`}
                          >
                            {lead.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {PIPELINE_STAGES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const n = notifyByLead.get(lead.id);
                        const s = notifyState(n?.status);
                        const hasError =
                          !!n &&
                          (n.status === "failed" ||
                            n.status === "dlq" ||
                            n.status === "suppressed");
                        const badge = (
                          <Badge variant="secondary" className={s.className}>
                            {s.label}
                          </Badge>
                        );
                        if (!hasError) return badge;
                        return (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() =>
                              setAlertDetail({ lead, notification: n })
                            }
                          >
                            {badge}
                            <Info className="size-3.5 text-muted-foreground" />
                          </button>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      <AlertDialog open={bulkRetryConfirmOpen} onOpenChange={setBulkRetryConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-queue {visibleSelectedIds.length} notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a new new-lead alert for each selected lead. Suppressed
              addresses will still be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkRetryConfirmOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkRetry.mutate(visibleSelectedIds);
                setBulkRetryConfirmOpen(false);
              }}
              disabled={bulkRetry.isPending}
            >
              {bulkRetry.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Retry {visibleSelectedIds.length} failed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selected && (
        <LeadDrawer lead={selected} onClose={() => setSelected(null)} />
      )}

      {alertDetail && (
        <AlertDetailDialog
          lead={alertDetail.lead}
          notification={alertDetail.notification}
          onClose={() => setAlertDetail(null)}
        />
      )}
    </div>
  );
}

function AlertDetailDialog({
  lead,
  notification,
  onClose,
}: {
  lead: Lead;
  notification: LeadNotification;
  onClose: () => void;
}) {
  const s = notifyState(notification.status);
  const qc = useQueryClient();
  const canRetry =
    notification.status === "failed" || notification.status === "dlq";
  const retryFn = useServerFn(retryLeadNotification);
  const retry = useMutation({
    mutationFn: () => retryFn({ data: { leadId: lead.id } }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Notification re-queued");
        qc.invalidateQueries({ queryKey: ["lead-notifications"] });
        onClose();
      } else {
        toast.error(
          result.reason === "email_suppressed"
            ? "Recipient is on the suppression list — can't re-send"
            : "Could not re-queue the notification",
        );
      }
    },
    onError: () => toast.error("Could not re-queue the notification"),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            Notification details
            <Badge variant="secondary" className={s.className}>
              {s.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Lead</p>
            <p className="font-medium">{lead.name}</p>
            <p className="text-muted-foreground">
              {notification.lead_email ?? lead.email}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Last attempt
            </p>
            <p>
              {formatDistanceToNow(new Date(notification.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>
          {(() => {
            const detail = notification.error_detail;
            const message = detail?.message ?? notification.error_message ?? null;
            const rows: Array<{ label: string; value: string }> = [];
            if (detail?.code != null)
              rows.push({ label: "Code", value: String(detail.code) });
            if (detail?.status != null)
              rows.push({ label: "HTTP status", value: String(detail.status) });
            if (detail?.retry_after_seconds != null)
              rows.push({
                label: "Retry after",
                value: `${detail.retry_after_seconds}s`,
              });
            const body = detail?.body ?? detail?.response ?? null;
            const hasAny = message || rows.length > 0 || body;
            return (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Error details
                </p>
                {!hasAny ? (
                  <p className="mt-1 text-muted-foreground">
                    {notification.status === "suppressed"
                      ? "This address is on the suppression list (previous bounce or complaint), so the alert was not sent."
                      : "No error message was recorded for this attempt."}
                  </p>
                ) : (
                  <div className="mt-1 space-y-3">
                    {message && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Message
                        </p>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-xs text-foreground">
                          {message}
                        </pre>
                      </div>
                    )}
                    {rows.length > 0 && (
                      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-xs">
                        {rows.map((r) => (
                          <div key={r.label} className="contents">
                            <dt className="text-muted-foreground">{r.label}</dt>
                            <dd className="font-mono">{r.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {body && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Response body
                        </p>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-xs text-foreground">
                          {body}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        {canRetry && (
          <div className="mt-2 flex justify-end border-t pt-4">
            <Button onClick={() => retry.mutate()} disabled={retry.isPending}>
              {retry.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Retry failed
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-2 font-serif text-3xl">{value}</p>
    </div>
  );
}

function LeadDrawer({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(lead.notes ?? "");

  const { data: activities = [] } = useQuery({
    queryKey: ["activities", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Activity[];
    },
  });

  const saveNotes = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").update({ notes }).eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notes saved");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Could not save notes"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="border-b p-5">
          <DialogTitle className="text-xl">{lead.name}</DialogTitle>
          <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground">
            <a href={`mailto:${lead.email}`} className="flex items-center gap-2 hover:text-foreground">
              <Mail className="size-3.5" /> {lead.email}
            </a>
            {lead.phone && (
              <span className="flex items-center gap-2">
                <Phone className="size-3.5" /> {lead.phone}
              </span>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="email" className="px-5 pb-5">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="activity">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="mt-4">
            <EmailComposer lead={lead} />
          </TabsContent>

          <TabsContent value="notes" className="mt-4 space-y-3">
            <Label htmlFor="lead-notes">Internal notes</Label>
            <Textarea
              id="lead-notes"
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add context about this lead…"
            />
            <Button onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>
              <StickyNote className="size-4" /> Save notes
            </Button>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <ScrollArea className="h-64 pr-3">
              {activities.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ul className="space-y-4">
                  {activities.map((a) => (
                    <li key={a.id} className="border-l-2 border-primary/40 pl-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-primary">
                        {a.type}
                      </p>
                      {a.subject && <p className="text-sm font-medium">{a.subject}</p>}
                      {a.body && (
                        <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">{a.body}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function EmailComposer({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Add a subject and message");
      return;
    }
    setSending(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("lead_activities").insert({
      lead_id: lead.id,
      user_id: user?.id,
      type: "email",
      subject,
      body,
    });

    if (!error) {
      await supabase.from("leads").update({ status: "contacted" }).eq("id", lead.id).eq("status", "new");
    }
    setSending(false);

    if (error) {
      toast.error("Could not record the email");
      return;
    }
    toast.success("Email logged to the lead's timeline");
    setSubject("");
    setBody("");
    qc.invalidateQueries({ queryKey: ["activities", lead.id] });
    qc.invalidateQueries({ queryKey: ["leads"] });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        To: <span className="font-medium text-foreground">{lead.email}</span>
      </div>
      <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <Textarea
        rows={6}
        placeholder="Write your message…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button onClick={send} disabled={sending} className="w-full">
        {sending ? <Loader2 className="size-4 animate-spin" /> : (<><Send className="size-4" /> Send email</>)}
      </Button>
    </div>
  );
}
