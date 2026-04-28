import { useMemo, useEffect, useState } from "react";
import StatsCards from "./cards/StatsCards";
import UpcomingSchedule, { type ScheduleItem } from "./cards/UpcomingSchedule";
import { motion } from "framer-motion";
import { CalendarCheck, RefreshCw } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchFacultyLoading, fetchSubjects } from "@/store/slices/dataCacheSlice";

const dayMap: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

const normalizeDay = (day: string) => {
  const key = day.slice(0, 3).toLowerCase();
  return dayMap[key] || day;
};

const formatTime = (time: string) => {
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  const suffix = hh >= 12 ? "PM" : "AM";
  const normalized = hh % 12 || 12;
  return `${String(normalized).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")} ${suffix}`;
};

function FacultyDashboardContainer() {
  const dispatch = useAppDispatch();
  const facultyLoading = useAppSelector((s) => s.dataCache.facultyLoading) as any[];
  const loadingStatus = useAppSelector((s) => s.dataCache.facultyLoadingStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { id: 0, name: 'Faculty' };
  const userId = Number(user?.id || 0);

  useEffect(() => {
    if (loadingStatus === "idle") {
      dispatch(fetchFacultyLoading(false));
      dispatch(fetchSubjects(false));
    }
  }, [dispatch, loadingStatus]);

  const myLoads = useMemo(() => {
    return facultyLoading.filter((item: any) => {
      const facultyUserId = Number(item?.faculty?.user_id || item?.faculty?.user?.id || 0);
      return facultyUserId === userId;
    });
  }, [facultyLoading, userId]);

  const todaysClasses = useMemo(() => {
    const todayShort = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
    return myLoads.filter((l: any) => String(l?.day || '').toLowerCase().startsWith(todayShort)).length;
  }, [myLoads]);

  const totalSubjects = myLoads.length;
  const totalPreparations = useMemo(() => {
    const set = new Set(myLoads.map((l: any) => `${l?.subject?.subject_code || ''}|${l?.type || ''}`));
    return set.size;
  }, [myLoads]);

  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    const colors: ScheduleItem["color"][] =["sky", "emerald", "indigo", "rose"];
    return myLoads.slice(0, 8).map((l: any, i: number) => ({
      id: l.id,
      time: `${normalizeDay(l.day || '')} ${formatTime(l.start_time || '')} - ${formatTime(l.end_time || '')}`,
      subject: `${l?.subject?.subject_code || ''}: ${l?.subject?.des_title || ''}`.trim(),
      room: l?.room?.roomNumber || "TBA",
      program: l?.program?.abbreviation || l?.program?.program_name || "Program",
      color: colors[i % colors.length],
    }));
  }, [myLoads]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      dispatch(fetchFacultyLoading(true)).unwrap(),
      dispatch(fetchSubjects(true)).unwrap(),
    ]);
    setIsRefreshing(false);
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header - Minimalist & Clean */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm"
      >
        {/* Subtle decorative background glow */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-slate-50 opacity-80 blur-2xl pointer-events-none" />
        
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200 mb-3">
              <CalendarCheck size={14} className="text-slate-500" />
              Faculty Dashboard
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, {user.name}!
            </h1>
            
            <p className="text-slate-500 max-w-2xl mt-1.5 text-sm md:text-base">
              Here is a summary of your classes and workload for today.
            </p>
          </div>

          {/* Refresh Button - Redesigned to match the clean theme */}
          <div className="shrink-0 pt-2 md:pt-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              title="Refresh data"
              aria-label="Refresh data"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin text-slate-400" : "text-slate-500"} />
              <span>{isRefreshing ? "Refreshing..." : "Refresh data"}</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards Section */}
      <div>
        <StatsCards
          todaysClasses={todaysClasses}
          totalSubjects={totalSubjects}
          totalPreparations={totalPreparations}
        />
      </div>

      {/* Upcoming Schedule Section */}
      <div>
        <UpcomingSchedule items={scheduleItems} />
      </div>
    </div>
  );
}

export default FacultyDashboardContainer;