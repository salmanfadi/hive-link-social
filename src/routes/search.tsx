import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search as SearchIcon, Users } from "lucide-react";

export const Route = createFileRoute("/search")({
  component: SearchPage,
  head: () => ({ meta: [{ title: "Search — Decentra" }] }),
});

function SearchPage() {
  const { user, loading: authLoading } = useAuth();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [people, setPeople] = useState<Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; bio: string | null }>>([]);
  const [communities, setCommunities] = useState<Array<{ id: string; name: string; slug: string; description: string | null }>>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!debounced) { setPeople([]); setCommunities([]); return; }
    const term = `%${debounced}%`;
    (async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url, bio")
          .or(`username.ilike.${term},display_name.ilike.${term}`).limit(20),
        supabase.from("servers").select("id, name, slug, description")
          .or(`name.ilike.${term},slug.ilike.${term}`).limit(20),
      ]);
      setPeople((p as any) ?? []);
      setCommunities((s as any) ?? []);
    })();
  }, [debounced]);

  const empty = useMemo(() => debounced && people.length === 0 && communities.length === 0, [debounced, people, communities]);

  if (authLoading) return null;
  if (!user) {
    if (typeof window !== "undefined") window.location.replace("/login.html");
    return null;
  }

  return (
    <Layout>
      <header className="sticky top-0 bg-background/80 backdrop-blur border-b border-border z-10 px-5 py-4">
        <h1 className="text-xl font-bold mb-3">Search</h1>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find people or communities…" className="pl-9" autoFocus />
        </div>
      </header>

      <div className="p-5 space-y-6">
        {!debounced && <p className="text-muted-foreground text-center py-12">Type to search the network.</p>}
        {empty && <p className="text-muted-foreground text-center py-12">No results for "{debounced}".</p>}

        {people.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">People</h2>
            <div className="space-y-1">
              {people.map((p) => (
                <Link key={p.id} to="/u/$username" params={{ username: p.username }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors">
                  <Avatar className="h-11 w-11"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{p.username[0]?.toUpperCase()}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{p.display_name ?? p.username}</p>
                    <p className="text-sm text-muted-foreground truncate">@{p.username}{p.bio ? ` · ${p.bio}` : ""}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {communities.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Communities</h2>
            <div className="space-y-1">
              {communities.map((s) => (
                <Link key={s.id} to="/s/$slug" params={{ slug: s.slug }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors">
                  <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{s.name}</p>
                    <p className="text-sm text-muted-foreground truncate">/{s.slug}{s.description ? ` · ${s.description}` : ""}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
