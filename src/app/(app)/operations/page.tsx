"use client";
import { trpc } from "@/lib/trpc/client";
import { format } from "date-fns";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function OperationsPage() {
  const { data: operations, isLoading } = trpc.operations.getAll.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
          <p className="text-muted-foreground">Loading operations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Vận hành (Operations)</h1>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Mã ID</TableHead>
                  <TableHead className="w-[120px]">Jira Key</TableHead>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Mức độ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Người xử lý</TableHead>
                  <TableHead className="text-right">Ngày nhận</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Không có issue nào đang lưu trữ.
                    </TableCell>
                  </TableRow>
                )}
                {operations?.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell className="font-medium">{op.id}</TableCell>
                    <TableCell>
                      {op.jiraIssueKey ? (
                        <a 
                          href={`${process.env.NEXT_PUBLIC_JIRA_BASE_URL || "https://jira.ipcoms.vn"}/browse/${op.jiraIssueKey}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:opacity-80 transition-opacity"
                        >
                          <Badge variant="outline" className="font-mono text-xs cursor-pointer hover:bg-muted">
                            {op.jiraIssueKey}
                          </Badge>
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{op.title}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={op.priority === "high" ? "destructive" : "secondary"}>
                        {op.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        op.status === "resolved" || op.status === "closed"
                          ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                          : op.status === "in_progress"
                          ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                          : "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20"
                      }>
                        {op.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {op.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={op.assignee.image || ""} />
                            <AvatarFallback>{op.assignee.name?.[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{op.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Chưa giao</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {format(new Date(op.createdAt), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
