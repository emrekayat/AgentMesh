"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export function SplashScreen() {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 900);
    const t2 = setTimeout(() => setPhase("out"), 4000);
    const t3 = setTimeout(() => setMounted(false), 4700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <AnimatePresence>
      {mounted && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          style={{ background: "#070709" }}
          animate={phase === "out" ? { opacity: 0 } : { opacity: 1 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          {/* background grid */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />

          {/* deep radial glow behind logo */}
          <motion.div
            className="absolute rounded-full"
            style={{ background: "radial-gradient(circle, #6366f133 0%, #818cf810 40%, transparent 70%)" }}
            initial={{ width: 300, height: 300, opacity: 0 }}
            animate={
              phase === "in"
                ? { width: 700, height: 700, opacity: 1 }
                : phase === "hold"
                ? { width: 760, height: 760, opacity: 1 }
                : { width: 900, height: 900, opacity: 0 }
            }
            transition={{ duration: 1.4, ease: "easeOut" }}
          />

          {/* ping ring 1 */}
          <motion.div
            className="absolute rounded-full border-2 border-indigo-500/30"
            initial={{ width: 320, height: 320, opacity: 0 }}
            animate={{ width: 600, height: 600, opacity: [0, 0.7, 0] }}
            transition={{ duration: 2.2, ease: "easeOut", repeat: Infinity, delay: 0.3 }}
          />

          {/* ping ring 2 */}
          <motion.div
            className="absolute rounded-full border border-indigo-400/15"
            initial={{ width: 320, height: 320, opacity: 0 }}
            animate={{ width: 800, height: 800, opacity: [0, 0.4, 0] }}
            transition={{ duration: 2.2, ease: "easeOut", repeat: Infinity, delay: 0.9 }}
          />

          {/* ping ring 3 — slow outer */}
          <motion.div
            className="absolute rounded-full border border-violet-500/10"
            initial={{ width: 320, height: 320, opacity: 0 }}
            animate={{ width: 1000, height: 1000, opacity: [0, 0.25, 0] }}
            transition={{ duration: 2.8, ease: "easeOut", repeat: Infinity, delay: 1.4 }}
          />

          {/* content — shifted up */}
          <motion.div
            className="relative flex flex-col items-center gap-8"
            style={{ marginTop: "-80px" }}
            initial={{ opacity: 0, scale: 0.55, y: 30 }}
            animate={
              phase === "in"
                ? { opacity: 1, scale: 1, y: 0 }
                : phase === "out"
                ? { opacity: 0, scale: 1.1, y: -16 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            transition={{
              duration: phase === "in" ? 0.75 : 0.6,
              ease: phase === "in" ? [0.16, 1, 0.3, 1] : "easeInOut",
            }}
          >
            {/* logo */}
            <motion.div
              className="rounded-3xl overflow-hidden"
              animate={{
                boxShadow: [
                  "0 0 50px #6366f140, 0 0 100px #6366f120, 0 24px 80px #00000080",
                  "0 0 90px #6366f170, 0 0 180px #6366f140, 0 24px 80px #00000080",
                  "0 0 50px #6366f140, 0 0 100px #6366f120, 0 24px 80px #00000080",
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src="/AgentMesh.jpg"
                alt="AgentMesh"
                width={300}
                height={300}
                priority
              />
            </motion.div>

            {/* text */}
            <motion.div
              className="flex flex-col items-center gap-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.5 }}
            >
              <span className="font-mono text-2xl tracking-[0.35em] text-white/90 uppercase">
                AgentMesh
              </span>
              <motion.span
                className="font-mono text-xs tracking-[0.25em] text-white/35 uppercase"
                animate={{ opacity: [0.35, 0.65, 0.35] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                ENS · AXL · KeeperHub
              </motion.span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
