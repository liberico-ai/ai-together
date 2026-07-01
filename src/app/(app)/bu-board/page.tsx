"use client";

import { trpc } from "@/lib/trpc/client";
import { LayoutGrid, Plus } from "lucide-react";
import { BuStatusCard } from "@/components/bu/bu-status-card";
import { BlockerList } from "@/components/bu/blocker-list";
import { CreateTaskDialogV2 } from "@/components/tasks/create-task-dialog-v2";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function BuBoardPage() {
  const { data: bus, isLoading } = trpc.businessUnits.status.useQuery();
  const utils = trpc.useUtils();

  // Sau khi tạo việc → refetch để card BU + bảng blocker cập nhật ngay.
  const handleCreated = () => {
    utils.businessUnits.status.invalidate();
    utils.businessUnits.blockers.invalidate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <LayoutGrid className="h-6 w-6 text-pink-500" />
            BU Board
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trạng thái điều hành từng Business Unit — tiến độ theo IVP, health, và
            vướng mắc toàn hệ thống.
          </p>
        </div>

        {/* Tạo việc nhanh từ header (không gán sẵn BU) */}
        <CreateTaskDialogV2
          onCreated={handleCreated}
          trigger={
            <Button
              size="sm"
              className="shrink-0 bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md transition-all hover:shadow-lg"
            >
              <Plus className="mr-2 h-4 w-4" /> Tạo việc
            </Button>
          }
        />
      </div>

      {/* BU grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : !bus || bus.length === 0 ? (
        <EmptyState
          title="No Business Units"
          description="Chưa có BU nào được tạo. Tạo BU để bắt đầu theo dõi tiến độ."
          icon={LayoutGrid}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bus.map((bu) => (
            <div key={bu.id} className="group relative">
              {/* Nút tạo việc gán sẵn BU này */}
              <div className="absolute right-2 top-2 z-10">
                <CreateTaskDialogV2
                  defaultBuId={bu.id}
                  onCreated={handleCreated}
                  trigger={
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title={`Tạo việc cho ${bu.code}`}
                      className="h-7 w-7 text-pink-600 opacity-0 transition-opacity hover:bg-pink-100 group-hover:opacity-100 dark:text-pink-400 dark:hover:bg-pink-900/30"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="sr-only">Tạo việc cho {bu.code}</span>
                    </Button>
                  }
                />
              </div>

              <BuStatusCard
                code={bu.code}
                name={bu.name}
                progressPct={bu.progressPct}
                openTasks={bu.openTasks}
                overdue={bu.overdue}
                blockers={bu.blockers}
                staleBlockers={bu.staleBlockers}
                health={bu.health}
                lead={bu.lead}
              />
            </div>
          ))}
        </div>
      )}

      {/* Blockers section */}
      <div className="space-y-3 pt-2">
        <h2 className="text-lg font-semibold text-foreground">
          Vướng mắc (Blockers)
        </h2>
        <BlockerList />
      </div>
    </div>
  );
}
