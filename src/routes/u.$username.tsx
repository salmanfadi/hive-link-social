import { createFileRoute, Navigate, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Layout } from "@/components/Layout";
import { PostCard, type PostWithMeta } from "@/components/PostCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { POST_WITH_AUTHOR_AND_SERVER_LITE_SELECT } from "@/lib/query-selects";
import { UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/u/$username")({
  component: UserPage,
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — Decentra` }] }),
});

function UserPage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (!p) { setLoading(false); return; }
      setProfile(p);
      const [{ data: posts }, { count: followers }, { count: followingCount }, mineRes] = await Promise.all([
        supabase.from("posts").select(POST_WITH_AUTHOR_AND_SERVER_LITE_SELECT)
          .eq("user_id", p.id).order("created_at", { ascending: false }),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id),
        user ? supabase.from("follows").select("follower_id").eq("follower_id", user.id).eq("following_id", p.id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);
      setPosts((posts as any) ?? []);
      setCounts({ followers: followers ?? 0, following: followingCount ?? 0 });
      setFollowing(!!(mineRes as any)?.data);
      setLoading(false);
    })();
  }, [username, user]);

  const toggleFollow = async () => {
    if (!user || !profile || user.id === profile.id) return;
    setBusy(true);
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
      setFollowing(false); setCounts((c) => ({ ...c, followers: c.followers - 1 }));
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
      if (error) toast.error(error.message);
      else { setFollowing(true); setCounts((c) => ({ ...c, followers: c.followers + 1 })); }
    }
    setBusy(false);
  };

  if (!user) {
    if (typeof window !== "undefined") window.location.replace("/login.html");
    return null;
  }
  if (loading) return <Layout><div className="p-8 text-muted-foreground">Loading…</div></Layout>;
  if (!profile) throw notFound();

  const isMe = user.id === profile.id;

  return (
    <Layout>
      <div className="p-5 flex items-start gap-4 border-b border-border">
        <Avatar className="h-20 w-20">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-xl">{profile.username[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{profile.display_name ?? profile.username}</h1>
              <p className="text-muted-foreground">@{profile.username}</p>
            </div>
            {!isMe && (
              <Button size="sm" disabled={busy} onClick={toggleFollow} variant={following ? "outline" : "default"}>
                {following ? <><UserCheck className="h-4 w-4 mr-1" /> Following</> : <><UserPlus className="h-4 w-4 mr-1" /> Follow</>}
              </Button>
            )}
          </div>
          {profile.bio && <p className="mt-2">{profile.bio}</p>}
          <div className="mt-2 flex gap-4 text-sm">
            <span><strong>{counts.followers}</strong> <span className="text-muted-foreground">followers</span></span>
            <span><strong>{counts.following}</strong> <span className="text-muted-foreground">following</span></span>
          </div>
          <p className="mt-2 text-xs font-mono text-muted-foreground break-all">{profile.did}</p>
        </div>
      </div>
      {posts.length === 0 ? (
        <p className="p-8 text-center text-muted-foreground">No posts yet.</p>
      ) : posts.map((p) => <PostCard key={p.id} post={p} />)}
    </Layout>
  );
}
