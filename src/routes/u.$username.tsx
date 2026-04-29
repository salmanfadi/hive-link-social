import { createFileRoute, Navigate, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Layout } from "@/components/Layout";
import { PostCard, type PostWithMeta } from "@/components/PostCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (!p) { setLoading(false); return; }
      setProfile(p);
      const { data: posts } = await supabase.from("posts")
        .select("*, profiles!inner(username, display_name, avatar_url), servers(name, slug)")
        .eq("user_id", p.id).order("created_at", { ascending: false });
      setPosts((posts as any) ?? []);
      setLoading(false);
    })();
  }, [username]);

  if (!user) return <Navigate to="/auth" />;
  if (loading) return <Layout><div className="p-8 text-muted-foreground">Loading…</div></Layout>;
  if (!profile) throw notFound();

  return (
    <Layout>
      <div className="p-5 flex items-start gap-4 border-b border-border">
        <Avatar className="h-20 w-20">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-xl">{profile.username[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{profile.display_name ?? profile.username}</h1>
          <p className="text-muted-foreground">@{profile.username}</p>
          {profile.bio && <p className="mt-2">{profile.bio}</p>}
          <p className="mt-2 text-xs font-mono text-muted-foreground break-all">{profile.did}</p>
        </div>
      </div>
      {posts.length === 0 ? (
        <p className="p-8 text-center text-muted-foreground">No posts yet.</p>
      ) : posts.map((p) => <PostCard key={p.id} post={p} />)}
    </Layout>
  );
}
