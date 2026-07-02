import { CalendarDays, RefreshCcw, Rss } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function NewsToolbar({
  availableDates,
  itemCount,
  onRefresh,
  onSelectedDateChange,
  selectedDate,
}: {
  availableDates: string[];
  itemCount: number;
  onRefresh: () => void;
  onSelectedDateChange: (date: string) => void;
  selectedDate: string;
}): ReactElement {
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Rss className="h-4 w-4" />
          News
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedDate} onValueChange={onSelectedDateChange}>
            <SelectTrigger className="h-8 w-[160px]">
              <CalendarDays className="h-4 w-4" />
              <SelectValue placeholder="Day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest</SelectItem>
              {availableDates.map((date) => (
                <SelectItem key={date} value={date}>
                  {date}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{itemCount} shown</Badge>
          <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
