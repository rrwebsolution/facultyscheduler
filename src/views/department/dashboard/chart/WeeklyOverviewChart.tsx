// src/components/dashboard/WeeklyOverviewChart.tsx

import { useMemo } from "react";
import type { ApiScheduleClass, DayKey, ApiWeeklyOverview } from "../dashboard"; 

interface ChartProps {
  weeklyOverviewData: ApiWeeklyOverview;
  allClasses: ApiScheduleClass[]; 
  selectedDay: DayKey | null;
  onDaySelect: (day: DayKey) => void;
}

// Mga specific colors matag adlaw (Clean & Professional Hex codes)
const dayColors: Record<DayKey, string> = {
    MON: "#3b82f6", // Blue
    TUE: "#10b981", // Emerald
    WED: "#8b5cf6", // Violet
    THU: "#f59e0b", // Amber
    FRI: "#f43f5e", // Rose
    SAT: "#64748b", // Slate
};

export const WeeklyOverviewChart = ({ weeklyOverviewData, selectedDay, onDaySelect }: ChartProps) => {
    
    // I-format ang data para basahon sa Recharts
    const chartData = useMemo(() => {
        return (Object.entries(weeklyOverviewData) as [DayKey, number][]).map(([day, count]) => ({
            day,
            count,
        }));
    }, [weeklyOverviewData]);

    const maxCount = Math.max(1, ...chartData.map((d) => Number(d.count) || 0));

    return (
        <div className="bg-card p-6 rounded-xl border shadow-sm flex flex-col h-full min-h-[420px]">
            <div>
                <h3 className="text-lg font-semibold tracking-tight mb-1">Weekly Schedule</h3>
                <p className="text-sm text-muted-foreground mb-6">Click a bar to view its detailed schedule.</p>
            </div>
            
            {/* CSS Bar Chart Area (stable fallback, always visible) */}
            <div className="flex-grow w-full min-h-[250px] mt-4">
                <div className="h-full min-h-[260px] rounded-lg border border-border/70 bg-background p-4">
                    <div className="h-[210px] flex items-end gap-3">
                        {chartData.map((entry) => {
                            const value = Number(entry.count) || 0;
                            const pct = Math.max(4, (value / maxCount) * 100);
                            const isSelected = selectedDay === entry.day;
                            const isDimmed = selectedDay && !isSelected;
                            return (
                                <button
                                    key={entry.day}
                                    type="button"
                                    onClick={() => onDaySelect(entry.day)}
                                    className="flex-1 h-full flex flex-col justify-end items-center gap-2"
                                    title={`${entry.day}: ${value} classes`}
                                >
                                    <span className="text-xs font-semibold text-muted-foreground">{value > 0 ? value : ""}</span>
                                    <div
                                        className="w-full rounded-t-md transition-all"
                                        style={{
                                            height: `${pct}%`,
                                            backgroundColor: dayColors[entry.day as DayKey],
                                            opacity: isDimmed ? 0.35 : 1,
                                        }}
                                    />
                                    <span className="text-xs font-medium text-muted-foreground">{entry.day}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
