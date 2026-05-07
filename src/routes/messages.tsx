import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useP2P } from "@/lib/p2p-context";
import { Layout } from "@/components/Layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send } from "lucide-react";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
  head: () => ({ meta: [{ title: "Messages — Decentra" }] }),
});

function MessagesPage() {
  const { user } = useAuth();
  const { dms, sendDM, connectedPeers } = useP2P();
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [msgText, setMsgText] = useState("");
  const [peerProfiles, setPeerProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    if (connectedPeers.length > 0) {
      supabase.from("profiles").select("id, username, avatar_url, display_name").in("id", connectedPeers)
        .then(({ data }) => {
          const mapping = (data || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
          setPeerProfiles(mapping);
        });
    }
  }, [connectedPeers]);

  if (!user) return <Navigate to="/auth" />;

  const currentDms = selectedPeer ? dms[selectedPeer] || [] : [];

  const handleSend = () => {
    if (!selectedPeer || !msgText.trim()) return;
    if (sendDM(selectedPeer, msgText.trim())) {
      setMsgText("");
    }
  };

  return (
    <Layout>
      <header className="sticky top-0 bg-background/80 backdrop-blur border-b border-border z-10 px-5 py-4">
        <h1 className="text-xl font-bold">Direct Messages</h1>
        <p className="text-xs text-muted-foreground">P2P encrypted channels via WebRTC</p>
      </header>
      
      <div className="flex h-[calc(100vh-140px)]">
        {/* Peer List */}
        <div className="w-1/3 border-r border-border overflow-y-auto">
          {connectedPeers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No peers online. DMs require a direct P2P connection.
            </div>
          ) : (
            connectedPeers.map(pid => {
              const profile = peerProfiles[pid];
              return (
                <button
                  key={pid}
                  onClick={() => setSelectedPeer(pid)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors ${selectedPeer === pid ? "bg-secondary" : ""}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback>{profile?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="text-left overflow-hidden">
                    <div className="font-semibold truncate">{profile?.display_name || profile?.username || pid.slice(0,8)}</div>
                    <div className="text-xs text-muted-foreground truncate">Online via P2P</div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedPeer ? (
            <>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {currentDms.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10 text-sm">
                      Start of your encrypted conversation with {peerProfiles[selectedPeer]?.username || "peer"}
                    </div>
                  ) : (
                    currentDms.map((m, i) => (
                      <div key={i} className={`flex ${m.from === user.id ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${m.from === user.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                          <div className="text-sm">{m.text}</div>
                          <div className="text-[10px] opacity-70 mt-1">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <div className="p-4 border-t border-border flex gap-2">
                <Input
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  placeholder="Type a message..."
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <Button size="icon" onClick={handleSend} disabled={!msgText.trim()}><Send className="h-4 w-4" /></Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
              <p>Select a peer to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
