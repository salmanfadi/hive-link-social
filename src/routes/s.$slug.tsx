import { createFileRoute, Navigate, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Layout } from "@/components/Layout";
import { PostCard, type PostWithMeta } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Users, ArrowBigUp, ArrowBigDown, Shield, Settings, Ban } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/s/$slug")({
  component: ServerPage,
  head: ({ params }) => ({ meta: [{ title: `/${params.slug} — Decentra` }] }),
});

type Server = { id: string; name: string; slug: string; description: string | null; rules: string | null; admin_id: string };

function ServerPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const [server, setServer] = useState<Server | null>(null);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [votes, setVotes] = useState({ up: 0, down: 0, mine: 0 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: s } = await supabase.from("servers").select("*").eq("slug", slug).maybeSingle();
    if (!s) { setLoading(false); return; }
    setServer(s as Server);
    const [{ data: p }, { count }, { data: vAll }, { data: vMine }] = await Promise.all([
      supabase.from("posts").select("*, profiles!inner(username, display_name, avatar_url), servers(name, slug)").eq("server_id", s.id).order("created_at", { ascending: false }),
      supabase.from("server_members").select("*", { count: "exact", head: true }).eq("server_id", s.id),
      supabase.from("rule_votes").select("vote").eq("server_id", s.id),
      user ? supabase.from("rule_votes").select("vote").eq("server_id", s.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setPosts((p as any) ?? []);
    setMemberCount(count ?? 0);
    const up = ((vAll as any) ?? []).filter((v: any) => v.vote === 1).length;
    const down = ((vAll as any) ?? []).filter((v: any) => v.vote === -1).length;
    setVotes({ up, down, mine: (vMine as any)?.vote ?? 0 });
    if (user) {
      const { data: m } = await supabase.from("server_members").select("server_id").eq("server_id", s.id).eq("user_id", user.id).maybeSingle();
      setIsMember(!!m);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug, user]);

  if (!user) return <Navigate to="/auth" />;
  if (loading) return <Layout><div className="p-8 text-muted-foreground">Loading…</div></Layout>;
  if (!server) throw notFound();

  const toggleMembership = async () => {
    if (isMember) await supabase.from("server_members").delete().eq("server_id", server.id).eq("user_id", user.id);
    else await supabase.from("server_members").insert({ server_id: server.id, user_id: user.id });
    load();
  };

  const vote = async (v: 1 | -1) => {
    if (votes.mine === v) {
      await supabase.from("rule_votes").delete().eq("server_id", server.id).eq("user_id", user.id);
    } else if (votes.mine === 0) {
      await supabase.from("rule_votes").insert({ server_id: server.id, user_id: user.id, vote: v });
    } else {
      await supabase.from("rule_votes").update({ vote: v }).eq("server_id", server.id).eq("user_id", user.id);
    }
    load();
  };

  const isAdmin = user.id === server.admin_id;

  const removePost = async (postId: string) => {
    if (!confirm("Remove this post from your community? (It still exists on the wider network.)")) return;
    const { error } = await supabase.from("posts").update({ server_id: null }).eq("id", postId);
    if (error) toast.error(error.message);
    else { toast.success("Removed from community"); load(); }
  };

  return (
    <Layout>
      <header className="sticky top-0 bg-background/80 backdrop-blur border-b border-border z-10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundImage: "var(--gradient-primary)" }}>
            <Users className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              {server.name}
              {isAdmin && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full inline-flex items-center gap-1"><Shield className="h-3 w-3" />Admin</span>}
            </h1>
            <p className="text-xs text-muted-foreground">/{server.slug} · {memberCount} member{memberCount === 1 ? "" : "s"}</p>
          </div>
          {isAdmin && <ModerationDialog server={server} onChange={load} />}
          <Button variant={isMember ? "outline" : "default"} onClick={toggleMembership}>
            {isMember ? "Leave" : "Join"}
          </Button>
        </div>
        {server.description && <p className="text-sm mt-3">{server.description}</p>}
      </header>

      {server.rules && (
        <Card className="m-5 p-4">
          <h3 className="font-semibold mb-1">Community rules</h3>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{server.rules}</p>
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" variant={votes.mine === 1 ? "default" : "outline"} onClick={() => vote(1)}>
              <ArrowBigUp className="h-4 w-4" /> {votes.up}
            </Button>
            <Button size="sm" variant={votes.mine === -1 ? "default" : "outline"} onClick={() => vote(-1)}>
              <ArrowBigDown className="h-4 w-4" /> {votes.down}
            </Button>
            <span className="text-xs text-muted-foreground ml-2">Vote on these rules</span>
          </div>
        </Card>
      )}

      <div>
        {posts.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">No posts in this community yet.</p>
        ) : posts.map((p) => (
          <div key={p.id} className="relative">
            <PostCard post={p} onDelete={load} />
            {isAdmin && (
              <Button size="sm" variant="ghost" className="absolute top-4 right-14 text-xs" onClick={() => removePost(p.id)}>
                Remove from community
              </Button>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}
