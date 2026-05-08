import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { PostCard, type PostWithMeta } from "@/components/PostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { POST_WITH_AUTHOR_AND_SERVER_SELECT } from "@/lib/query-selects";
import { Hash } from "lucide-react";

export const Route = createFileRoute("/tags/$tag")({
  component: TagFeed,
  head: ({ params }) => ({
    meta: [
      { title: `#${params.tag} — Decentra` },
    ],
  }),
});

function TagFeed() {
  const { tag } = Route.useParams();
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("posts")
        .select(POST_WITH_AUTHOR_AND_SERVER_SELECT)
        .ilike("caption", `%#${tag}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (!error && data) {
        setPosts(data as any);
      }
      setLoading(false);
    })();
  }, [tag]);

  return (
    <Layout>
      <header className="sticky top-0 bg-background/80 backdrop-blur border-b border-border z-10 px-5 py-4 flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-xl">
          <Hash className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">#{tag}</h1>
          <p className="text-xs text-muted-foreground">Trending decentralized topics</p>
        </div>
      </header>
      {loading ? (
        <div className="p-4 space-y-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">
          <p>No posts found with #{tag}.</p>
        </div>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onDelete={() => setPosts((ps) => ps.filter((x) => x.id !== p.id))} />)
      )}
    </Layout>
  );
}
