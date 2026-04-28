import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Book, Clock, Building2, Layers, CalendarDays, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchFacultyLoading } from '@/store/slices/dataCacheSlice';

type AssignedClass = {
  id: number;
  code: string;
  name: string;
  schedule: string;
  room: string;
  program: string;
  units: number;
  contactHours: number;
  color: 'sky' | 'emerald' | 'indigo' | 'rose' | 'amber';
};

const colorMap = {
  sky: { text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
  emerald: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  indigo: { text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  rose: { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  amber: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
};

const formatTime = (time: string) => {
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const suffix = hh >= 12 ? 'PM' : 'AM';
  const normalized = hh % 12 || 12;
  return `${String(normalized).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')} ${suffix}`;
};

function FacultyLoading() {
  const dispatch = useAppDispatch();
  const facultyLoading = useAppSelector((s) => s.dataCache.facultyLoading) as any[];
  const loadingStatus = useAppSelector((s) => s.dataCache.facultyLoadingStatus);
  const[isRefreshing, setIsRefreshing] = useState(false);

  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { id: 0 };
  const userId = Number(user?.id || 0);

  useEffect(() => {
    if (loadingStatus === 'idle') {
      dispatch(fetchFacultyLoading(false));
    }
  },[dispatch, loadingStatus]);

  const facultyLoadData = useMemo<AssignedClass[]>(() => {
    const colors: AssignedClass['color'][] = ['sky', 'emerald', 'indigo', 'rose', 'amber'];
    return facultyLoading
      .filter((l: any) => Number(l?.faculty?.user_id || l?.faculty?.user?.id || 0) === userId)
      .map((l: any, i: number) => ({
        id: l.id,
        code: l?.subject?.subject_code || 'N/A',
        name: l?.subject?.des_title || 'Untitled Subject',
        schedule: `${l?.day || ''} ${formatTime(l?.start_time || '')}-${formatTime(l?.end_time || '')}`,
        room: l?.room?.roomNumber || 'TBA',
        program: l?.program?.abbreviation || l?.program?.program_name || 'Program',
        units: Number(l?.subject?.total_units || 0),
        contactHours: 0,
        color: colors[i % colors.length],
      }));
  }, [facultyLoading, userId]);

  const totalSubjects = facultyLoadData.length;
  const totalUnits = facultyLoadData.reduce((sum, subject) => sum + subject.units, 0);
  const totalContactHours = facultyLoadData.reduce((sum, subject) => sum + subject.contactHours, 0);

  const summaryCards =[
    { title: 'Assigned Subjects', value: totalSubjects, icon: Layers },
    { title: 'Total Units', value: totalUnits, icon: Book },
    { title: 'Contact Hours/Wk', value: totalContactHours, icon: Clock },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await dispatch(fetchFacultyLoading(true)).unwrap();
    setIsRefreshing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }} 
      className="space-y-6"
    >
      {/* Header Section - Minimalist & Clean */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
        {/* Subtle decorative background glow */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-slate-50 opacity-80 blur-2xl pointer-events-none" />
        
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200 mb-3">
              <CalendarDays size={14} className="text-slate-500" />
              Faculty Loading
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              My Teaching Load
            </h1>
            
            <p className="text-slate-500 max-w-2xl mt-1.5 text-sm md:text-base">
              Overview of your currently assigned subjects, schedules, and units.
            </p>
          </div>

          {/* Refresh Button */}
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
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCards.map((card) => (
          <div key={card.title} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
            <div className="p-3 rounded-xl bg-slate-50 text-slate-600 border border-slate-100">
              <card.icon size={22} className="text-slate-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{card.title}</p>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Class Schedule Grid */}
      {loadingStatus === 'loading' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl border border-slate-200 bg-slate-50/50 animate-pulse" />
          ))}
        </div>
      ) : facultyLoadData.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {facultyLoadData.map((subject) => {
            const accent = colorMap[subject.color] || colorMap.sky;
            return (
              <div 
                key={subject.id} 
                className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col transition-all duration-200 hover:shadow-md hover:border-slate-300"
              >
                <div className="p-5 flex-grow flex flex-col">
                  {/* Top Badges */}
                  <div className="flex justify-between items-start mb-3">
                    <div className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${accent.bg} ${accent.text} ${accent.border}`}>
                      {subject.code}
                    </div>
                    <Badge variant="outline" className="text-slate-500 border-slate-200 font-normal">
                      {subject.program}
                    </Badge>
                  </div>
                  
                  {/* Subject Name */}
                  <h3 className="text-lg font-bold text-slate-900 leading-snug flex-grow">
                    {subject.name}
                  </h3>
                  
                  {/* Time & Room Info */}
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5 text-sm text-slate-600">
                    <div className="flex items-start gap-2.5">
                      <Clock size={16} className="text-slate-400 mt-0.5" /> 
                      <span className="font-medium text-slate-700">{subject.schedule}</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Building2 size={16} className="text-slate-400 mt-0.5" /> 
                      <span className="text-slate-600">{subject.room}</span>
                    </div>
                  </div>
                  
                  {/* Footer Units */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-700">
                      Units: <span className="font-bold text-slate-900">{subject.units}</span>
                    </span>
                    <span className="text-slate-500">
                      Hrs/Wk: <span className="font-medium text-slate-700">{subject.contactHours}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-8 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center flex flex-col items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Layers className="text-slate-400" size={24} />
          </div>
          <p className="font-semibold text-slate-900 text-lg">No assigned subjects yet</p>
          <p className="text-slate-500 max-w-sm mt-1">
            You currently have no teaching load assigned. Please check back later or contact your program head.
          </p>
        </div>
      )}
    </motion.div>
  );
}

export default FacultyLoading;