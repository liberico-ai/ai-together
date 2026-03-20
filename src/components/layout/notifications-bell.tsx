"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Bell, Check, Loader2, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();
  
  const { data: count = 0 } = trpc.notifications.getUnreadCount.useQuery();
  
  const { data: notifications, isLoading } = trpc.notifications.list.useQuery(undefined, {
    enabled: open
  });
  
  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.list.invalidate();
    }
  });

  const markAllAsRead = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.list.invalidate();
    }
  });

  const handleNotificationClick = (id: string, link: string | null) => {
    markAsRead.mutate({ id });
    setOpen(false);
    if (link) {
       router.push(link);
    }
  };

  useEffect(() => {
    const eventSource = new EventSource("/api/sse/notifications");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_notification") {
          utils.notifications.getUnreadCount.invalidate();
          if (open) {
            utils.notifications.list.invalidate();
          }
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [utils, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100" />}>
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-stone-950" />
        )}
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-[380px] p-0 shadow-lg border-stone-200 dark:border-stone-800">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800/50">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {count > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => markAllAsRead.mutate()}
              className="text-xs h-auto py-1 px-2 text-stone-500 hover:text-coral-600"
              disabled={markAllAsRead.isPending}
            >
              {markAllAsRead.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              Mark all read
            </Button>
          )}
        </div>
        
        <div className="max-h-[70vh] overflow-y-auto">
           {isLoading ? (
             <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-stone-300" /></div>
           ) : !notifications || notifications.length === 0 ? (
             <div className="px-4 py-8 text-center text-sm text-stone-500 italic">No new notifications.</div>
           ) : (
             <div className="divide-y divide-stone-100 dark:divide-stone-800/50">
               {notifications.map(notification => (
                 <div 
                   key={notification.id} 
                   onClick={() => handleNotificationClick(notification.id, notification.link)}
                   className={`p-4 hover:bg-stone-50 dark:hover:bg-stone-900/50 transition-colors cursor-pointer flex gap-3 ${!notification.isRead ? 'bg-coral-50/30 dark:bg-coral-950/20' : ''}`}
                 >
                   <div className="mt-0.5 mt-1 shrink-0">
                      {notification.isRead ? 
                         <Check className="h-4 w-4 text-stone-300 dark:text-stone-700" /> : 
                         <CircleDot className="h-4 w-4 text-coral-500" />
                      }
                   </div>
                   <div className="flex-1 space-y-1">
                     <p className={`text-sm ${!notification.isRead ? 'font-medium text-stone-900 dark:text-stone-100' : 'text-stone-600 dark:text-stone-400'}`}>
                       {notification.title}
                     </p>
                     {notification.body && (
                        <p className="text-xs text-stone-500 line-clamp-2">{notification.body}</p>
                     )}
                     <p className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 pt-1">
                       {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                     </p>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
