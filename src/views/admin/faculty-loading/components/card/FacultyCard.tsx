import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    List, 
    PlusCircle, 
    BookOpen,     
    ArrowDownCircle, 
    TrendingUp,   
    CheckCircle2, 
} from "lucide-react";
import type { Faculty } from "../../type";

// --- HELPERS ---

// Updated to use opacity-based backgrounds for perfect Light/Dark mode support
const expertiseColorPalette =[
  { bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-rose-500/15", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-indigo-500/15", text: "text-indigo-700 dark:text-indigo-300" },
  { bg: "bg-cyan-500/15", text: "text-cyan-700 dark:text-cyan-300" },
  { bg: "bg-pink-500/15", text: "text-pink-700 dark:text-pink-300" },
];

function getExpertiseColor(label: string) {
  let hash = 0;
  const s = (label || '').toLowerCase();
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0; 
  }
  const idx = Math.abs(hash) % expertiseColorPalette.length;
  return expertiseColorPalette[idx];
}

function getInitials(name: string) {
    if (!name) return "U";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function FacultyCard({
  data,
  onAssignClick,
  onViewSubjectsClick,
}: {
  data: Faculty[];
  onAssignClick: (f: Faculty) => void;
  onViewSubjectsClick: (f: Faculty) => void;
}) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No faculty found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
      {data.map((f) => {
        // Image Handling
        const imageUrl = f.profile_picture 
            ? (f.profile_picture.startsWith('http') ? f.profile_picture : `${import.meta.env.VITE_URL}/${f.profile_picture}`)
            : null;

        // --- STATUS LOGIC ---
        // Requirement: Status should NOT be 'Overload' or red, even if overload_units > 0.
        // It should display the normal 'Teaching' status.
        const status = "ok"; 

        const statusConfig = {
          overloaded: { label: "Overload", icon: TrendingUp, text: "text-red-700 dark:text-red-400", bg: "bg-red-500/10", ring: "ring-1 ring-red-500/30", dot: "bg-red-500" },
          ok: { label: "Teaching", icon: CheckCircle2, text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-1 ring-emerald-500/30", dot: "bg-emerald-500" },
        };
        const currentStatus = statusConfig[status as keyof typeof statusConfig];
        const StatusIcon = currentStatus.icon;

        return (
          <div
            key={f.id}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-border"
          >
            {/* Decorative background flare */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/5 blur-3xl transition-all group-hover:bg-primary/10" />

            {/* --- HEADER SECTION --- */}
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={f.name}
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover ring-2 ring-background border border-border shadow-sm"
                  />
                ) : (
                  <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gradient-to-br from-indigo-500/80 to-violet-500/80 text-white flex items-center justify-center text-lg font-bold ring-2 ring-background border border-border shadow-sm">
                    {getInitials(f.name)}
                  </div>
                )}
                <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-background ${currentStatus.dot} ${currentStatus.ring}`} />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-base sm:text-lg font-bold text-foreground leading-tight">
                    {f.name}
                  </h3>
                  <div className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${currentStatus.bg} ${currentStatus.text}`}>
                    <StatusIcon size={12} />
                    <span>{currentStatus.label}</span>
                  </div>
                </div>
                
                <div className="mt-1">
                  <span className="text-xs font-medium text-muted-foreground">
                   {f.department || "No Department"}
                  </span>
                </div>

                {/* Expertise Badges */}
                {f.expertise && f.expertise.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {f.expertise.slice(0, 3).map((x, i) => {
                      const color = getExpertiseColor(x);
                      return (
                        <Badge key={`${x}-${i}`} className={`text-[10px] px-2 py-0.5 font-medium ${color.bg} ${color.text} border-transparent hover:opacity-80 transition-opacity`}>
                          {x}
                        </Badge>
                      );
                    })}
                    {f.expertise.length > 3 && (
                      <Badge className="text-[10px] px-2 py-0.5 font-medium bg-muted/50 text-muted-foreground border-transparent">
                        +{f.expertise.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* --- STATS SECTION --- */}
            <div className="mt-6 mb-5 grid grid-cols-3 gap-2.5 sm:gap-3">
                {/* 1. Teaching Load */}
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center transition-colors group-hover:bg-blue-500/10">
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-1">
                        <BookOpen size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Teaching</span>
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-foreground leading-none">
                            {f.t_load_units || 0}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground">
                            Units
                        </span>
                    </div>
                </div>

                {/* 2. Deload */}
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center transition-colors group-hover:bg-amber-500/10">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
                        <ArrowDownCircle size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Deload</span>
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-foreground leading-none">
                            {f.deload_units || 0}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground">
                            Units
                        </span>
                    </div>
                </div>

                {/* 3. Overload */}
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-center transition-colors group-hover:bg-red-500/10">
                    <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-1">
                        <TrendingUp size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Overload</span>
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-foreground leading-none">
                            {f.overload_units || 0}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground">
                            Units
                        </span>
                    </div>
                </div>
            </div>

            {/* --- ACTIONS --- */}
            {/* Using mt-auto to push actions to the bottom if the card heights vary */}
            <div className="mt-auto pt-4 border-t border-border/60 flex flex-wrap sm:flex-nowrap justify-end gap-2.5">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onViewSubjectsClick(f)} 
                className="w-full sm:w-auto h-9 bg-transparent hover:bg-muted font-medium shadow-sm transition-colors"
              >
                <List className="mr-2 h-4 w-4" /> 
                Schedule
              </Button>
              <Button 
                size="sm" 
                onClick={() => onAssignClick(f)} 
                className="w-full sm:w-auto h-9 font-medium shadow-sm"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> 
                Assign
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}