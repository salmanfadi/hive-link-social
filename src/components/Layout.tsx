import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, User, Users, LogOut, PlusSquare, Radio, Bell, Search, MessageCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useP2P } from "@/lib/p2p-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Layout({ children }: { children: ReactNode }) {
  return <LayoutInner>{children}</LayoutInner>;
}

function LayoutInner({ children }: { children: ReactNode }) {
  const { profile, signOut, user } = useAuth();
  const { peerCount, activeChannels, reconnectAttempts, lastEvent, sessionLog } = useP2P();
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [unread, setUnread] = useState(0);
  const [showP2PDetails, setShowP2PDetails] = useState(false);

  useEffect(() => {
    if (!user) return;
    const refresh = async () => {
      const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("read", false);
      setUnread(count ?? 0);
    };
    refresh();
    const ch = supabase
      .channel(`notif-badge-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const navItem = (to: string, icon: ReactNode, label: string, badge?: number) => {
    const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
    return (
      <Link
        to={to}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
          active ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-foreground"
        }`}
      >
        <span className="relative">
          {icon}
          {badge ? (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </span>
        <span className="font-medium hidden lg:inline">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl flex">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-20 lg:w-64 h-screen sticky top-0 p-4 border-r border-border">
          <Link to="/" className="flex items-center gap-2 px-2 py-4 mb-4" aria-label="Decentra home">
            {/* Favicon logo — matches /favicon.svg */}
            <span className="flex-shrink-0 h-8 w-8">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-8 w-8">
                <rect width="32" height="32" rx="6" fill="currentColor" className="text-primary" />
                <path d="M16 8L24 16L16 24L8 16L16 8Z" fill="white" fillOpacity="0.95" />
                <circle cx="16" cy="16" r="3" fill="currentColor" className="text-primary" />
              </svg>
            </span>
            <span className="text-xl font-bold hidden lg:inline bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
              Decentra
            </span>
          </Link>
          <nav className="flex flex-col gap-1 flex-1">
            {navItem("/", <Home className="h-5 w-5" />, "Home")}
            {navItem("/search", <Search className="h-5 w-5" />, "Search")}
            {navItem("/notifications", <Bell className="h-5 w-5" />, "Notifications", unread)}
            {navItem("/servers", <Users className="h-5 w-5" />, "Communities")}
            {navItem("/messages", <MessageCircle className="h-5 w-5" />, "Messages")}
            {navItem("/profile", <User className="h-5 w-5" />, "Profile")}
          </nav>
          <div className="mb-3 px-2 hidden lg:block">
            <button
              className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowP2PDetails((v) => !v)}
              title="Click to toggle P2P details"
            >
              <Radio className={`h-3.5 w-3.5 ${peerCount > 0 ? "text-primary animate-pulse" : ""}`} />
              <span>P2P</span>
              <Badge variant="secondary" className="ml-auto">{peerCount} {peerCount === 1 ? "peer" : "peers"}</Badge>
              <ThemeToggle />
            </button>
            {showP2PDetails && (
              <div className="mt-2 p-2 rounded-lg bg-secondary/60 text-[11px] text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Open channels</span>
                  <span className="font-mono">{activeChannels}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reconnects</span>
                  <span className="font-mono">{reconnectAttempts}</span>
                </div>
                {sessionLog.length > 0 && (
                  <>
                    <div className="pt-1 border-t border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-medium text-foreground">Session log</span>
                        <button
                          className="text-[10px] text-primary hover:underline"
                          onClick={() => {
                            navigator.clipboard.writeText(sessionLog.join("\n"));
                          }}
                          title="Copy full log to clipboard"
                        >
                          Copy ({sessionLog.length})
                        </button>
                      </div>
                      <div className="space-y-0.5 max-h-28 overflow-y-auto">
                        {sessionLog.slice(-10).map((entry, i) => (
                          <div key={i} className="text-[10px] truncate" title={entry}>{entry}</div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <Button
            className="w-full mb-4 rounded-xl shadow-md"
            style={{ backgroundImage: "var(--gradient-primary)" }}
            onClick={() => navigate({ to: "/new", search: {} as any })}
          >
            <PlusSquare className="h-5 w-5" />
            <span className="hidden lg:inline ml-2">New Post</span>
          </Button>
          {profile && (
            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary cursor-pointer" onClick={() => navigate({ to: "/profile" })}>
              <Avatar className="h-9 w-9">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback>{profile.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="hidden lg:block flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile.display_name ?? profile.username}</p>
                <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:inline-flex"
                onClick={(e) => { e.stopPropagation(); signOut(); }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 min-h-screen border-r border-border">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-background border-t border-border flex justify-around p-2 z-50">
          <Link to="/" className="p-3"><Home className="h-6 w-6" /></Link>
          <Link to="/search" className="p-3"><Search className="h-6 w-6" /></Link>
          <Link to="/messages" className="p-3"><MessageCircle className="h-6 w-6" /></Link>
          <Link to="/new" search={{} as any} className="p-3"><PlusSquare className="h-6 w-6 text-primary" /></Link>
          <Link to="/notifications" className="p-3 relative">
            <Bell className="h-6 w-6" />
            {unread > 0 && <span className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{unread > 99 ? "99+" : unread}</span>}
          </Link>
          <Link to="/profile" className="p-3"><User className="h-6 w-6" /></Link>
        </nav>
      </div>
    </div>
  );
}
