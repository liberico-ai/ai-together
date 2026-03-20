"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Search, X, Shield, Plus } from "lucide-react";
import { useSession } from "@/lib/auth/client";
import { Badge } from "@/components/ui/badge";

export function ManageTeamDialog({ project }: { project: any }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: session } = useSession();
  
  const utils = trpc.useUtils();
  
  const { data: searchResults, isLoading: isSearching } = trpc.users.searchUsers.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 1 }
  );

  const addMember = trpc.projects.addMember.useMutation({
    onSuccess: () => {
      utils.projects.getById.invalidate({ id: project.id });
      setSearchQuery("");
    }
  });

  const removeMember = trpc.projects.removeMember.useMutation({
    onSuccess: () => {
      utils.projects.getById.invalidate({ id: project.id });
    }
  });

  // Only chairman or admin can manage
  const isChairman = session?.user?.id === project.chairmanId;
  const isAdmin = (session?.user as any)?.role === "admin" || (session?.user as any)?.role === "chairman";
  const canManage = isChairman || isAdmin;

  if (!canManage) {
    return (
      <Button variant="outline" className="w-full mt-5 rounded-xl opacity-50 cursor-not-allowed" size="sm" title="Only Chairman or Admin can manage team">
        Manage Team
      </Button>
    );
  }

  const handleAdd = (userId: string) => {
    addMember.mutate({ projectId: project.id, userId });
  };

  const handleRemove = (userId: string) => {
    if (confirm("Are you sure you want to remove this member?")) {
      removeMember.mutate({ projectId: project.id, userId });
    }
  };

  const existingMemberIds = new Set([project.chairmanId, ...project.members.map((m: any) => m.user.id)]);
  const filteredSearch = searchResults?.filter(u => !existingMemberIds.has(u.id)) || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-full mt-5 rounded-xl" size="sm" />}>
        Manage Team
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Manage Team</DialogTitle>
          <DialogDescription>
            Add or remove members from {project.title}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Add Members Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Add Member</h4>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or username..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && (
                <div className="absolute right-3 top-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            
            {searchQuery.length > 1 && (
              <div className="mt-2 border rounded-md divide-y max-h-48 overflow-y-auto">
                {filteredSearch.length === 0 ? (
                  <div className="p-4 text-sm text-center text-muted-foreground border-transparent">
                    {isSearching ? "Searching..." : "No users found."}
                  </div>
                ) : (
                  filteredSearch.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 border-transparent hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {user.image && <AvatarImage src={user.image} />}
                          <AvatarFallback className="bg-stone-100 text-stone-700 text-xs">
                            {user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium leading-none">{user.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">@{user.username}</p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => handleAdd(user.id)}
                        disabled={addMember.isPending}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="relative">
             <div className="absolute inset-0 flex items-center">
               <span className="w-full border-t border-muted" />
             </div>
          </div>

          {/* Current Members Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Current Members ({project.members.length + 1})</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {/* Chairman */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 ring-2 ring-amber-500/30">
                    <AvatarFallback className="bg-amber-100 text-amber-700 font-semibold">
                      {project.chairman?.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium leading-none flex items-center gap-2">
                      {project.chairman?.name} 
                      <Shield className="h-3 w-3 text-amber-500" />
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Chairman</p>
                  </div>
                </div>
              </div>

              {/* Members */}
              {project.members.map((m: any) => (
                <div key={m.user.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-stone-100 text-stone-700 font-semibold text-xs">
                        {m.user.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium leading-none flex items-center gap-2">
                        {m.user.name}
                        {m.user.role === "admin" && <Badge variant="secondary" className="px-1 py-0 text-[9px]">Admin</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Member</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                    onClick={() => handleRemove(m.user.id)}
                    disabled={removeMember.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
