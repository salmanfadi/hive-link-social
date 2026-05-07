import { useEffect, useState } from "react";
import { Heart, MessageCircle, Share2, Trash2, ShieldCheck, ShieldAlert, Repeat2 } from "lucide-react";
import { importPublicKey, verifyData } from "@/services/crypto";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";

export type PostWithMeta = {
  id: string;
  user_id: string;
  server_id: string | null;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  ipfs_hash: string | null;
  created_at: string;
  signature: string | null;
  profiles: { username: string; display_name: string | null; avatar_url: string | null; public_key: string } | null;
  servers: { name: string; slug: string } | null;
};

export function PostCard({ post, onDelete }: { post: PostWithMeta; onDelete?: () => void }) {
  const { user } = useAuth();
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [repostCount, setRepostCount] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [comments, setComments] = useState<Array<{ id: string; content: string; created_at: string; profiles: { username: string; avatar_url: string | null } | null }>>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [imgFailed, setImgFailed] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const author = post.profiles;
  const isOwner = user?.id === post.user_id;

  useEffect(() => {
    if (!post.signature || !author?.public_key) {
      setVerified(false);
      return;
    }
    (async () => {
      try {
        const pub = await importPublicKey(author.public_key);
        const payload = `${post.caption || ""}:${post.media_url || ""}:${post.created_at}`;
        const isOk = await verifyData(pub, post.signature!, payload);
        setVerified(isOk);
      } catch (e) {
        console.error("Verification error", e);
        setVerified(false);
      }
    })();
  }, [post.signature, author?.public_key, post.caption, post.media_url, post.created_at]);

  useEffect(() => {
    (async () => {
      const { count } = await supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", post.id);
      setLikeCount(count ?? 0);
      const { count: rc } = await supabase.from("reposts").select("*", { count: "exact", head: true }).eq("post_id", post.id);
      setRepostCount(rc ?? 0);
      if (user) {
        const { data } = await supabase.from("likes").select("post_id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle();
        setLiked(!!data);
        const { data: r } = await supabase.from("reposts").select("post_id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle();
        setReposted(!!r);
      }
    })();
  }, [post.id, user]);

  const toggleRepost = async () => {
    if (!user) return;
    if (reposted) {
      await supabase.from("reposts").delete().eq("post_id", post.id).eq("user_id", user.id);
      setRepostCount((c) => c - 1); setReposted(false);
    } else {
      await supabase.from("reposts").insert({ post_id: post.id, user_id: user.id });
      setRepostCount((c) => c + 1); setReposted(true);
    }
  };

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      setLikeCount((c) => c - 1); setLiked(false);
    } else {
      await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      setLikeCount((c) => c + 1); setLiked(true);
    }
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, content, created_at, profiles!inner(username, avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setComments((data as any) ?? []);
  };

  const toggleComments = async () => {
    if (!showComments) await loadComments();
    setShowComments(!showComments);
  };

  const submitComment = async () => {
    if (!user || !newComment.trim()) return;
    const { error } = await supabase.from("comments").insert({ post_id: post.id, user_id: user.id, content: newComment.trim() });
    if (error) toast.error(error.message);
    else { setNewComment(""); loadComments(); }
  };

  const deletePost = async () => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) toast.error(error.message);
    else { toast.success("Post removed"); onDelete?.(); }
  };

  const sharePost = async () => {
    const url = window.location.origin + "/?post=" + post.id;
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); } catch { toast.info(url); }
  };

  const renderCaption = (text: string) => {
    const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("#")) {
        return (
          <Link
            key={i}
            to="/tags/$tag"
            params={{ tag: part.slice(1).toLowerCase() }}
            className="text-primary hover:underline font-medium"
          >
            {part}
          </Link>
        );
      }
      return part;
    });
  };

  return (
    <article className="border-b border-border p-4 hover:bg-secondary/30 transition-colors">
      <div className="flex gap-3">
        <Link to="/u/$username" params={{ username: author?.username ?? "" }}>
          <Avatar className="h-11 w-11">
            <AvatarImage src={author?.avatar_url ?? undefined} />
            <AvatarFallback>{author?.username?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Link to="/u/$username" params={{ username: author?.username ?? "" }} className="font-semibold hover:underline">
              {author?.display_name ?? author?.username}
            </Link>
            <span className="text-muted-foreground">@{author?.username}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </span>
            {verified !== null && (
              <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${verified ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}>
                {verified ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                {verified ? "Verified" : "Unverified"}
              </div>
            )}
            {post.servers && (
              <>
                <span className="text-muted-foreground">·</span>
                <Link to="/s/$slug" params={{ slug: post.servers.slug }} className="text-primary hover:underline text-xs">
                  /{post.servers.slug}
                </Link>
              </>
            )}
            {isOwner && (
              <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={deletePost}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {post.caption && <p className="mt-1 whitespace-pre-wrap break-words">{renderCaption(post.caption)}</p>}
          {post.media_url && !imgFailed && (
            <div className="mt-3 rounded-xl overflow-hidden border border-border">
              {post.media_type?.startsWith("video") ? (
                <video src={post.media_url} controls className="w-full max-h-[500px]" />
              ) : (
                <img src={post.media_url} alt="" className="w-full max-h-[500px] object-cover" onError={() => setImgFailed(true)} />
              )}
            </div>
          )}
          {imgFailed && (
            <div className="mt-3 p-3 rounded-xl bg-muted text-muted-foreground text-sm">
              Media unavailable (cached fallback would load here in P2P mode)
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 text-muted-foreground">
            <Button variant="ghost" size="sm" onClick={toggleLike} className={liked ? "text-rose-500 hover:text-rose-600" : ""}>
              <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
              <span className="ml-1.5 text-xs">{likeCount}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleComments}>
              <MessageCircle className="h-4 w-4" />
              <span className="ml-1.5 text-xs">{comments.length || ""}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={sharePost}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {showComments && (
            <div className="mt-3 space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2 text-sm">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback>{c.profiles?.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 bg-secondary rounded-2xl px-3 py-2">
                    <span className="font-semibold mr-2">@{c.profiles?.username}</span>
                    <span>{c.content}</span>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="min-h-[44px] resize-none"
                />
                <Button onClick={submitComment} disabled={!newComment.trim()}>Reply</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
