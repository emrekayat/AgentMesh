"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center gap-5"
          >
            <motion.div
              animate={{ boxShadow: ["0 0 0px #6366f100", "0 0 48px #6366f144", "0 0 0px #6366f100"] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-2xl overflow-hidden"
            >
              <Image
                src="/AgentMesh.jpg"
                alt="AgentMesh"
                width={260}
                height={260}
                priority
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="font-mono text-lg tracking-widest text-foreground-muted uppercase"
            >
              agent<span className="text-foreground-dim">/</span>mesh
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
