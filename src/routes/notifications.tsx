import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Layout } from "@/components/Layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, UserPlus, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications — Decentra" }] }),
});

type Notif = {
  id: string;
  type: "like" | "comment" | "follow";
  read: boolean;
  created_at: string;
  post_id: string | null;
  actor: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, type, read, created_at, post_id, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    // Fallback if FK alias not present — fetch profiles separately
    if (!data) return;
    if (data.length && !(data[0] as any).actor) {
      const ids = Array.from(new Set((data as any[]).map((n) => n.actor_id).filter(Boolean)));
      const { data: profs } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setItems((data as any[]).map((n) => ({ ...n, actor: map.get(n.actor_id) ?? null })) as Notif[]);
    } else {
      setItems(data as any);
    }
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" />;

  const icon = (t: Notif["type"]) =>
    t === "like" ? <Heart className="h-4 w-4 text-rose-500" /> :
    t === "comment" ? <MessageCircle className="h-4 w-4 text-primary" /> :
    <UserPlus className="h-4 w-4 text-emerald-500" />;

  const text = (n: Notif) => {
    const name = n.actor?.display_name ?? n.actor?.username ?? "Someone";
    if (n.type === "like") return `${name} liked your post`;
    if (n.type === "comment") return `${name} commented on your post`;
    return `${name} started following you`;
  };

  return (
    <Layout>
      <header className="sticky top-0 bg-background/80 backdrop-blur border-b border-border z-10 px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Notifications</h1>
          <p className="text-xs text-muted-foreground">Live activity across the network</p>
        </div>
        <Button variant="ghost" size="sm" onClick={markAllRead}><Check className="h-4 w-4 mr-1" /> Mark all read</Button>
      </header>
      {items.length === 0 ? (
        <p className="p-12 text-center text-muted-foreground">You're all caught up.</p>
      ) : items.map((n) => (
        <Link
          key={n.id}
          to={n.actor ? "/u/$username" : "/"}
          params={n.actor ? { username: n.actor.username } : undefined as any}
          className={`flex items-center gap-3 p-4 border-b border-border hover:bg-secondary/30 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
        >
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage src={n.actor?.avatar_url ?? undefined} />
              <AvatarFallback>{n.actor?.username?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 border border-border">{icon(n.type)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm">{text(n)}</p>
            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
          </div>
          {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
        </Link>
      ))}
    </Layout>
  );
}
