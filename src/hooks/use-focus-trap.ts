"use client";

import { useEffect, type RefObject } from "react";

/**
 * Trap keyboard focus within an element (for dialogs/modals).
 *
 * - On mount, moves focus into the container (first focusable or the container).
 * - On Tab/Shift+Tab, cycles focus within the container's focusable elements.
 * - On unmount, restores focus to the previously-focused element.
 *
 * Usage: attach the ref to your dialog's content container.
 */
export function useFocusTrap<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean
) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const container = ref.current;

    // Remember the previously focused element to restore on unmount.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focusable element selector.
    const FOCUSABLE = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "textarea:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    function getFocusable(): HTMLElement[] {
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
    }

    // Move focus into the container on open.
    const focusable = getFocusable();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      container.setAttribute("tabindex", "-1");
      container.focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const els = getFocusable();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const activeEl = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (activeEl === last || !container.contains(activeEl)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      container.removeAttribute("tabindex");
      // Restore focus to the previously focused element.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        try {
          previouslyFocused.focus();
        } catch {
          // ignore
        }
      }
    };
  }, [ref, active]);
}
