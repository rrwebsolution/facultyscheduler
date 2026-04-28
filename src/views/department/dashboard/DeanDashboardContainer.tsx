// src/views/admin/DeanDashboardContainer.tsx

import { useState, useEffect } from "react"; // Removed useCallback
import { motion, AnimatePresence } from "framer-motion";
import { CalendarCheck } from "lucide-react"; // Removed Loader2
import { toast } from "sonner";
import axios from "../../../plugin/axios"; 

// --- DATA & CHART IMPORTS (Adjust paths as necessary) ---
import { KpiCards } from "./card/KpiCards"; 
import { WeeklyOverviewChart } from "./chart/WeeklyOverviewChart.tsx";
import { ClassBreakdown } from "./ClassBreakdown";
import { FacultyLoadChart } from "./chart/FacultyLoadChart.tsx";

// --- NEW DATA INTERFACES BASED ON LARAVEL API (Keep these in sync with your API) ---
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

// Helper to get the token
const getToken = () => localStorage.getItem('accessToken');
const getAuthHeader = () => ({ 'Authorization': `Bearer ${getToken()}` });


// --- API CALL IMPLEMENTATIONS ---
const fetchDashboardData = async (): Promise<{
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
        const [kpiRes, weeklyRes, loadRes] = await Promise.all([
            axios.get('kpi', config), 
            axios.get('weekly-schedule', config), 
            axios.get('faculty-load', config), 
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

// --- SKELETON COMPONENTS ---
// Note: This component definition is kept as-is, but in a separate file for cleaner code
const DashboardSkeleton = () => (
    <div className="space-y-8 animate-accordion-down">
        {/* Header Skeleton */}
        <div className="h-40 w-full bg-purple-200 rounded-xl shadow-lg"></div>

        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column (KPI, Weekly Chart) */}
            <div className="lg:col-span-2 space-y-8">
                {/* KPI Cards Skeleton */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-gray-100 p-4 rounded-lg border h-24">
                            <div className="h-8 w-8 bg-gray-300 rounded-md mb-2"></div>
                            <div className="h-4 w-1/2 bg-gray-300 rounded"></div>
                        </div>
                    ))}
                </div>

                {/* Weekly Chart Skeleton */}
                <div className="bg-gray-100 p-6 rounded-xl border h-72">
                    <div className="h-4 w-1/3 bg-gray-300 rounded mb-4"></div>
                    <div className="flex justify-between items-end gap-3 h-48 pt-8">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="relative flex-1 flex flex-col items-center gap-2 h-full">
                                <div className="w-full bg-gray-200 rounded-t-md" style={{ height: `${(i + 1) * 10}%` }}></div>
                                <div className="h-3 w-8 bg-gray-300 rounded"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Column (Faculty Load Chart) */}
            <div className="lg:col-span-1 space-y-8">
                <div className="bg-gray-100 p-6 rounded-xl border h-72">
                    <div className="h-4 w-1/2 bg-gray-300 rounded mb-6"></div>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-2 mb-4">
                            <div className="h-3 w-3/4 bg-gray-300 rounded"></div>
                            <div className="h-4 bg-gray-200 rounded-full"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);


// --- MAIN CONTAINER COMPONENT ---

function DeanDashboardContainer() {
  const [selectedDay, setSelectedDay] = useState<DayKey | null>(null);
  const [dashboardData, setDashboardData] = useState<Awaited<ReturnType<typeof fetchDashboardData>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleDaySelect = (day: DayKey) => {
    setSelectedDay(currentDay => (currentDay === day ? null : day));
  };

  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await fetchDashboardData();
            setDashboardData(data);
            toast.success("Dashboard data loaded.");
        } catch (error: any) {
            console.error("Dashboard Load Error:", error);
            toast.error(error.message || "Failed to load dashboard data.");
        } finally {
            setIsLoading(false);
        }
    };
    loadData();
  }, []);


  if (isLoading || !dashboardData) {
    return <DashboardSkeleton />;
  }

  // Destructure data for cleaner use
  const { kpiData, weeklySchedule, facultyLoad } = dashboardData;
  const allClassesData = weeklySchedule.allClasses;

  return (
    <div className="space-y-8">
      {/* Hero / Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-lg"
      >
        <div className="relative p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                <CalendarCheck size={14} />
                Dean's Dashboard
              </div>
              <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">Scheduling Overview</h1>
              <p className="text-white/80 max-w-2xl">Manage and oversee all faculty schedules for the department.</p>
            </div>
            {/* <Link to="/dean/conflicts" className="hidden sm:inline-flex items-center gap-2 rounded-md bg-white/10 text-white font-semibold px-4 py-2 hover:bg-white/20 transition">
              <AlertTriangle size={16} /> Resolve Conflicts
            </Link> */}
          </div>
        </div>
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column (Main Content) */}
        <div className="lg:col-span-2 space-y-8">
          {/* KPI Cards: Pass API Data (Prop 'data' is expected here) */}
          <KpiCards data={kpiData} /> 

          {/* Weekly Overview Chart: Pass API Data (Fix: Re-introduce allClassesData) */}
          <WeeklyOverviewChart 
            weeklyOverviewData={weeklySchedule.weeklyOverview} 
            allClasses={allClassesData} 
            selectedDay={selectedDay} 
            onDaySelect={handleDaySelect} 
          />

          {/* Class Breakdown: Pass API Data (Prop 'classes' is expected here) */}
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

        {/* Right Column (Sidebar-like content) */}
        <div className="lg:col-span-1 space-y-8">
          {/* Faculty Load Chart: Pass API Data (Prop 'facultyLoadData' is expected here) */}
          <FacultyLoadChart facultyLoadData={facultyLoad} />
        </div>
      </div>
    </div>
  );
}

export default DeanDashboardContainer;