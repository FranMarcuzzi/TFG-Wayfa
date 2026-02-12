"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, Clock, Loader2, MoreHorizontal, Trash, User as UserIcon } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface Task {
    id: string;
    trip_id: string;
    title: string;
    description: string | null;
    status: 'todo' | 'in_progress' | 'done';
    assigned_to: string | null;
    created_by: string;
    created_at: string;
    assigned_user?: {
        display_name: string | null;
        email: string | null;
    } | null | any; // Type 'any' because supabase return type structure can vary based on query
}

interface TaskItemProps {
    task: Task;
    onUpdate: () => void;
}

export function TaskItem({ task, onUpdate }: TaskItemProps) {
    const { t } = useI18n();
    const [updating, setUpdating] = useState(false);

    const updateStatus = async (status: Task['status']) => {
        if (status === task.status) return;
        setUpdating(true);
        try {
            const { error } = await supabase
                .from('tasks')
                .update({ status })
                .eq('id', task.id);

            if (error) throw error;
            onUpdate();
            toast({ title: t('tasks.update.success') });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: t('tasks.update.failed') });
        } finally {
            setUpdating(false);
        }
    };

    const deleteTask = async () => {
        toast({
            title: t('tasks.delete'),
            description: t('tasks.delete.confirm'),
            action: (
                <ToastAction
                    altText={t('common.delete')}
                    onClick={async () => {
                        setUpdating(true);
                        try {
                            const { error } = await supabase
                                .from('tasks')
                                .delete()
                                .eq('id', task.id);

                            if (error) throw error;
                            onUpdate();
                            toast({ title: t('tasks.delete.success') });
                        } catch (error) {
                            console.error(error);
                            toast({ variant: 'destructive', title: t('tasks.delete.failed') });
                        } finally {
                            setUpdating(false);
                        }
                    }}
                >
                    {t('common.delete')}
                </ToastAction>
            ),
        });
    };

    // Helper to get initials
    const getInitials = (name?: string | null) => {
        if (!name) return "?";
        return name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
    };

    const assigneeName = task.assigned_user?.display_name || task.assigned_user?.email || null;

    return (
        <div className={cn(
            "group relative rounded-xl border bg-card p-4 transition-all hover:shadow-md",
            updating && "opacity-60 pointer-events-none"
        )}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className={cn(
                        "font-medium leading-none mb-1.5 transition-colors",
                        task.status === 'done' && "text-muted-foreground line-through decoration-muted-foreground/50"
                    )}>
                        {task.title}
                    </p>
                    {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {task.description}
                        </p>
                    )}

                    <div className="flex items-center gap-3 mt-2">
                        {/* Assignee Badge */}
                        {task.assigned_to ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                                <Avatar className="h-4 w-4">
                                    <AvatarFallback className="text-[8px]">{getInitials(assigneeName)}</AvatarFallback>
                                </Avatar>
                                <span className="max-w-[80px] truncate">{assigneeName || 'User'}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50 px-2 py-1 rounded-md border border-dashed border-muted">
                                <UserIcon className="h-3 w-3" />
                                <span>{t('tasks.form.unassigned')}</span>
                            </div>
                        )}

                        {/* Date */}
                        <div className="text-[10px] text-muted-foreground/60 ml-auto">
                            {format(new Date(task.created_at), 'MMM d')}
                        </div>
                    </div>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="text-muted-foreground/50 hover:text-foreground p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>{t('common.edit')}</DropdownMenuLabel>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                <DropdownMenuCheckboxItem
                                    checked={task.status === 'todo'}
                                    onCheckedChange={() => updateStatus('todo')}
                                >
                                    {t('tasks.todo')}
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={task.status === 'in_progress'}
                                    onCheckedChange={() => updateStatus('in_progress')}
                                >
                                    {t('tasks.in_progress')}
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={task.status === 'done'}
                                    onCheckedChange={() => updateStatus('done')}
                                >
                                    {t('tasks.done')}
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={deleteTask}
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                            <Trash className="mr-2 h-4 w-4" />
                            {t('common.delete')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {updating && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[1px] rounded-xl">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
            )}
        </div>
    );
}
