import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useP2P } from "@/lib/p2p-context";
import { Layout } from "@/components/Layout";
import { PostCard, type PostWithMeta } from "@/components/PostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cacheFeed, getCachedFeed } from "@/lib/cache";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Home — Decentra" },
      { name: "description", content: "Your federated social feed." },
    ],
  }),
});

function Home() {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*, profiles!inner(username, display_name, avatar_url), servers(name, slug)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error || !data) {
        const cached = getCachedFeed<PostWithMeta>();
        setPosts(cached);
      } else {
        setPosts(data as any);
        cacheFeed(data);
      }
      setLoading(false);
    })();
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" />;

  return (
    <Layout>
      <header className="sticky top-0 bg-background/80 backdrop-blur border-b border-border z-10 px-5 py-4">
        <h1 className="text-xl font-bold">Home Feed</h1>
        <p className="text-xs text-muted-foreground">Federated content from across communities</p>
      </header>
      {loading ? (
        <div className="p-4 space-y-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">
          <p>No posts yet. Be the first to post something!</p>
        </div>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onDelete={() => setPosts((ps) => ps.filter((x) => x.id !== p.id))} />)
      )}
    </Layout>
  );
}
