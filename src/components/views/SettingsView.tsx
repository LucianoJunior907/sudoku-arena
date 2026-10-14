"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { BOARD_THEMES } from "@/lib/progression/board-themes";
import { ResetProgressDialog } from "@/components/settings/ResetProgressDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Sun,
  Moon,
  Monitor,
  Globe,
  Volume2,
  CheckCircle2,
  Download,
  Upload,
  Trash2,
  Info,
} from "lucide-react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/translations";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const { t, locale, setLocale } = useI18n();
  const settings = useAppStore((s) => s.settings);
  const [resetOpen, setResetOpen] = useState(false);
  const setSettings = useAppStore((s) => s.setSettings);
  const clearAllData = useAppStore((s) => s.clearAllData);
  const exportData = useAppStore((s) => s.exportData);
  const importData = useAppStore((s) => s.importData);
  const { theme, setTheme } = useTheme();

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sudoku-arena-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("settings.dataExported"));
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const ok = importData(String(reader.result));
        if (ok) toast.success(t("settings.dataImported"));
        else toast.error("Import failed");
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleClear = () => {
    setResetOpen(true);
  };

  const handleResetConfirm = () => {
    clearAllData();
    toast.success(t("settings.dataCleared"));
    setTimeout(() => window.location.reload(), 600);
  };

  const themes = [
    { id: "light" as const, icon: Sun, label: t("settings.light") },
    { id: "dark" as const, icon: Moon, label: t("settings.dark") },
    { id: "system" as const, icon: Monitor, label: t("settings.system") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("settings.title")}</h2>
      </div>

      {/* Appearance */}
      <Card className="p-5">
        <h3 className="mb-4 font-semibold">{t("settings.appearance")}</h3>

        <div className="space-y-5">
          <div>
            <Label className="mb-2 block text-sm">{t("settings.theme")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((th) => {
                const Icon = th.icon;
                const active = theme === th.id;
                return (
                  <button
                    key={th.id}
                    onClick={() => setTheme(th.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors",
                      active ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {th.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-sm">{t("settings.language")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {LOCALES.map((l) => {
                const active = locale === l;
                return (
                  <button
                    key={l}
                    onClick={() => setLocale(l as Locale)}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
                      active ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      {LOCALE_LABELS[l as Locale]}
                    </span>
                    {active && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Gameplay */}
      <Card className="p-5">
        <h3 className="mb-4 font-semibold">{t("settings.gameplay")}</h3>
        <div className="space-y-4">
          <ToggleRow
            label={t("settings.autoCheck")}
            checked={settings.autoCheck}
            onChange={(v) => setSettings({ autoCheck: v })}
          />
          <ToggleRow
            label={t("settings.highlightPeers")}
            checked={settings.highlightPeers}
            onChange={(v) => setSettings({ highlightPeers: v })}
          />
          <ToggleRow
            label={t("settings.highlightSame")}
            checked={settings.highlightSame}
            onChange={(v) => setSettings({ highlightSame: v })}
          />
          <ToggleRow
            label={t("settings.showTimer")}
            checked={settings.showTimer}
            onChange={(v) => setSettings({ showTimer: v })}
          />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm">{t("settings.maxErrors")}</Label>
              <span className="text-sm font-medium">{settings.maxErrors === 0 ? "∞" : settings.maxErrors}</span>
            </div>
            <Slider
              value={[settings.maxErrors]}
              min={0}
              max={10}
              step={1}
              onValueChange={(v) => setSettings({ maxErrors: v[0] })}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm">{t("settings.maxHints")}</Label>
              <span className="text-sm font-medium">{settings.maxHints}</span>
            </div>
            <Slider
              value={[settings.maxHints]}
              min={0}
              max={9}
              step={1}
              onValueChange={(v) => setSettings({ maxHints: v[0] })}
            />
          </div>

          {/* Board theme picker */}
          <div>
            <Label className="mb-2 block text-sm">{t("settings.boardTheme")}</Label>
            <div className="flex flex-wrap gap-2">
              {BOARD_THEMES.map((bt) => {
                const active = settings.boardTheme === bt.id;
                return (
                  <button
                    key={bt.id}
                    onClick={() => setSettings({ boardTheme: bt.id })}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span
                      className="h-4 w-4 rounded-full ring-1 ring-border"
                      style={{ background: bt.swatch }}
                    />
                    {locale === "pt-BR" ? bt.name["pt-BR"] : bt.name.en}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Audio */}
      <Card className="p-5">
        <h3 className="mb-4 font-semibold">{t("settings.audio")}</h3>
        <ToggleRow
          label={
            <span className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              {t("settings.soundEnabled")}
            </span>
          }
          checked={settings.soundEnabled}
          onChange={(v) => setSettings({ soundEnabled: v })}
        />
      </Card>

      {/* Data */}
      <Card className="p-5">
        <h3 className="mb-4 font-semibold">{t("settings.data")}</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" />
            {t("settings.exportData")}
          </Button>
          <Button variant="outline" onClick={handleImport}>
            <Upload className="mr-1.5 h-4 w-4" />
            {t("settings.importData")}
          </Button>
          <Button variant="destructive" onClick={handleClear}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            {t("settings.clearData")}
          </Button>
        </div>
      </Card>

      {/* About */}
      <Card className="p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Info className="h-4 w-4" />
          {t("settings.about")}
        </h3>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">{t("settings.version")}</dt>
          <dd>1.0.0</dd>
          <dt className="text-muted-foreground">{t("settings.phase")}</dt>
          <dd>{t("settings.phaseValue")}</dd>
        </dl>
        <p className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          {t("app.localModeDesc")}
        </p>
      </Card>

      <ResetProgressDialog open={resetOpen} onOpenChange={setResetOpen} onConfirm={handleResetConfirm} />
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
