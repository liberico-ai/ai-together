"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";

interface RubricCriterion {
  id: string;
  name: string;
  maxScore: number;
  description: string;
}

export function ProjectSettingsDialog({
  project,
}: {
  project: { id: string; githubOwner?: string | null; githubRepo?: string | null; scoringRubric?: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState(project.githubOwner || "");
  const [repo, setRepo] = useState(project.githubRepo || "");
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (project.scoringRubric) {
      try {
        setCriteria(JSON.parse(project.scoringRubric));
      } catch (e) {
        setCriteria([]);
      }
    } else {
      setCriteria([]);
    }
  }, [project.scoringRubric, open]);

  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.getById.invalidate({ id: project.id });
      utils.projects.getCommits.invalidate({ projectId: project.id });
      setError(null);
      setOpen(false);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSave = () => {
    setError(null);
    updateProject.mutate({
      id: project.id,
      githubOwner: owner || null,
      githubRepo: repo || null,
      scoringRubric: criteria.length > 0 ? JSON.stringify(criteria) : undefined,
    });
  };

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setOpen(false);
      router.push("/projects");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete this project? All modules, tasks, comments, and commits will be permanently deleted. This cannot be undone.`)) {
      deleteProject.mutate({ id: project.id });
    }
  };

  const addCriterion = () => {
    setCriteria([...criteria, { id: crypto.randomUUID(), name: "", maxScore: 1, description: "" }]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Settings className="mr-2 h-4 w-4" /> Settings
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-6">
        <DialogHeader className="shrink-0 mb-4">
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>
        
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm p-3 rounded-md border border-red-200 dark:border-red-800 mb-4">
            {error}
          </div>
        )}

        <Tabs defaultValue="github" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-3 shrink-0">
            <TabsTrigger value="github">GitHub</TabsTrigger>
            <TabsTrigger value="rubric">Scoring Rubric</TabsTrigger>
            <TabsTrigger value="danger" className="text-rose-600 dark:text-rose-400">Danger Zone</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-y-auto mt-4 px-1">
            <TabsContent value="github" className="space-y-4 m-0">
              <div className="space-y-2">
                <label className="text-sm font-medium">GitHub Repository Owner</label>
                <Input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="e.g. facebook"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">GitHub Repository Name</label>
                <Input
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="e.g. react"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="rubric" className="space-y-4 m-0">
              <div className="flex items-center justify-between">
                <p className="text-sm text-stone-500">Define evaluation criteria when reviewing tasks.</p>
                <Button type="button" size="sm" variant="outline" onClick={addCriterion}>
                  <Plus className="h-4 w-4 mr-2" /> Add Criterion
                </Button>
              </div>
              
              <div className="space-y-4 pb-4">
                {criteria.map((criterion, idx) => (
                  <div key={criterion.id} className="p-4 border border-stone-200 dark:border-stone-800 rounded-lg space-y-3 bg-stone-50 dark:bg-stone-900/30">
                    <div className="flex space-x-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Criterion Name</label>
                        <Input 
                          value={criterion.name} 
                          onChange={e => setCriteria(c => c.map(x => x.id === criterion.id ? { ...x, name: e.target.value } : x))}
                          placeholder="e.g. Code Quality"
                          className="bg-white dark:bg-stone-950"
                        />
                      </div>
                      <div className="w-24 space-y-1">
                        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Max Score</label>
                        <Input 
                          type="number" 
                          min={1} 
                          value={criterion.maxScore} 
                          onChange={e => setCriteria(c => c.map(x => x.id === criterion.id ? { ...x, maxScore: Number(e.target.value) } : x))}
                          className="bg-white dark:bg-stone-950"
                        />
                      </div>
                      <div className="pt-6">
                        <Button type="button" variant="ghost" size="icon" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => setCriteria(c => c.filter(x => x.id !== criterion.id))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Description / Guidelines</label>
                      <Input 
                        value={criterion.description} 
                        onChange={e => setCriteria(c => c.map(x => x.id === criterion.id ? { ...x, description: e.target.value } : x))}
                        placeholder="e.g. Code must be clean, DRY, and well-commented."
                        className="bg-white dark:bg-stone-950"
                      />
                    </div>
                  </div>
                ))}
                
                {criteria.length === 0 && (
                  <div className="text-center p-8 border border-dashed border-stone-200 dark:border-stone-800 rounded-lg text-stone-400">
                    No criteria defined. Click &quot;Add Criterion&quot; to start building your rubric.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="danger" className="space-y-4 m-0">
              <div className="p-4 border-2 border-rose-200 dark:border-rose-900/50 rounded-lg space-y-4 bg-rose-50/50 dark:bg-rose-950/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-rose-700 dark:text-rose-400">Delete Project</h3>
                    <p className="text-sm text-rose-600/70 dark:text-rose-400/70 mt-1">
                      Permanently delete this project and all its modules, tasks, comments, documents, and commits. This action cannot be undone.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50"
                  onClick={handleDelete}
                  disabled={deleteProject.isPending}
                >
                  {deleteProject.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete This Project
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end space-x-2 pt-4 border-t shrink-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} className="gradient-coral border-0 text-white" disabled={updateProject.isPending}>
            {updateProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
