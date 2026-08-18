import { useTheme } from "next-themes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_FARPLANE_THEME,
  FARPLANE_THEME_OPTIONS,
  type FarplaneThemeId,
  isFarplaneThemeId,
} from "@/config/theme-system";
import { cn } from "@/lib/utils";

function ThemeSwatches({ colors }: { colors: readonly string[] }) {
  return (
    <span className="flex shrink-0 overflow-hidden border border-border/70" aria-hidden="true">
      {colors.map((color) => (
        <span key={color} className="size-3" style={{ backgroundColor: color }} />
      ))}
    </span>
  );
}

export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const selectedTheme = isFarplaneThemeId(theme) ? theme : DEFAULT_FARPLANE_THEME;
  const selectedOption = FARPLANE_THEME_OPTIONS.find((option) => option.id === selectedTheme);

  return (
    <Select value={selectedTheme} onValueChange={(value) => setTheme(value as FarplaneThemeId)}>
      <SelectTrigger className={cn("w-full sm:w-[260px]", className)} aria-label="Theme">
        <SelectValue>
          {selectedOption ? (
            <span className="flex items-center gap-2">
              <ThemeSwatches colors={selectedOption.swatches} />
              <span>{selectedOption.label}</span>
            </span>
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {FARPLANE_THEME_OPTIONS.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <ThemeSwatches colors={option.swatches} />
            <span className="grid gap-0.5">
              <span>{option.label}</span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                {option.description}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
