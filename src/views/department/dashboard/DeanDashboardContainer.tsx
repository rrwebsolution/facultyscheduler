// src/views/admin/DeanDashboardContainer.tsx

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import axios from "../../../plugin/axios"; 

import { KpiCards } from "./card/KpiCards"; 
import { ClassBreakdown } from "./ClassBreakdown";
import { WeeklyOverviewChart } from "./chart/WeeklyOverviewChart";
import { FacultyLoadChart } from "./chart/FacultyLoadChart";

export type DayKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

interface ApiKpi {
    title: string;
    value: number | string;
    icon: 'Users' | 'BookCopy' | 'Building2' | 'BarChart3';
}

interface ApiWeeklyOverview {
    MON: number; 
    TUE: number; 
    WED: number; 
    THU: number; 
    FRI: number; 
    SAT: number;
}

interface ApiScheduleClass {
    id: number; 
    day: DayKey;
    code: string; 
    title: string; 
    time: string; 
    facultyName: string;
    room: string; 
}

interface ApiFacultyLoad {
    name: string;
    load: number; 
}

interface ApiWeeklyScheduleResponse {
    weeklyOverview: ApiWeeklyOverview;
    allClasses: ApiScheduleClass[];
}

const getToken = () => localStorage.getItem('accessToken');
const getAuthHeader = () => ({ 'Authorization': `Bearer ${getToken()}` });

const fetchDashboardData = async (forceRefresh = false): Promise<{
    kpiData: ApiKpi[];
    weeklySchedule: ApiWeeklyScheduleResponse;
    facultyLoad: ApiFacultyLoad[];
}> => {
    const token = getToken();
    if (!token) {
        throw new Error("Authentication required.");
    }
    const config = { headers: getAuthHeader() };

    try {
        const[kpiRes, weeklyRes, loadRes] = await Promise.all([
            axios.get('kpi', { ...config, params: forceRefresh ? { _ts: Date.now() } : undefined }), 
            axios.get('weekly-schedule', { ...config, params: forceRefresh ? { _ts: Date.now() } : undefined }), 
            axios.get('faculty-load', { ...config, params: forceRefresh ? { _ts: Date.now() } : undefined }), 
        ]);

        return {
            kpiData: kpiRes.data.data.map((item: any) => ({
                ...item,
                icon: item.icon as ApiKpi['icon'], 
            })),
            weeklySchedule: weeklyRes.data,
            facultyLoad: loadRes.data.data,
        };
    } catch (error) {
        console.error("Dashboard Data Fetch Error:", error);
        throw new Error("Failed to load dashboard data from the server.");
    }
};

const DashboardSkeleton = () => (
    <div className="space-y-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="h-28 w-full bg-muted rounded-xl border"></div>

        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-card p-4 rounded-lg border h-24">
                            <div className="h-6 w-6 bg-muted rounded-md mb-2"></div>
                            <div className="h-4 w-1/2 bg-muted rounded"></div>
                        </div>
                    ))}
                </div>

                <div className="bg-card p-6 rounded-xl border h-72">
                    <div className="h-4 w-1/3 bg-muted rounded mb-4"></div>
                    <div className="flex justify-between items-end gap-3 h-48 pt-8">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="relative flex-1 flex flex-col items-center gap-2 h-full">
                                <div className="w-full max-w-[40px] bg-muted rounded-t-md" style={{ height: `${(i + 1) * 10}%` }}></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="lg:col-span-1 space-y-8">
                <div className="bg-card p-6 rounded-xl border h-72">
                    <div className="h-4 w-1/2 bg-muted rounded mb-6"></div>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-2 mb-4">
                            <div className="h-3 w-3/4 bg-muted rounded"></div>
                            <div className="h-4 bg-muted rounded-full"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

function DeanDashboardContainer() {
  const [selectedDay, setSelectedDay] = useState<DayKey | null>(null);
  const [dashboardData, setDashboardData] = useState<Awaited<ReturnType<typeof fetchDashboardData>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const data = await fetchDashboardData(forceRefresh);
      setDashboardData(data);
      if (forceRefresh) toast.success("Dashboard data refreshed.");
      else toast.success("Dashboard data loaded.");
    } catch (error: any) {
      console.error("Dashboard Load Error:", error);
      toast.error(error.message || "Failed to load dashboard data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleDaySelect = (day: DayKey) => {
    setSelectedDay(currentDay => (currentDay === day ? null : day));
  };

  useEffect(() => {
    loadData();
  },[]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData(true);
  };

  if (isLoading || !dashboardData) {
    return <DashboardSkeleton />;
  }

  const { kpiData, weeklySchedule, facultyLoad } = dashboardData;
  const allClassesData = weeklySchedule.allClasses;
  const weeklyTotalClasses = Object.values(weeklySchedule.weeklyOverview || {}).reduce((acc, val) => acc + Number(val || 0), 0);
  const peakDayEntry = Object.entries(weeklySchedule.weeklyOverview || {}).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const peakDay = peakDayEntry ? `${peakDayEntry[0]} (${peakDayEntry[1]})` : "N/A";

  return (
    <div className="space-y-8">
      {/* Hero / Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl bg-card border text-card-foreground shadow-sm"
      >
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <CalendarCheck size={14} />
              Dean's Dashboard
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Scheduling Overview</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">Manage and oversee all faculty schedules for the department.</p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border shadow-sm"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="text-sm font-medium">Refresh Data</span>
          </button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-medium text-muted-foreground">Weekly Classes</p>
            <p className="text-3xl font-bold mt-1">{weeklyTotalClasses}</p>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-medium text-muted-foreground">Peak Day</p>
            <p className="text-3xl font-bold mt-1">{peakDay}</p>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-medium text-muted-foreground">Faculty Tracked</p>
            <p className="text-3xl font-bold mt-1">{facultyLoad.length}</p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <KpiCards data={kpiData} /> 

          <WeeklyOverviewChart 
            weeklyOverviewData={weeklySchedule.weeklyOverview} 
            allClasses={allClassesData} 
            selectedDay={selectedDay} 
            onDaySelect={handleDaySelect} 
          />

          <AnimatePresence>
            {selectedDay && (
              <ClassBreakdown 
                selectedDay={selectedDay} 
                classes={allClassesData} 
                onClear={() => setSelectedDay(null)} 
              />
            )}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-1 space-y-8">
          <FacultyLoadChart facultyLoadData={facultyLoad} />
        </div>
      </div>
    </div>
  );
}

export default DeanDashboardContainer;
