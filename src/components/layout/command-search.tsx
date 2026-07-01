"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Boxes, Users, Search } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Fetch data only when dialog opens
  const { data: projects } = trpc.projects.list.useQuery(undefined, {
    enabled: open,
  });
  const { data: myTasks } = trpc.tasks.myTasks.useQuery(undefined, {
    enabled: open,
  });
  const { data: users } = trpc.users.searchUsers.useQuery(
    { query: "" },
    { enabled: open }
  );

  const handleSelect = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router]
  );

  return (
    <>
      {/* Trigger — looks like the original search bar */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg w-80
          bg-secondary/50 text-muted-foreground text-sm
          transition-all duration-200 hover:bg-secondary/70
          focus:outline-none focus:ring-2 focus:ring-ring/20"
      >
        <Search className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left placeholder:text-muted-foreground/60">
          Search projects, tasks, members...
        </span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5
          rounded text-xs bg-muted text-muted-foreground font-mono">
          ⌘K
        </kbd>
      </button>

      {/* Command Dialog */}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Global Search"
        description="Search across projects, modules, and team members"
      >
        <Command className="rounded-lg">
          <CommandInput placeholder="Type to search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            {/* Projects */}
            {projects && projects.length > 0 && (
              <CommandGroup heading="Projects">
                {projects.map((project: { id: string; title: string; code?: string | null }) => (
                  <CommandItem
                    key={project.id}
                    value={`${project.title} ${project.code || ""}`}
                    onSelect={() => handleSelect(`/projects/${project.id}`)}
                  >
                    <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{project.title}</span>
                      {project.code && (
                        <span className="text-xs text-muted-foreground">{project.code}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {projects && projects.length > 0 && myTasks && myTasks.length > 0 && (
              <CommandSeparator />
            )}

            {/* Tasks */}
            {myTasks && myTasks.length > 0 && (
              <CommandGroup heading="My Tasks">
                {myTasks.map((task: { id: string; title: string; projectId: string | null; project?: { title: string } | null }) => (
                  <CommandItem
                    key={task.id}
                    value={`${task.title} ${task.project?.title || ""}`}
                    onSelect={() => handleSelect(`/projects/${task.projectId}`)}
                  >
                    <Boxes className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{task.title}</span>
                      {task.project?.title && (
                        <span className="text-xs text-muted-foreground">{task.project.title}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {myTasks && myTasks.length > 0 && users && users.length > 0 && (
              <CommandSeparator />
            )}

            {/* Members */}
            {users && users.length > 0 && (
              <CommandGroup heading="Members">
                {users.map((user: { id: string; name: string; email?: string | null }) => (
                  <CommandItem
                    key={user.id}
                    value={`${user.name} ${user.email || ""}`}
                    onSelect={() => handleSelect(`/profile/${user.id}`)}
                  >
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{user.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
