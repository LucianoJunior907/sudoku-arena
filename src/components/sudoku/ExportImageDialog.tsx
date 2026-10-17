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
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/context";
import { useTheme } from "next-themes";
import { boardToDataUrl, downloadBoardImage, copyBoardImage } from "@/lib/sudoku/board-image";
import type { Board, Notes } from "@/lib/sudoku/types";
import { Download, Copy, Check, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface ExportImageDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  board: Board;
  notes: Notes;
  given: boolean[];
  title?: string;
  subtitle?: string;
}

export function ExportImageDialog({
  open,
  onOpenChange,
  board,
  notes,
  given,
  title,
  subtitle,
}: ExportImageDialogProps) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const [copied, setCopied] = useState(false);

  const preview = useMemo(() => {
    if (!open) return "";
    return boardToDataUrl(board, notes, given, {
      title,
      subtitle,
      theme: resolvedTheme === "dark" ? "dark" : "light",
    });
  }, [open, board, notes, given, title, subtitle, resolvedTheme]);

  const handleDownload = () => {
    downloadBoardImage(board, notes, given, {
      title,
      subtitle,
      theme: resolvedTheme === "dark" ? "dark" : "light",
      filename: `sudoku-arena-${Date.now()}.png`,
    });
  };

  const handleCopy = async () => {
    const ok = await copyBoardImage(board, notes, given, {
      title,
      subtitle,
      theme: resolvedTheme === "dark" ? "dark" : "light",
    });
    if (ok) {
      setCopied(true);
      toast.success(t("solo.imageCopied"));
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Copy failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
            <ImageIcon className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{t("solo.exportImage")}</DialogTitle>
          <DialogDescription className="text-center">{t("solo.exportImageDesc")}</DialogDescription>
        </DialogHeader>

        {preview && (
          <div className="flex justify-center py-2">
            <img
              src={preview}
              alt="Board preview"
              className="max-h-64 rounded-sm border shadow-sm"
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleCopy} className="gap-1.5">
            {copied ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Copy className="h-4 w-4" />}
            {t("solo.copyImage")}
          </Button>
          <Button onClick={handleDownload} className="gap-1.5">
            <Download className="h-4 w-4" />
            {t("solo.downloadImage")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
