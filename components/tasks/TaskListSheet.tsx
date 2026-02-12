"use client";

import { useEffect, useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { supabase } from "@/lib/supabase/client";
import { TaskItem, Task } from "./TaskItem";
import { CreateTaskForm } from "./CreateTaskForm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface TaskListSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tripId: string;
}

export function TaskListSheet({ open, onOpenChange, tripId }: TaskListSheetProps) {
    const { t } = useI18n();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            // First, fetch all tasks
            const { data: tasksData, error: tasksError } = await (supabase
                .from('tasks') as any)
                .select('*')
                .eq('trip_id', tripId)
                .order('created_at', { ascending: false });

            if (tasksError) {
                console.error("Error fetching tasks:", tasksError);
                toast.error(t('common.error'));
                setTasks([]);
                return;
            }

            // Get unique assigned_to IDs (excluding null)
            const assignedIds = Array.from(
                new Set(
                    (tasksData as any[] || [])
                        .map(t => t.assigned_to)
                        .filter(Boolean)
                )
            ) as string[];

            // Fetch user profiles for assigned users
            let profilesMap: Record<string, any> = {};
            if (assignedIds.length > 0) {
                const { data: profilesData, error: profilesError } = await (supabase
                    .from('user_profiles') as any)
                    .select('user_id, display_name, email')
                    .in('user_id', assignedIds);

                if (profilesError) {
                    console.error("Error fetching profiles:", profilesError, "IDs:", assignedIds);
                } else {
                    profilesMap = Object.fromEntries(
                        (profilesData || []).map((p: any) => [p.user_id, p])
                    );
                }
            }

            // Merge tasks with profiles
            const tasksWithProfiles = (tasksData as any[] || []).map(task => ({
                ...task,
                assigned_user: task.assigned_to ? profilesMap[task.assigned_to] || null : null
            }));

            setTasks(tasksWithProfiles as Task[]);
        } catch (error) {
            console.error(error);
            toast.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchTasks();
            setIsCreating(false);
        }
    }, [open, tripId]);


    const handleTaskCreated = () => {
        setIsCreating(false);
        fetchTasks();
    };

    const handleTaskUpdated = () => {
        fetchTasks();
    };

    // Group tasks by status
    const todoTasks = tasks.filter(t => t.status === 'todo');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const doneTasks = tasks.filter(t => t.status === 'done');

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md flex flex-col h-full bg-background">
                <SheetHeader>
                    <SheetTitle>{t('tasks.title')}</SheetTitle>
                    <SheetDescription className="hidden">{t('tasks.title')}</SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-hidden flex flex-col mt-6">
                    {isCreating ? (
                        <CreateTaskForm
                            tripId={tripId}
                            onCancel={() => setIsCreating(false)}
                            onSuccess={handleTaskCreated}
                        />
                    ) : (
                        <>
                            <div className="mb-4">
                                <Button
                                    className="w-full justify-start border-dashed border-2 bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground h-12"
                                    variant="outline"
                                    onClick={() => setIsCreating(true)}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    {t('tasks.new')}
                                </Button>
                            </div>

                            <ScrollArea className="flex-1 -mr-6 pr-6">
                                {tasks.length === 0 && !loading && (
                                    <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center h-full">
                                        <div className="mb-3 p-4 bg-muted/50 rounded-full">
                                            <Plus className="h-6 w-6 opacity-50" />
                                        </div>
                                        <p>{t('tasks.empty')}</p>
                                    </div>
                                )}

                                {loading ? (
                                    <div className="space-y-4">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-24 w-full bg-muted/40 animate-pulse rounded-lg" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-6 pb-6">
                                        {[
                                            { id: 'todo', label: t('tasks.todo'), items: todoTasks, color: 'bg-primary' },
                                            { id: 'in_progress', label: t('tasks.in_progress'), items: inProgressTasks, color: 'bg-orange-500' },
                                            { id: 'done', label: t('tasks.done'), items: doneTasks, color: 'bg-green-500' }
                                        ].map(group => (
                                            group.items.length > 0 && (
                                                <div key={group.id}>
                                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${group.color}`} />
                                                        {group.label}
                                                        <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{group.items.length}</span>
                                                    </h3>
                                                    <div className="space-y-3">
                                                        {group.items.map(task => (
                                                            <TaskItem key={task.id} task={task} onUpdate={handleTaskUpdated} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
