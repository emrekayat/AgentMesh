"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Cpu,
  FileSearch,
  Loader2,
  Shield,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TaskCategory, Task } from "@/lib/types";

const CATEGORIES: { value: TaskCategory; label: string; description: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  {
    value: "research",
    label: "Research",
    description: "Gather context and summarize findings",
    Icon: FileSearch,
  },
  {
    value: "risk-analysis",
    label: "Risk Analysis",
    description: "Evaluate and score an opportunity or action",
    Icon: Shield,
  },
  {
    value: "wallet-monitoring",
    label: "Wallet Monitoring",
    description: "Watch an address for onchain activity",
    Icon: Wallet,
  },
  {
    value: "execution-request",
    label: "Execution Request",
    description: "Research → risk → execute onchain if approved",
    Icon: TrendingUp,
  },
];

const STATUS_COLORS: Record<Task["status"], string> = {
  submitted: "info",
  discovering: "ens",
  coordinating: "gensyn",
  "execution-pending": "warning",
  "execution-complete": "success",
  failed: "danger",
} as const;

export default function DashboardPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<TaskCategory>("execution-request");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, prompt, category }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed");
      }
      const { task } = await res.json();
      router.push(`/tasks/${task.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Submit a task and watch agents discover, coordinate, and execute it.
        </p>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Task form */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.06 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-ens" />
                New task
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="ETH/USDC opportunity — execute small swap if risk acceptable"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    minLength={4}
                    maxLength={120}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(({ value, label, description, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCategory(value)}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3 text-left transition",
                          category === value
                            ? "border-ens/60 bg-ens-soft"
                            : "border-border bg-card-elevated hover:border-border-strong"
                        )}
                      >
                        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", category === value ? "text-ens" : "text-foreground-muted")} />
                        <div>
                          <div className={cn("text-xs font-medium", category === value ? "text-ens" : "text-foreground")}>
                            {label}
                          </div>
                          <div className="mt-0.5 text-[11px] text-foreground-dim">{description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">Task prompt</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe the task in detail. Include any specific parameters, thresholds, or constraints for the agents."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    required
                    minLength={8}
                    maxLength={2000}
                    className="min-h-[140px]"
                  />
                  <div className="text-right text-[11px] text-foreground-dim">{prompt.length} / 2000</div>
                </div>

                {error && (
                  <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  variant="primary"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  {submitting ? "Dispatching…" : "Dispatch to agents"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sidebar: recent + example */}
        <div className="space-y-5">
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.12 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-gensyn" />
                  Demo task
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-foreground-muted">
                  See the full coordination flow with all 3 agents — pre-run and annotated.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <a href="/tasks/demo">
                    View demo task
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.18 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pipeline overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { step: "01", label: "ENS discovery", badge: "ens" as const, desc: "Agents resolved by subname text records" },
                  { step: "02", label: "AXL coordination", badge: "gensyn" as const, desc: "A2A delegation across 3 real mesh nodes" },
                  { step: "03", label: "KeeperHub execution", badge: "keeperhub" as const, desc: "Workflow fires onchain on Base Sepolia" },
                  { step: "04", label: "Audit subname", badge: "ens" as const, desc: "task-*.tasks.agentbazaar.eth minted" },
                ].map(({ step, label, badge, desc }) => (
                  <div key={step} className="flex items-start gap-3">
                    <span className="font-mono text-[10px] text-foreground-dim mt-0.5 w-5 shrink-0">{step}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{label}</span>
                        <Badge variant={badge} className="text-[9px]">{badge}</Badge>
                      </div>
                      <p className="text-[11px] text-foreground-dim mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
