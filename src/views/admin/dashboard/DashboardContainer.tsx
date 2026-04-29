import { useEffect, useState, useCallback } from "react";
import Cards from "./cards/Cards";
import { UpcomingSchedules } from "./cards/UpcomingSchedules";
import { motion } from "framer-motion";
import { CalendarCheck, RefreshCw } from "lucide-react";
import axios from "../../../plugin/axios";

export interface DashboardData {
  counts: {
    total_scheduled_classes: number;
    total_faculty_active: number;
    total_rooms_utilized: number;
    total_subjects_taught: number;
  };
  details: ScheduleDetail[];
  day: string;
  date: string;
}

export interface ScheduleDetail {
  id: number;
  subject_code: string;
  description: string;
  type: 'LEC' | 'LAB';
  section: string;
  day: string;
  start_time: string;
  end_time: string;
  room_number: string;
  faculty_name: string;
  faculty_img: string | null;
}

function DashboardContainer() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const response = await axios.get('dashboard/today-statistics', {
        headers: { Authorization: `Bearer ${token}` },
        params: forceRefresh ? { _ts: Date.now() } : undefined
      });
      if (response.data.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setLoading(true);
    fetchData(true);
  };

  const totalToday = data?.details?.length || 0;
  const uniqueFacultyToday = new Set((data?.details || []).map((d) => d.faculty_name)).size;
  const uniqueSectionsToday = new Set((data?.details || []).map((d) => d.section)).size;

  return (
    <>
      {/* Hero / Welcome Section - Minimalist & Clean */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm mb-8"
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-slate-50 opacity-80 blur-2xl pointer-events-none" />

        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200 mb-3">
              <CalendarCheck size={14} className="text-slate-500" />
              Admin Dashboard
            </div>

            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, Admin
            </h1>

            <p className="text-slate-500 max-w-2xl mt-1.5 text-sm md:text-base">
              {loading
                ? "Loading schedule data..."
                : `Here's a snapshot of today's schedule (${data?.day || ''}, ${data?.date || ''}).`
              }
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="self-start md:self-auto inline-flex items-center gap-2 px-3 py-2 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Refresh data"
            aria-label="Refresh data"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="text-sm font-medium">Refresh data</span>
          </button>
        </div>
      </motion.div>

      {/* Cards Section */}
      <div className="mb-8">
        <Cards counts={data?.counts} isLoading={loading} />
      </div>

      <div className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">Today Classes</p>
            <p className="text-2xl font-bold text-slate-900">{loading ? '--' : totalToday}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">Faculty On Schedule</p>
            <p className="text-2xl font-bold text-slate-900">{loading ? '--' : uniqueFacultyToday}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">Sections Covered</p>
            <p className="text-2xl font-bold text-slate-900">{loading ? '--' : uniqueSectionsToday}</p>
          </div>
        </div>
      </div>

      {/* Upcoming Schedules Section */}
      <div>
        <UpcomingSchedules schedules={data?.details || []} isLoading={loading} />
      </div>
    </>
  );
}

export default DashboardContainer;
