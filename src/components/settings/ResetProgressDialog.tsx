"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/context";
import { AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResetProgressDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}

export function ResetProgressDialog({ open, onOpenChange, onConfirm }: ResetProgressDialogProps) {
  const { t, locale } = useI18n();
  const confirmWord = locale === "pt-BR" ? "APAGAR" : "DELETE";
  // The inner component is keyed by `open` so its state resets each open.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ResetForm
          key={String(open)}
          confirmWord={confirmWord}
          t={t}
          onCancel={() => onOpenChange(false)}
          onConfirm={() => {
            onConfirm();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function ResetForm({
  confirmWord,
  t,
  onCancel,
  onConfirm,
}: {
  confirmWord: string;
  t: (k: import("@/lib/i18n/translations").TranslationKey) => string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const matches = value.trim().toUpperCase() === confirmWord;
  const showMismatch = touched && !matches;

  return (
    <>
      <DialogHeader>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-sm bg-[var(--destructive)]/10">
          <AlertTriangle className="h-6 w-6 text-[var(--destructive)]" />
        </div>
        <DialogTitle className="text-center text-[var(--destructive)]">{t("settings.resetTitle")}</DialogTitle>
        <DialogDescription className="text-center">{t("settings.resetDesc")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-2 py-2">
        <Label htmlFor="confirm-word" className="text-sm font-medium">
          {t("settings.resetConfirm")}
        </Label>
        <Input
          id="confirm-word"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={confirmWord}
          className={cn(
            "font-mono uppercase tracking-widest",
            showMismatch && "border-[var(--destructive)] focus-visible:ring-[var(--destructive)]",
            matches && "border-[var(--success)] focus-visible:ring-[var(--success)]"
          )}
          aria-describedby="confirm-help"
          autoFocus
        />
        {showMismatch && (
          <p id="confirm-help" className="text-xs text-[var(--destructive)]">
            {t("settings.resetMismatch")}
          </p>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          disabled={!matches}
          className="gap-1.5"
        >
          <Trash2 className="h-4 w-4" />
          {t("settings.resetButton")}
        </Button>
      </DialogFooter>
    </>
  );
}
