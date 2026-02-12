"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useI18n } from "@/components/i18n/I18nProvider";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
    title: z.string().min(1, { message: "Required" }),
    description: z.string().optional(),
    assigned_to: z.string().min(1, { message: "Required" }), // uuid
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTaskFormProps {
    tripId: string;
    onCancel: () => void;
    onSuccess: () => void;
}

interface Member {
    user_id: string;
    role: string;
    profile?: {
        display_name?: string | null;
        email?: string | null;
    } | null;
}

export function CreateTaskForm({ tripId, onCancel, onSuccess }: CreateTaskFormProps) {
    const { t } = useI18n();
    const [loading, setLoading] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            description: "",
            assigned_to: "",
        },
    });

    // Fetch trip members for assignment
    useEffect(() => {
        const fetchMembers = async () => {
            if (!tripId) {
                setMembers([]);
                return;
            }
            setMembersLoading(true);
            try {
                const { data, error } = await supabase
                    .from('trip_members')
                    .select(`
                        user_id,
                        role,
                        user_profiles (display_name, email)
                    `)
                    .eq('trip_id', tripId);

                if (error) {
                    console.error("Error fetching members:", error);
                    setMembers([]);
                } else {
                    const rows = (data as any[] || []).map((row) => ({
                        user_id: row.user_id,
                        role: row.role,
                        profile: row.user_profiles || null,
                    }));
                    setMembers(rows);
                    // Auto-select first member if none selected
                    if (!form.getValues('assigned_to') && rows.length > 0) {
                        form.setValue('assigned_to', rows[0].user_id);
                    }
                }
            } catch (e) {
                console.error(e);
                setMembers([]);
            } finally {
                setMembersLoading(false);
            }
        };

        fetchMembers();
    }, [tripId]);

    const onSubmit = async (values: FormValues) => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const assignedTo = values.assigned_to;
            if (!assignedTo) {
                toast.error(t('tasks.form.assignedRequired'));
                return;
            }

            const { error } = await supabase
                .from('tasks')
                .insert({
                    trip_id: tripId,
                    title: values.title,
                    description: values.description || null,
                    assigned_to: assignedTo,
                    created_by: user.id,
                    status: 'todo'
                });

            if (error) throw error;
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error(t('tasks.create.failed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-1">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('tasks.form.title')}</FormLabel>
                            <FormControl>
                                <Input placeholder={t('tasks.form.title')} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('tasks.form.description')}</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder={t('tasks.form.description')}
                                    className="resize-none min-h-[80px]"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="assigned_to"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('tasks.form.assignedTo')}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('tasks.form.assignedTo')} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {membersLoading && (
                                        <SelectItem value="__loading" disabled>
                                            {t('tasks.form.loadingMembers')}
                                        </SelectItem>
                                    )}
                                    {!membersLoading && members.length === 0 && (
                                        <SelectItem value="__empty" disabled>
                                            {t('tasks.form.noMembers')}
                                        </SelectItem>
                                    )}
                                    {members.map((member) => {
                                        const name = member.profile?.display_name || member.profile?.email || t('common.unknown');
                                        return (
                                            <SelectItem key={member.user_id} value={member.user_id}>
                                                {name}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex items-center gap-2 pt-2">
                    <Button type="button" variant="ghost" className="flex-1" onClick={onCancel} disabled={loading}>
                        {t('tasks.cancel')}
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('tasks.create')}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
