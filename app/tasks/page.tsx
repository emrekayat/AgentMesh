"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Clock, CheckCircle, XCircle, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, relativeTime } from "@/lib/utils";
import type { Task } from "@/lib/types";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => {
        setTasks(d.tasks ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const interval = setInterval(() => {
      fetch("/api/tasks")
        .then((r) => r.json())
        .then((d) => setTasks(d.tasks ?? []))
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-foreground-muted mt-1">
            Agent coordination runs on the AXL mesh
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard">
            <Plus className="h-4 w-4 mr-1.5" />
            New task
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-foreground-muted" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <p className="text-foreground-muted">No tasks yet.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Submit your first task</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link href={`/tasks/${task.id}`}>
                <div className="group flex items-center gap-4 rounded-xl border border-border/60 bg-surface/40 px-4 py-3.5 hover:border-border hover:bg-surface/70 transition-all">
                  <StatusIcon status={task.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-foreground-muted mt-0.5 truncate">{task.prompt}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={task.status} />
                    <span className="text-xs text-foreground-dim">{relativeTime(task.createdAt)}</span>
                    <ArrowRight className="h-4 w-4 text-foreground-dim opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: Task["status"] }) {
  if (status === "execution-complete")
    return <CheckCircle className="h-4 w-4 text-success shrink-0" />;
  if (status === "failed")
    return <XCircle className="h-4 w-4 text-danger shrink-0" />;
  if (status === "submitted")
    return <Clock className="h-4 w-4 text-foreground-dim shrink-0" />;
  return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />;
}

function StatusBadge({ status }: { status: Task["status"] }) {
  if (status === "execution-complete")
    return <Badge variant="success" className="text-xs">complete</Badge>;
  if (status === "failed")
    return <Badge variant="danger" className="text-xs">failed</Badge>;
  return <Badge variant="outline" className="text-xs capitalize">{status}</Badge>;
}
