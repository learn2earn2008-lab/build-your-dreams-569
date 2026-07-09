import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { PIPELINE_STAGES } from "@/lib/site-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/_authenticated/crm")({
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

function CrmPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Lead | null>(null);

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
      return matchesStage && matchesSearch;
    });
  }, [leads, search, stageFilter]);

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
            <SelectTrigger className="sm:w-48">
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
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden sm:table-cell">Source</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="hidden lg:table-cell">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
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

      {selected && (
        <LeadDrawer lead={selected} onClose={() => setSelected(null)} />
      )}
    </div>
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
