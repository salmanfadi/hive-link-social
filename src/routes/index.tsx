import { createFileRoute, Navigate, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useP2P } from "@/lib/p2p-context";
import { Layout } from "@/components/Layout";
import { PostCard, type PostWithMeta } from "@/components/PostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cacheFeed, getCachedFeed } from "@/lib/cache";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
  },
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
  const { onInboundPost } = useP2P();
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedType, setFeedType] = useState<"global" | "following">("global");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("posts")
        .select("*, profiles!inner(username, display_name, avatar_url, public_key), servers(name, slug)");

      if (feedType === "following") {
        const { data: follows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id);
        const followingIds = follows?.map((f) => f.following_id) ?? [];
        query = query.in("user_id", followingIds);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(50);

      if (error || !data) {
        if (feedType === "global") {
          setPosts(getCachedFeed<PostWithMeta>());
        } else {
          setPosts([]);
        }
      } else {
        setPosts(data as any);
        if (feedType === "global") cacheFeed(data);
      }
      setLoading(false);
    })();
  }, [user, feedType]);

  useEffect(() => {
    return onInboundPost((post, fromPeer) => {
      const p = post as PostWithMeta;
      setPosts((prev) => {
        if (prev.some((x) => x.id === p.id)) return prev;
        toast.info(`New post relayed from ${fromPeer.slice(0, 8)}…`);
        return [p, ...prev];
      });
    });
  }, [onInboundPost]);

  // While auth is resolving (only happens when a stored session exists), show nothing
  if (authLoading) return null;

  // Not logged in → go to login immediately
  if (!user) return <Navigate to="/auth" />;

  return (
    <Layout>
      <header className="sticky top-0 bg-background/80 backdrop-blur border-b border-border z-10 px-5 pt-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold">Home Feed</h1>
            <p className="text-xs text-muted-foreground">
              Federated content · IPFS-pinned media · live P2P relay
            </p>
          </div>
        </div>
        <Tabs value={feedType} onValueChange={(v) => setFeedType(v as any)} className="w-full">
          <TabsList className="w-full justify-start h-auto p-0 bg-transparent gap-6">
            <TabsTrigger
              value="global"
              className="px-0 py-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none shadow-none font-semibold transition-none"
            >
              Global
            </TabsTrigger>
            <TabsTrigger
              value="following"
              className="px-0 py-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none shadow-none font-semibold transition-none"
            >
              Following
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>
      {loading ? (
        <div className="p-4 space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">
          <p>No posts yet. Be the first to post something!</p>
        </div>
      ) : (
        posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            onDelete={() => setPosts((ps) => ps.filter((x) => x.id !== p.id))}
          />
        ))
      )}
    </Layout>
  );
}
