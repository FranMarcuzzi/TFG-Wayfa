"use client";

import { useState } from "react";
import { ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskListSheet } from "./TaskListSheet";

interface TaskFloatingButtonProps {
    tripId: string;
}

export function TaskFloatingButton({ tripId }: TaskFloatingButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                size="icon"
                className="fixed bottom-6 left-6 h-14 w-14 rounded-full shadow-lg z-40 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setOpen(true)}
            >
                <ListTodo className="h-6 w-6" />
            </Button>

            <TaskListSheet open={open} onOpenChange={setOpen} tripId={tripId} />
        </>
    );
}
