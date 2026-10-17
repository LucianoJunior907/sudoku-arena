"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/context";
import { Keyboard } from "lucide-react";

interface ShortcutHelpDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface ShortcutRow {
  keys: string[];
  labelKey: "shortcut.placeNumber" | "shortcut.erase" | "shortcut.notes" | "shortcut.hint" | "shortcut.autoNotes" | "shortcut.check" | "shortcut.pause" | "shortcut.undo" | "shortcut.redo" | "shortcut.move" | "shortcut.help" | "shortcut.cycleView";
}

const ROWS: ShortcutRow[] = [
  { keys: ["1", "-", "9"], labelKey: "shortcut.placeNumber" },
  { keys: ["Backspace"], labelKey: "shortcut.erase" },
  { keys: ["N"], labelKey: "shortcut.notes" },
  { keys: ["H"], labelKey: "shortcut.hint" },
  { keys: ["A"], labelKey: "shortcut.autoNotes" },
  { keys: ["C"], labelKey: "shortcut.check" },
  { keys: ["P"], labelKey: "shortcut.pause" },
  { keys: ["Ctrl", "Z"], labelKey: "shortcut.undo" },
  { keys: ["Ctrl", "Shift", "Z"], labelKey: "shortcut.redo" },
  { keys: ["↑", "↓", "←", "→"], labelKey: "shortcut.move" },
  { keys: ["Alt", "←", "→"], labelKey: "shortcut.cycleView" },
  { keys: ["?"], labelKey: "shortcut.help" },
];

export function ShortcutHelpDialog({ open, onOpenChange }: ShortcutHelpDialogProps) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
            <Keyboard className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{t("solo.shortcutHelp")}</DialogTitle>
          <DialogDescription className="text-center">{t("solo.shortcutHelpDesc")}</DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-1.5">
          {ROWS.map((row, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/40"
            >
              <span className="text-sm text-foreground/90">{t(row.labelKey)}</span>
              <div className="flex items-center gap-1">
                {row.keys.map((k, j) => (
                  <kbd
                    key={j}
                    className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-mono text-xs font-semibold text-foreground shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
