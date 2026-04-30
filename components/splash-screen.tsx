"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export function SplashScreen() {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 800);
    const t2 = setTimeout(() => setPhase("out"), 2000);
    const t3 = setTimeout(() => setMounted(false), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <AnimatePresence>
      {mounted && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          style={{ background: "#080808" }}
          animate={phase === "out" ? { opacity: 0 } : { opacity: 1 }}
          transition={{ duration: 0.55, ease: "easeInOut" }}
        >
          {/* background grid */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          {/* outer glow ring */}
          <motion.div
            className="absolute rounded-full"
            style={{ background: "radial-gradient(circle, #6366f122 0%, transparent 70%)" }}
            initial={{ width: 200, height: 200, opacity: 0 }}
            animate={
              phase === "in"
                ? { width: 500, height: 500, opacity: 1 }
                : phase === "hold"
                ? { width: 540, height: 540, opacity: 0.8 }
                : { width: 700, height: 700, opacity: 0 }
            }
            transition={{ duration: 1.2, ease: "easeOut" }}
          />

          {/* ping ring 1 */}
          <motion.div
            className="absolute rounded-full border border-indigo-500/20"
            initial={{ width: 280, height: 280, opacity: 0 }}
            animate={{ width: 480, height: 480, opacity: [0, 0.5, 0] }}
            transition={{ duration: 2, ease: "easeOut", repeat: Infinity, delay: 0.4 }}
          />

          {/* ping ring 2 */}
          <motion.div
            className="absolute rounded-full border border-indigo-400/10"
            initial={{ width: 280, height: 280, opacity: 0 }}
            animate={{ width: 600, height: 600, opacity: [0, 0.3, 0] }}
            transition={{ duration: 2, ease: "easeOut", repeat: Infinity, delay: 0.9 }}
          />

          {/* logo */}
          <motion.div
            className="relative flex flex-col items-center gap-7"
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={
              phase === "in"
                ? { opacity: 1, scale: 1, y: 0 }
                : phase === "out"
                ? { opacity: 0, scale: 1.08, y: -10 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            transition={{
              duration: phase === "in" ? 0.7 : 0.55,
              ease: phase === "in" ? [0.16, 1, 0.3, 1] : "easeInOut",
            }}
          >
            <motion.div
              className="rounded-3xl overflow-hidden shadow-2xl"
              style={{ boxShadow: "0 0 60px #6366f140, 0 0 120px #6366f120" }}
              animate={{ boxShadow: [
                "0 0 40px #6366f130, 0 0 80px #6366f110",
                "0 0 70px #6366f150, 0 0 140px #6366f130",
                "0 0 40px #6366f130, 0 0 80px #6366f110",
              ]}}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src="/AgentMesh.jpg"
                alt="AgentMesh"
                width={280}
                height={280}
                priority
              />
            </motion.div>

            <motion.div
              className="flex flex-col items-center gap-1.5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <span className="font-mono text-xl tracking-[0.3em] text-white/90 uppercase">
                AgentMesh
              </span>
              <span className="font-mono text-xs tracking-[0.2em] text-white/30 uppercase">
                ENS · AXL · KeeperHub
              </span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
