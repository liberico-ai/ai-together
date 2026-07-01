"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/client";
import {
  Loader2, ShieldAlert, ShieldCheck, User as UserIcon, Github,
  MoreHorizontal, Ban, CheckCircle, KeyRound, LogOut, Trash2,
} from "lucide-react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";

export default function AdminPage() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Dialogs
  const [resetPwDialog, setResetPwDialog] = useState<{ open: boolean; userId: string; userName: string }>({ open: false, userId: "", userName: "" });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId: string; userName: string }>({ open: false, userId: "", userName: "" });
  const [newPassword, setNewPassword] = useState("");

  const { data: users, isLoading, error } = trpc.users.list.useQuery(undefined, { retry: false });

  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); setUpdatingId(null); },
    onError: (err) => { alert(err.message); setUpdatingId(null); },
  });

  const disableUser = trpc.users.disableUser.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); },
    onError: (err) => alert(err.message),
  });

  const enableUser = trpc.users.enableUser.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); },
    onError: (err) => alert(err.message),
  });

  const resetPassword = trpc.users.resetPassword.useMutation({
    onSuccess: () => {
      setResetPwDialog({ open: false, userId: "", userName: "" });
      setNewPassword("");
      alert("Password has been reset successfully.");
    },
    onError: (err) => alert(err.message),
  });

  const forceLogout = trpc.users.forceLogout.useMutation({
    onSuccess: () => alert("User has been logged out from all devices."),
    onError: (err) => alert(err.message),
  });

  const deleteUser = trpc.users.deleteUser.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setDeleteDialog({ open: false, userId: "", userName: "" });
    },
    onError: (err) => alert(err.message),
  });

  const handleRoleChange = (userId: string, newRole: "admin" | "chairman" | "user") => {
    if (confirm(`Change this user's role to ${newRole.toUpperCase()}?`)) {
      setUpdatingId(userId);
      updateRole.mutate({ userId, role: newRole });
    }
  };

  if (error?.data?.code === 'FORBIDDEN') {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <div className="h-16 w-16 bg-rose-100 dark:bg-rose-950/30 text-rose-600 rounded-full flex items-center justify-center">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-stone-500 max-w-sm">
          You do not have the required permissions to view this page.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-coral-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Administration</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage user accounts, roles, and platform access.
          </p>
        </div>
        <CreateUserDialog />
      </div>

      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-stone-50/50 dark:bg-stone-900/20">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Linked Accounts</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!users || users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-stone-500">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const isMe = user.id === session?.user?.id;
                return (
                  <TableRow key={user.id} className={user.banned ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-coral-100 text-coral-700 dark:bg-coral-900/30 dark:text-coral-400">
                            {user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm text-stone-900 dark:text-stone-100">
                            {user.name}
                            {isMe && <span className="text-xs text-stone-400 ml-1">(You)</span>}
                          </p>
                          <p className="text-xs text-stone-500 font-mono mt-0.5 max-w-[120px] truncate">{user.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono text-stone-600 dark:text-stone-400">
                        {user.username || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.banned ? (
                        <Badge variant="outline" className="border-rose-200 text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900">
                          <Ban className="h-3 w-3 mr-1" />Disabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900">
                          <CheckCircle className="h-3 w-3 mr-1" />Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.githubMap ? (
                        <div className="flex items-center space-x-1.5 text-sm text-stone-600 dark:text-stone-400">
                          <Github className="h-4 w-4" />
                          <span>{user.githubMap.githubUsername}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400 italic">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`
                        ${user.role === 'admin' ? 'border-rose-200 text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900' : ''}
                        ${user.role === 'chairman' ? 'border-amber-200 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900' : ''}
                        ${user.role === 'user' ? 'border-stone-200 text-stone-600 bg-stone-50 dark:bg-stone-900/30 dark:border-stone-800' : ''}
                      `}>
                        {user.role === 'admin' && <ShieldAlert className="h-3 w-3 mr-1" />}
                        {user.role === 'chairman' && <ShieldCheck className="h-3 w-3 mr-1" />}
                        {user.role === 'user' && <UserIcon className="h-3 w-3 mr-1" />}
                        {user.role.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Role Change */}
                        <Select 
                          disabled={updatingId === user.id || (isMe && user.role === 'admin')}
                          value={user.role} 
                          onValueChange={(val) => handleRoleChange(user.id, val as "admin" | "chairman" | "user")}
                        >
                          <SelectTrigger className="w-[110px] h-8 text-xs">
                            {updatingId === user.id ? (
                              <div className="flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-2" /> Saving...</div>
                            ) : (
                              <SelectValue placeholder="Role" />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrator</SelectItem>
                            <SelectItem value="chairman">Chairman</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Actions Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <div className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer">
                              <MoreHorizontal className="h-4 w-4 text-stone-500" />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {/* Disable / Enable */}
                            {user.banned ? (
                              <DropdownMenuItem
                                onClick={() => enableUser.mutate({ userId: user.id })}
                                className="cursor-pointer"
                              >
                                <CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />
                                Enable Account
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (confirm(`Disable account for "${user.name}"? They will be logged out immediately.`)) {
                                    disableUser.mutate({ userId: user.id });
                                  }
                                }}
                                disabled={isMe}
                                className="cursor-pointer"
                              >
                                <Ban className="mr-2 h-4 w-4 text-amber-500" />
                                Disable Account
                              </DropdownMenuItem>
                            )}

                            {/* Reset Password */}
                            <DropdownMenuItem
                              onClick={() => setResetPwDialog({ open: true, userId: user.id, userName: user.name })}
                              className="cursor-pointer"
                            >
                              <KeyRound className="mr-2 h-4 w-4" />
                              Reset Password
                            </DropdownMenuItem>

                            {/* Force Logout */}
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm(`Force logout "${user.name}" from all devices?`)) {
                                  forceLogout.mutate({ userId: user.id });
                                }
                              }}
                              className="cursor-pointer"
                            >
                              <LogOut className="mr-2 h-4 w-4" />
                              Force Logout
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Delete */}
                            <DropdownMenuItem
                              onClick={() => setDeleteDialog({ open: true, userId: user.id, userName: user.name })}
                              disabled={isMe}
                              className="cursor-pointer text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwDialog.open} onOpenChange={(open) => {
        if (!open) { setResetPwDialog({ open: false, userId: "", userName: "" }); setNewPassword(""); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{resetPwDialog.userName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwDialog({ open: false, userId: "", userName: "" })}>
              Cancel
            </Button>
            <Button
              onClick={() => resetPassword.mutate({ userId: resetPwDialog.userId, newPassword })}
              disabled={newPassword.length < 6 || resetPassword.isPending}
            >
              {resetPassword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => {
        if (!open) setDeleteDialog({ open: false, userId: "", userName: "" });
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600">Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{deleteDialog.userName}</strong>?
              This action cannot be undone. All associated data will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, userId: "", userName: "" })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUser.mutate({ userId: deleteDialog.userId })}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
