import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Layout } from "@/components/Layout";
import { PostCard, type PostWithMeta } from "@/components/PostCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, Download, Upload, Pencil, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { WalletConnect } from "@/components/WalletConnect";
import { POST_WITH_AUTHOR_AND_SERVER_SELECT } from "@/lib/query-selects";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Profile — Decentra" }] }),
});

function ProfilePage() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("posts").select(POST_WITH_AUTHOR_AND_SERVER_SELECT)
      .eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setPosts((data as any) ?? []));
  }, [user]);

  useEffect(() => {
    if (profile) { setDisplayName(profile.display_name ?? ""); setBio(profile.bio ?? ""); }
  }, [profile]);

  if (authLoading) return null;
  if (!user || !profile) {
    if (typeof window !== "undefined") window.location.replace("/login.html");
    return null;
  }

  const saveEdit = async () => {
    let avatar_url = profile.avatar_url;
    if (avatarFile) {
      const path = `${user.id}/avatar-${Date.now()}.${avatarFile.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, avatarFile);
      if (upErr) { toast.error(upErr.message); return; }
      avatar_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null, bio: bio.trim() || null, avatar_url,
    }).eq("id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Profile updated"); setEditOpen(false); setAvatarFile(null); refreshProfile(); }
  };

  const exportProfile = () => {
    const payload = {
      version: "1.0",
      did: profile.did, public_key: profile.public_key,
      username: profile.username, display_name: profile.display_name,
      bio: profile.bio, avatar_url: profile.avatar_url,
      wallet_address: profile.wallet_address,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `decentra-${profile.username}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Identity exported");
  };

  const importProfile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        await supabase.from("profiles").update({
          display_name: data.display_name ?? profile.display_name,
          bio: data.bio ?? profile.bio,
          avatar_url: data.avatar_url ?? profile.avatar_url,
        }).eq("id", user.id);
        toast.success("Profile imported (keys preserved)");
        refreshProfile();
      } catch { toast.error("Invalid profile file"); }
    };
    reader.readAsText(file);
  };

  return (
    <Layout>
      <header className="sticky top-0 bg-background/80 backdrop-blur border-b border-border z-10 px-5 py-4">
        <h1 className="text-xl font-bold">Profile</h1>
      </header>

      <div className="p-5 space-y-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-xl">{profile.username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{profile.display_name ?? profile.username}</h2>
            <p className="text-muted-foreground">@{profile.username}</p>
            {profile.bio && <p className="mt-2">{profile.bio}</p>}
          </div>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild><Button variant="outline"><Pencil className="h-4 w-4 mr-1" /> Edit</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Display name</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
                <div><Label>Bio</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} /></div>
                <div><Label>Avatar</Label><Input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} /></div>
                <Button onClick={saveEdit} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Fingerprint className="h-4 w-4 text-primary" /> Decentralized Identity
          </div>
          <div className="text-xs space-y-1 font-mono break-all bg-secondary p-3 rounded-lg">
            <div><span className="text-muted-foreground">DID:</span> {profile.did}</div>
            <div><span className="text-muted-foreground">PubKey:</span> {profile.public_key.slice(0, 32)}…</div>
            {profile.wallet_address && (
              <div><span className="text-muted-foreground">Wallet:</span> {profile.wallet_address}</div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <WalletConnect />
            <Button variant="outline" size="sm" onClick={exportProfile}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Label className="cursor-pointer">
              <Button variant="outline" size="sm" asChild><span><Upload className="h-4 w-4 mr-1" /> Import</span></Button>
              <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importProfile(e.target.files[0])} />
            </Label>
          </div>
        </Card>

        <div>
          <h3 className="font-semibold px-1 pb-2 border-b border-border">Your posts</h3>
          {posts.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center">No posts yet.</p>
          ) : posts.map((p) => <PostCard key={p.id} post={p} onDelete={() => setPosts((ps) => ps.filter((x) => x.id !== p.id))} />)}
        </div>
      </div>
    </Layout>
  );
}
