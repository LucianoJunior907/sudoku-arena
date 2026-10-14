"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Eraser, Pencil, Lightbulb, Undo2, Redo2 } from "lucide-react";

interface NumberPadProps {
  valueCounts: number[];
  notesMode: boolean;
  onNumber: (n: number) => void;
  onErase: () => void;
  onToggleNotes: () => void;
  onHint: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hintsLeft: number;
  selectedValue: number;
}

export function NumberPad({
  valueCounts,
  notesMode,
  onNumber,
  onErase,
  onToggleNotes,
  onHint,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  hintsLeft,
  selectedValue,
}: NumberPadProps) {
  return (
    <div className="w-full space-y-2">
      {/* numbers */}
      <div className="grid grid-cols-9 gap-1.5 sm:gap-2">
        {Array.from({ length: 9 }, (_, i) => {
          const n = i + 1;
          const remaining = 9 - valueCounts[n];
          const exhausted = remaining <= 0;
          const isActive = selectedValue === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onNumber(n)}
              disabled={exhausted && !notesMode}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg border text-lg font-bold transition-all sm:text-xl",
                "border-border bg-card hover:border-primary/50 hover:bg-primary/5",
                isActive && "border-primary bg-primary/10 text-primary",
                exhausted && !notesMode && "opacity-30",
                notesMode && "border-dashed"
              )}
            >
              {n}
              {remaining > 0 && (
                <span className="absolute -bottom-0.5 right-0.5 text-[9px] font-normal text-muted-foreground">
                  {remaining}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* actions */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        <ActionButton onClick={onUndo} disabled={!canUndo} label="Undo" title="Desfazer">
          <Undo2 className="h-4 w-4" />
        </ActionButton>
        <ActionButton onClick={onRedo} disabled={!canRedo} label="Redo" title="Refazer">
          <Redo2 className="h-4 w-4" />
        </ActionButton>
        <ActionButton
          onClick={onErase}
          label="Erase"
          title="Apagar"
        >
          <Eraser className="h-4 w-4" />
        </ActionButton>
        <ActionButton
          onClick={onToggleNotes}
          label="Notes"
          title="Anotações"
          active={notesMode}
        >
          <Pencil className="h-4 w-4" />
        </ActionButton>
        <ActionButton
          onClick={onHint}
          disabled={hintsLeft <= 0}
          label="Hint"
          title={`Dica (${hintsLeft})`}
        >
          <Lightbulb className="h-4 w-4" />
          {hintsLeft > 0 && (
            <span className="ml-0.5 text-[10px] font-bold">{hintsLeft}</span>
          )}
        </ActionButton>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  label,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  title: string;
  active?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      className="h-11 flex-col gap-0.5"
    >
      {children}
    </Button>
  );
}
