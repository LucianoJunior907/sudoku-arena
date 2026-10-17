"use client";

import { useMemo, useState } from "react";
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
import { encodeBoard, decodeBoard, buildShareUrl } from "@/lib/sudoku/share";
import { solve } from "@/lib/sudoku/engine";
import type { Board, Difficulty } from "@/lib/sudoku/types";
import { Copy, Check, Link2, Share2, ClipboardPaste, Play } from "lucide-react";
import { toast } from "sonner";

interface ShareBoardDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  puzzle: Board;
  difficulty: Difficulty;
}

export function ShareBoardDialog({ open, onOpenChange, puzzle, difficulty }: ShareBoardDialogProps) {
  const { t } = useI18n();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const code = useMemo(() => encodeBoard(puzzle, difficulty), [puzzle, difficulty]);
  const url = useMemo(() => (open ? buildShareUrl(code) : ""), [open, code]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      toast.success(t("solo.shareCopied"));
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      toast.success(t("solo.shareCopied"));
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Share2 className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{t("solo.shareTitle")}</DialogTitle>
          <DialogDescription className="text-center">{t("solo.shareDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t("solo.shareCode")}
            </Label>
            <div className="flex gap-2">
              <Input readOnly value={code} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyCode} aria-label="Copy code">
                {copiedCode ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t("solo.shareUrl")}
            </Label>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyUrl} aria-label="Copy link">
                {copiedUrl ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Link2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LoadSharedBoardDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLoad: (puzzle: Board, solution: Board, difficulty: Difficulty) => void;
}

export function LoadSharedBoardDialog({ open, onOpenChange, onLoad }: LoadSharedBoardDialogProps) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleLoad = () => {
    const decoded = decodeBoard(code);
    if (!decoded) {
      setError(true);
      return;
    }
    const solution = solve(decoded.puzzle);
    if (!solution) {
      setError(true);
      return;
    }
    setError(false);
    onLoad(decoded.puzzle, solution, decoded.difficulty);
    onOpenChange(false);
    setCode("");
    toast.success(t("solo.sharedLoaded"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardPaste className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{t("solo.sharedTitle")}</DialogTitle>
          <DialogDescription className="text-center">{t("solo.sharedPrompt")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(false);
            }}
            placeholder="SA1E..."
            className="font-mono text-xs uppercase"
            aria-invalid={error}
          />
          {error && (
            <p className="text-xs text-[var(--destructive)]">{t("solo.sharedInvalid")}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleLoad} disabled={!code.trim()} className="gap-1.5">
            <Play className="h-4 w-4" />
            {t("solo.start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
