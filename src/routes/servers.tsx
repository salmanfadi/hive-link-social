import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/servers")({
  component: ServersPage,
  head: () => ({ meta: [{ title: "Communities — Decentra" }] }),
});

type Server = { id: string; name: string; slug: string; description: string | null; admin_id: string };

function ServersPage() {
  const { user } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("servers").select("*").order("created_at", { ascending: false });
    setServers((data as Server[]) ?? []);
    const { data: mem } = await supabase.from("server_members").select("server_id").eq("user_id", user.id);
    setMemberIds(new Set(((mem as any) ?? []).map((m: any) => m.server_id)));
  };

  useEffect(() => { load(); }, [user]);

  if (!user) {
    if (typeof window !== "undefined") window.location.replace("/login.html");
    return null;
  }

  const create = async () => {
    if (!name.trim() || !slug.trim()) { toast.error("Name and slug required"); return; }
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const { data, error } = await supabase.from("servers").insert({
      name: name.trim(), slug: cleanSlug, description: description.trim() || null,
      rules: rules.trim() || null, admin_id: user.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("server_members").insert({ server_id: data.id, user_id: user.id });
    toast.success("Community created");
    setOpen(false); setName(""); setSlug(""); setDescription(""); setRules("");
    load();
  };

  const toggleMembership = async (s: Server) => {
    if (memberIds.has(s.id)) {
      await supabase.from("server_members").delete().eq("server_id", s.id).eq("user_id", user.id);
    } else {
      await supabase.from("server_members").insert({ server_id: s.id, user_id: user.id });
    }
    load();
  };

  return (
    <Layout>
      <header className="sticky top-0 bg-background/80 backdrop-blur border-b border-border z-10 px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Communities</h1>
          <p className="text-xs text-muted-foreground">Federated servers — pick your tribes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button style={{ backgroundImage: "var(--gradient-primary)" }} className="shadow-md">
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create community</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Slug (URL)</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="design" /></div>
              <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div><Label>Rules</Label><Textarea value={rules} onChange={(e) => setRules(e.target.value)} placeholder="Be kind. No spam." /></div>
              <Button onClick={create} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="p-5 grid sm:grid-cols-2 gap-4">
        {servers.map((s) => (
          <Card key={s.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <Link to="/s/$slug" params={{ slug: s.slug }} className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundImage: "var(--gradient-primary)" }}>
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="text-xs text-muted-foreground">/{s.slug}</p>
                  </div>
                </div>
                {s.description && <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
              </Link>
              <Button size="sm" variant={memberIds.has(s.id) ? "outline" : "default"} onClick={() => toggleMembership(s)}>
                {memberIds.has(s.id) ? "Leave" : "Join"}
              </Button>
            </div>
          </Card>
        ))}
        {servers.length === 0 && (
          <p className="text-muted-foreground col-span-2 text-center py-12">No communities yet. Create the first one!</p>
        )}
      </div>
    </Layout>
  );
}
