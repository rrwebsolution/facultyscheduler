import { motion } from "framer-motion";
import { CalendarX2, User, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { dayMap, type ApiScheduleClass, type DayKey } from "./dashboard";

interface ClassBreakdownProps {
  selectedDay: DayKey;
  classes: ApiScheduleClass[]; 
  onClear: () => void;
}

export const ClassBreakdown = ({ selectedDay, classes, onClear }: ClassBreakdownProps) => {
  const classesForDay = classes.filter((c) => c.day === selectedDay);
  const fullDayName = dayMap[selectedDay] || "Selected Day";

  return (
    <motion.div layout initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: 10, height: 0 }}
      className="bg-card p-6 rounded-xl border shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">Schedule for {fullDayName}</h3>
        <Button variant="ghost" size="icon" onClick={onClear} className="text-muted-foreground hover:text-foreground">
          <X size={18}/>
        </Button>
      </div>
      <div className="space-y-3">
        {classesForDay.length > 0 ? (
          classesForDay.map((cls, idx) => (
            <motion.div key={cls.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 * idx }}
              className="group flex items-start gap-3 rounded-lg border p-4 bg-background transition-colors hover:bg-muted/50">
              <div className="flex-grow">
                <p className="font-medium text-foreground">{cls.code} - {cls.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><User size={14} /> {cls.facultyName}</span>
                  <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> Room: {cls.room}</span>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0 font-mono text-xs font-normal">
                <Clock size={12} className="mr-1.5"/>{cls.time}
              </Badge>
            </motion.div>
          ))
        ) : (
          <div className="py-10 flex flex-col items-center justify-center text-muted-foreground rounded-lg border border-dashed bg-muted/20">
            <CalendarX2 size={28} className="mb-3 opacity-50" />
            <p className="font-medium">No classes scheduled for this day.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};