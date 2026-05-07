import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, User, Users, LogOut, PlusSquare, Sparkles, Radio, Bell, Search, MessageCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useP2P } from "@/lib/p2p-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut, user } = useAuth();
  const { peerCount } = useP2P();
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [unread, setUnread] = useState(0);

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
          <Link to="/" className="flex items-center gap-2 px-2 py-4 mb-4">
            <Sparkles className="h-7 w-7 text-primary" />
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
          <div className="mb-3 px-2 hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
            <Radio className={`h-3.5 w-3.5 ${peerCount > 0 ? "text-primary animate-pulse" : ""}`} />
            <span>P2P</span>
            <Badge variant="secondary" className="ml-auto">{peerCount} {peerCount === 1 ? "peer" : "peers"}</Badge>
          </div>
          <Button
            className="w-full mb-4 rounded-xl shadow-md"
            style={{ backgroundImage: "var(--gradient-primary)" }}
            onClick={() => navigate({ to: "/new" })}
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
          <Link to="/new" className="p-3"><PlusSquare className="h-6 w-6 text-primary" /></Link>
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
