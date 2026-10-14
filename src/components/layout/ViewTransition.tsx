"use client";

import { motion, AnimatePresence } from "framer-motion";
import { type ReactNode } from "react";

/**
 * Animated wrapper for view transitions.
 * Uses a key on `routeKey` so AnimatePresence detects the change and
 * animates out the old view while animating in the new one.
 */
export function ViewTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="min-h-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
