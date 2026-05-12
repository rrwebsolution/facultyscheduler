import React, { useMemo, useState, useEffect } from "react";
import axios from '../../../../plugin/axios';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Loader2, MapPin, Search, Building2, GraduationCap, Grid3x3, User } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";


// --- CORE DATA INTERFACES ---

interface User { id: number; name: string; }
interface Faculty { id: number; user_id: number; designation: string; user: User; }
interface Subject { id: number; subject_code: string; des_title: string; }
interface Room { id: number; roomNumber: string; }

interface Program {
    id: number; program_name: string; abbreviation: string; year_from: string; year_to: string;
    status: number; created_at: string; updated_at: string;
}

interface FacultyLoading {
    id: number; type: 'LEC' | 'LAB' | string; day: string; start_time: string; end_time: string;
    faculty: Faculty; subject: Subject; room: Room;
}

interface ClassSchedule {
    id: number; program_id: number; faculty_loading_id: number; year_level: number;
    section: string; faculty_loading: FacultyLoading; program: Program;
}

interface BackendResponse {
    success: boolean; classSchedule: ClassSchedule[];
}

// --- VIEW-SPECIFIC INTERFACES ---

interface ScheduleGridData {
    gridData: { 
        [key: string]: { 
            content: React.ReactNode; 
            rowSpan: number // Still used for internal height calculation
        } 
    };
    coveredKeys: Set<string>;
}

interface RoomScheduleViewProps {
    rooms: string[];
    filteredScheduleData: ScheduleGridData;
    selectedDayFilter: string;
    setSelectedDayFilter: React.Dispatch<React.SetStateAction<string>>;
    selectedClassType: 'all' | 'LEC' | 'LAB';
    setSelectedClassType: React.Dispatch<React.SetStateAction<'all' | 'LEC' | 'LAB'>>;
    roomSearchQuery: string;
    setRoomSearchQuery: React.Dispatch<React.SetStateAction<string>>;
}

interface YearLevelScheduleViewProps {
    backendData: ClassSchedule[];
}

// --- CONSTANTS & UTILITY FUNCTIONS (1-Hour Slots, Dynamic Height) ---

const REPORT_TIME_COLUMN_WIDTH_PIXELS = 50;
const REPORT_COLUMN_WIDTH_PIXELS = 124;
const ROW_HEIGHT_PIXELS = 72; // Matches the class schedule grid's hourly row height.
const SLOT_INTERVAL_MIN = 60; // 60 minutes interval (1 hour)

const reportSubjectColors = [
    { bg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-500', text: 'text-blue-700', badge: 'bg-white/60 text-slate-700' },
    { bg: 'bg-emerald-50 hover:bg-emerald-100', border: 'border-emerald-500', text: 'text-emerald-700', badge: 'bg-white/60 text-slate-700' },
    { bg: 'bg-violet-50 hover:bg-violet-100', border: 'border-violet-500', text: 'text-violet-700', badge: 'bg-white/60 text-slate-700' },
    { bg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-500', text: 'text-amber-700', badge: 'bg-white/60 text-slate-700' },
    { bg: 'bg-rose-50 hover:bg-rose-100', border: 'border-rose-500', text: 'text-rose-700', badge: 'bg-white/60 text-slate-700' },
    { bg: 'bg-cyan-50 hover:bg-cyan-100', border: 'border-cyan-500', text: 'text-cyan-700', badge: 'bg-white/60 text-slate-700' },
];

const getReportSubjectColor = (subjectId: number) => reportSubjectColors[subjectId % reportSubjectColors.length];

const to12Hour = (minutes: number) => {
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    const period = hh >= 12 ? 'PM' : 'AM';
    const displayHour = hh % 12 || 12;
    // Note: The time slot is displayed with minutes (e.g., 7:00AM)
    return `${String(displayHour)}:${String(mm).padStart(2, '0')}${period}`;
};

const generateTimeSlots = (startHour = 7, endHour = 21, intervalMinutes = SLOT_INTERVAL_MIN) => {
    const slots: string[] = [];
    const startMinutes = startHour * 60;
    const endMinutes = endHour * 60; 
    for (let m = startMinutes; m < endMinutes; m += intervalMinutes) {
        slots.push(to12Hour(m));
    }
    return slots;
};

const TIME_SLOTS = generateTimeSlots(7, 21, SLOT_INTERVAL_MIN); 

const DAY_FILTERS = [
    { value: "all", label: "All Days (Unfiltered)", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
    { value: "Monday", label: "Monday Schedule", days: ["Monday"] },
    { value: "Tuesday", label: "Tuesday Schedule", days: ["Tuesday"] },
    { value: "Wednesday", label: "Wednesday Schedule", days: ["Wednesday"] },
    { value: "Thursday", label: "Thursday Schedule", days: ["Thursday"] },
    { value: "Friday", label: "Friday Schedule", days: ["Friday"] },
    { value: "Saturday", label: "Saturday Schedule", days: ["Saturday"] },
];

const CLASS_TYPE_FILTERS = [
    { value: "all", label: "All Classes" },
    { value: "LEC", label: "Lecture (LEC)" },
    { value: "LAB", label: "Laboratory (LAB)" },
];

const formatTime = (timeString: string): string => {
    try {
        const [hours, minutes] = timeString.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12; 
        return `${displayHours}:${String(minutes).padStart(2, '0')}${period}`;
    } catch (e) {
        return timeString;
    }
};

const timeToMinutes = (hhmm: string): number => {
    const [hh, mm] = hhmm.split(':').map(Number);
    return hh * 60 + mm;
};

const to24 = (t: string): string => {
    const m = t.match(/(\d{1,2}):(\d{2})(am|pm)/i);
    if (!m) return '';
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const period = m[3].toLowerCase();
    if (period === 'pm' && hh !== 12) hh += 12;
    if (period === 'am' && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${mm}`;
};

// Transformation for Room Grid (Dynamic Height, NO rowSpan)
const transformToRoomGrid = (data: ClassSchedule[]): ScheduleGridData => {
    const gridData: ScheduleGridData['gridData'] = {};
    const coveredKeys = new Set<string>();
    
    data.forEach((schedule: ClassSchedule) => {
        const loading = schedule.faculty_loading;
        const columnKey = loading.room.roomNumber; 
        
        const subjectCode = loading.subject.subject_code;
        const facultyName = loading.faculty.user.name;
        const section = schedule.section;
        const classType = loading.type;
        const timePeriod = `${formatTime(loading.start_time)}-${formatTime(loading.end_time)}`;
        const style = getReportSubjectColor(loading.subject.id);

        const classStartTime24 = loading.start_time.substring(0, 5);
        const classEndTime24 = loading.end_time.substring(0, 5);
        const classStartMin = timeToMinutes(classStartTime24);
        const classEndMin = timeToMinutes(classEndTime24);
        const classDurationMin = classEndMin - classStartMin;
        
        const slotSpan = Math.ceil(classDurationMin / SLOT_INTERVAL_MIN);
        if (slotSpan <= 0) return;

        // Calculate the required pixel height for the content DIV
        const contentHeight = slotSpan * ROW_HEIGHT_PIXELS; 

        // Find the starting time slot
        for (let i = 0; i < TIME_SLOTS.length; i++) {
            const slot = TIME_SLOTS[i];
            const slotStart24 = to24(slot);
            if (!slotStart24) continue;
            const slotStartMin = timeToMinutes(slotStart24);
            
            if (classStartMin === slotStartMin) {
                const gridKey = `${columnKey}_${slot}`;

                const cellContent = (
                    <div 
                        style={{ height: `${contentHeight}px`, marginTop: '0px' }}
                        className="absolute w-full top-0 left-0 px-1.5 z-10"
                    >
                        <div className={`rounded-lg p-2.5 h-full flex flex-col justify-between overflow-hidden ${style.bg} ${style.border} border-l-[3px] shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer`}>
                            <div>
                                <div className={`font-bold text-xs leading-tight mb-0.5 ${style.text}`}>{subjectCode} {section}</div>
                                <div className="text-[10px] text-slate-600 line-clamp-2 leading-tight">{loading.subject.des_title}</div>
                            </div>
                            <div className="mt-1 pt-1.5 border-t border-black/5 flex flex-col justify-end items-start text-[9px] font-semibold text-slate-500 space-y-1">
                                <div className="flex items-center gap-1.5">
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span className="text-slate-700 line-clamp-1">{facultyName}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    <span className="text-slate-700">{loading.room.roomNumber}</span>
                                    <span className={`${style.badge} px-1 rounded text-xs font-bold uppercase`}>{classType}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>{loading.day} | {timePeriod}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

                gridData[gridKey] = { content: cellContent, rowSpan: slotSpan };
                
                // Mark subsequent slots as covered
                for (let k = 1; k < slotSpan; k++) {
                    if (i + k < TIME_SLOTS.length) {
                         coveredKeys.add(`${columnKey}_${TIME_SLOTS[i + k]}`);
                    }
                }
                break;
            }
        }
    });
    
    return { gridData, coveredKeys };
};

// Transformation for Section Grid (Dynamic Height, NO rowSpan)
const transformToSectionGrid = (data: ClassSchedule[]): ScheduleGridData => {
    const gridData: ScheduleGridData['gridData'] = {};
    const coveredKeys = new Set<string>();
    
    data.forEach((schedule: ClassSchedule) => {
        const loading = schedule.faculty_loading;
        const columnKey = `${schedule.year_level}-${schedule.section}`; 
        
        const subjectCode = loading.subject.subject_code;
        const facultyName = loading.faculty.user.name;
        const roomNumber = loading.room.roomNumber;
        const classType = loading.type;
        const timePeriod = `${formatTime(loading.start_time)}-${formatTime(loading.end_time)}`;
        const style = getReportSubjectColor(loading.subject.id);

        const classStartTime24 = loading.start_time.substring(0, 5);
        const classEndTime24 = loading.end_time.substring(0, 5);
        const classStartMin = timeToMinutes(classStartTime24);
        const classEndMin = timeToMinutes(classEndTime24);
        const classDurationMin = classEndMin - classStartMin;

        const slotSpan = Math.ceil(classDurationMin / SLOT_INTERVAL_MIN);
        if (slotSpan <= 0) return;

        const contentHeight = slotSpan * ROW_HEIGHT_PIXELS; 

        for (let i = 0; i < TIME_SLOTS.length; i++) {
            const slot = TIME_SLOTS[i];
            const slotStart24 = to24(slot);
            if (!slotStart24) continue;
            const slotStartMin = timeToMinutes(slotStart24);

            if (classStartMin === slotStartMin) {
                const gridKey = `${columnKey}_${slot}`;
                
                const cellContent = (
                    <div 
                         style={{ height: `${contentHeight}px`, marginTop: '0px' }}
                        className="absolute w-full top-0 left-0 px-1.5 z-10"
                    >
                        <div className={`rounded-lg p-2.5 h-full flex flex-col justify-between overflow-hidden ${style.bg} ${style.border} border-l-[3px] shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer`}>
                            <div>
                                <div className={`font-bold text-xs leading-tight mb-0.5 ${style.text}`}>{subjectCode}</div>
                                <div className="text-[10px] text-slate-600 line-clamp-2 leading-tight">{loading.subject.des_title}</div>
                            </div>
                            <div className="mt-1 pt-1.5 border-t border-black/5 flex flex-col justify-end items-start text-[9px] font-semibold text-slate-500 space-y-1">
                                <div className="flex items-center gap-1.5">
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span className="text-slate-700 line-clamp-1">{facultyName}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    <span className="text-slate-700">{roomNumber}</span>
                                    <span className={`${style.badge} px-1 rounded text-xs font-bold uppercase`}>{classType}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>{loading.day} | {timePeriod}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

                gridData[gridKey] = { content: cellContent, rowSpan: slotSpan };
                
                for (let k = 1; k < slotSpan; k++) {
                    if (i + k < TIME_SLOTS.length) {
                         coveredKeys.add(`${columnKey}_${TIME_SLOTS[i + k]}`);
                    }
                }
                break;
            }
        }
    });
    
    return { gridData, coveredKeys };
};


// --- ROOM SCHEDULE VIEW SUB-COMPONENT (FIXED h-24 ROW HEIGHT, Dynamic Content) ---
function RoomScheduleView({ 
    rooms, 
    filteredScheduleData, 
    selectedDayFilter, 
    setSelectedDayFilter, 
    selectedClassType, 
    setSelectedClassType, 
    roomSearchQuery, 
    setRoomSearchQuery 
}: RoomScheduleViewProps) {
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key="room-schedule-content"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 overflow-x-auto"
            >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
                    <h3 className="text-xl font-semibold text-gray-700 flex items-center">
                         <Building2 className="h-5 w-5 mr-2 text-primary" /> Room Schedule Filters
                    </h3>
                    
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        
                        <Select value={selectedDayFilter} onValueChange={setSelectedDayFilter}>
                            <SelectTrigger className="w-full sm:w-[180px] border-primary/50 shadow-sm">
                                <Calendar className="h-4 w-4 mr-2 text-primary" />
                                <SelectValue placeholder="Select Day" />
                            </SelectTrigger>
                            <SelectContent>
                                {DAY_FILTERS.map((filter) => (
                                    <SelectItem key={filter.value} value={filter.value}>
                                        {filter.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedClassType} onValueChange={(value) => setSelectedClassType(value as 'all' | 'LEC' | 'LAB')}> 
                            <SelectTrigger className="w-full sm:w-[150px] border-primary/50 shadow-sm">
                                <Grid3x3 className="h-4 w-4 mr-2 text-primary" />
                                <SelectValue placeholder="Class Type" />
                            </SelectTrigger>
                            <SelectContent>
                                {CLASS_TYPE_FILTERS.map((filter) => (
                                    <SelectItem key={filter.value} value={filter.value}>
                                        {filter.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        
                        <div className="relative w-full sm:w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search Room..." 
                                value={roomSearchQuery}
                                onChange={(e) => setRoomSearchQuery(e.target.value)}
                                className="pl-10 border-primary/50 shadow-sm"
                            />
                        </div>
                    </div>
                </div>
                
                <div>
                    <Table className="w-full table-fixed border-collapse border-slate-200">
                        <TableHeader className="bg-slate-100/50 sticky top-0 z-50 shadow-sm">
                            <TableRow>
                                <TableHead className="h-[3.5rem] border-r border-b border-slate-200 bg-slate-100/50 text-center font-bold text-slate-600 text-xs uppercase tracking-wider" style={{ width: `${REPORT_TIME_COLUMN_WIDTH_PIXELS}px` }}>
                                    Time Slot
                                </TableHead>
                                {rooms.map((room: string) => (
                                    <TableHead key={room} className="h-[3.5rem] border-r border-b border-slate-200 text-center font-bold whitespace-nowrap text-blue-800 text-xs uppercase tracking-wider bg-blue-100/70" style={{ width: `${REPORT_COLUMN_WIDTH_PIXELS}px` }}>
                                        {room}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        
                        <TableBody>
                            {TIME_SLOTS.map((timeSlot) => (
                                <TableRow key={timeSlot} className="h-[72px] border-b border-slate-300 hover:bg-slate-50/70 transition-colors duration-200"> 
                                    <TableCell className="border-r border-r-slate-200 align-top p-0 bg-slate-50/80 sticky left-0 z-5 relative" style={{ width: `${REPORT_TIME_COLUMN_WIDTH_PIXELS}px` }}>
                                        <span className="absolute right-3 top-0 -translate-y-1/2 bg-slate-50/80 px-1 font-semibold text-[11px] text-slate-400 whitespace-nowrap">
                                            {timeSlot}
                                        </span>
                                    </TableCell>

                                    {rooms.map((room: string) => {
                                        const key = `${room}_${timeSlot}`;
                                        const entry = filteredScheduleData.gridData[key];

                                        if (filteredScheduleData.coveredKeys.has(key) && !entry) {
                                            return (
                                                 <TableCell
                                                    key={key}
                                                    className="border-r border-r-slate-300 align-top p-0 text-center text-sm bg-white relative"
                                                    style={{ width: `${REPORT_COLUMN_WIDTH_PIXELS}px` }}
                                                >
                                                </TableCell>
                                            );
                                        }

                                        if (entry) {
                                            return (
                                                <TableCell
                                                    key={key}
                                                    className="border-r border-r-slate-300 align-top p-0 text-center text-sm relative" // IMPORTANT: relative container
                                                    style={{ width: `${REPORT_COLUMN_WIDTH_PIXELS}px` }}
                                                >
                                                    {entry.content} 
                                                </TableCell>
                                            );
                                        }

                                        return (
                                            <TableCell
                                                key={key}
                                                className="border-r border-r-slate-300 align-top p-0 text-center text-sm bg-white relative"
                                                style={{ width: `${REPORT_COLUMN_WIDTH_PIXELS}px` }}
                                            >
                                            
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

// --- YEAR LEVEL VIEW SUB-COMPONENT (FIXED h-24 ROW HEIGHT, Dynamic Content) ---
function YearLevelScheduleView({ backendData }: YearLevelScheduleViewProps) {
    const [selectedDayFilter, setSelectedDayFilter] = useState<string>("all"); 
    const [selectedYearLevel, setSelectedYearLevel] = useState<string>("all");
    const [selectedProgram, setSelectedProgram] = useState<string>("all");
    
    const uniqueYearLevels = useMemo(() => {
        const levels = new Set<number>();
        backendData.forEach((s: ClassSchedule) => s.year_level && levels.add(s.year_level));
        return ["all", ...Array.from(levels).sort()];
    }, [backendData]);

    const uniquePrograms = useMemo(() => {
        const programs = new Set<string>();
        backendData.forEach((s: ClassSchedule) => s.program?.abbreviation && programs.add(s.program.abbreviation));
        return ["all", ...Array.from(programs).sort()];
    }, [backendData]);

    const filteredRawData = useMemo(() => {
        const currentDayFilter = DAY_FILTERS.find(f => f.value === selectedDayFilter);
        const visibleDays = currentDayFilter ? currentDayFilter.days : [];

        return backendData.filter((schedule: ClassSchedule) => {
            const matchesDay = visibleDays.includes(schedule.faculty_loading.day);
            const matchesYear = selectedYearLevel === 'all' || 
                                String(schedule.year_level) === selectedYearLevel;
            const matchesProgram = selectedProgram === 'all' ||
                                   schedule.program?.abbreviation === selectedProgram;
            return matchesDay && matchesYear && matchesProgram;
        });
    }, [selectedDayFilter, backendData, selectedYearLevel, selectedProgram]);
    
    const columns: string[] = useMemo(() => {
        const sections = new Set<string>();
        filteredRawData.forEach((s: ClassSchedule) => {
            if (s.year_level && s.section) {
                sections.add(`${s.year_level}-${s.section}`); 
            }
        });
        return Array.from(sections).sort((a, b) => a.localeCompare(b));
    }, [filteredRawData]);

    const filteredScheduleData: ScheduleGridData = useMemo(() => {
        return transformToSectionGrid(filteredRawData);
    }, [filteredRawData]);


    return (
        <AnimatePresence mode="wait">
            <motion.div
                key="yearlevel-schedule-content"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 overflow-x-auto"
            >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
                    <h3 className="text-xl font-semibold text-gray-700 flex items-center">
                        <GraduationCap className="h-5 w-5 mr-2 text-primary" /> Year Level Schedule Filters
                    </h3>
                    
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        
                        <Select value={selectedDayFilter} onValueChange={setSelectedDayFilter}>
                            <SelectTrigger className="w-full sm:w-[150px] border-primary/50 shadow-sm">
                                <Calendar className="h-4 w-4 mr-2 text-primary" />
                                <SelectValue placeholder="Select Day" />
                            </SelectTrigger>
                            <SelectContent>
                                {DAY_FILTERS.map((filter) => (
                                    <SelectItem key={filter.value} value={filter.value}>
                                        {filter.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedYearLevel} onValueChange={setSelectedYearLevel}>
                            <SelectTrigger className="w-full sm:w-[150px] border-primary/50 shadow-sm">
                                <SelectValue placeholder="Year Level" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Year Levels</SelectItem>
                                {uniqueYearLevels.filter(v => v !== "all").map((level) => (
                                    <SelectItem key={level} value={String(level)}>
                                        Year {level}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                            <SelectTrigger className="w-full sm:w-[150px] border-primary/50 shadow-sm">
                                <SelectValue placeholder="Program" />
                            </SelectTrigger>
                            <SelectContent>
                                {uniquePrograms.map((program) => (
                                    <SelectItem key={program} value={program}>
                                        {program === "all" ? "All Programs" : program}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div>
                    <Table className="w-full table-fixed border-collapse border-slate-200">
                        <TableHeader className="bg-slate-100/50 sticky top-0 z-50 shadow-sm">
                            <TableRow>
                                <TableHead className="h-[3.5rem] border-r border-b border-slate-200 bg-slate-100/50 text-center font-bold text-slate-600 text-xs uppercase tracking-wider" style={{ width: `${REPORT_TIME_COLUMN_WIDTH_PIXELS}px` }}>
                                    Time Slot
                                </TableHead>
                                {columns.map((columnKey) => (
                                    <TableHead key={columnKey} className="h-[3.5rem] border-r border-b border-slate-200 text-center font-bold whitespace-nowrap text-blue-800 text-xs uppercase tracking-wider bg-blue-100/70" style={{ width: `${REPORT_COLUMN_WIDTH_PIXELS}px` }}>
                                        {columnKey.replace('-', ' - Section ')}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        
                        <TableBody>
                            {TIME_SLOTS.map((timeSlot) => (
                                <TableRow key={timeSlot} className="h-[72px] border-b border-slate-300 hover:bg-slate-50/70 transition-colors duration-200">
                                    <TableCell className="border-r border-r-slate-200 align-top p-0 bg-slate-50/80 sticky left-0 z-5 relative" style={{ width: `${REPORT_TIME_COLUMN_WIDTH_PIXELS}px` }}>
                                        <span className="absolute right-3 top-0 -translate-y-1/2 bg-slate-50/80 px-1 font-semibold text-[11px] text-slate-400 whitespace-nowrap">
                                            {timeSlot}
                                        </span>
                                    </TableCell>

                                    {columns.map((columnKey: string) => {
                                        const key = `${columnKey}_${timeSlot}`;
                                        const entry = filteredScheduleData.gridData[key];

                                        if (filteredScheduleData.coveredKeys.has(key) && !entry) {
                                            return (
                                                <TableCell
                                                    key={key}
                                                    className="border-r border-r-slate-300 align-top p-0 text-center text-sm bg-white relative"
                                                    style={{ width: `${REPORT_COLUMN_WIDTH_PIXELS}px` }}
                                                >
                                                </TableCell>
                                            );
                                        }

                                        if (entry) {
                                            return (
                                                <TableCell
                                                    key={key}
                                                    className="border-r border-r-slate-300 align-top p-0 text-center text-sm relative" // IMPORTANT: relative container
                                                    style={{ width: `${REPORT_COLUMN_WIDTH_PIXELS}px` }}
                                                >
                                                    {entry.content}
                                                </TableCell>
                                            );
                                        }

                                        return (
                                            <TableCell
                                                key={key}
                                                className="border-r border-r-slate-300 align-top p-0 text-center text-sm bg-white relative"
                                                style={{ width: `${REPORT_COLUMN_WIDTH_PIXELS}px` }}
                                            >
                                               
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {columns.length === 0 && (
                         <div className="p-8 text-center text-muted-foreground bg-muted/50 rounded-lg mt-4">
                            No schedule data found for the selected filters.
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}


// --- MAIN FACULTY SCHEDULES VIEW COMPONENT (Wrapper for Sub-Views) ---
const API_URL = 'get-classSchedule-reports';
const TOKEN_KEY = 'accessToken'; 

export function FacultySchedulesView() {
    const [activeSubTab, setActiveSubTab] = useState<"room" | "yearLevel">("room"); 
    const [backendData, setBackendData] = useState<ClassSchedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    
    const [selectedDayFilter, setSelectedDayFilter] = useState<string>("all"); 
    const [selectedClassType, setSelectedClassType] = useState<'all' | 'LEC' | 'LAB'>('all');
    const [roomSearchQuery, setRoomSearchQuery] = useState<string>('');


    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setIsError(false);
            const accessToken = localStorage.getItem(TOKEN_KEY);
            if (!accessToken) {
                setIsLoading(false);
                return;
            }
            
            try {
                const response = await axios.get<BackendResponse>(API_URL, {
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
                });

                if (response.data.success && Array.isArray(response.data.classSchedule)) {
                    setBackendData(response.data.classSchedule);
                } else {
                    throw new Error('Invalid data structure');
                }
            } catch (error) {
                console.error("Error fetching class schedule:", error);
                setIsError(true);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []); 
    
    const filteredRawDataRoomView = useMemo(() => {
        const currentFilter = DAY_FILTERS.find(f => f.value === selectedDayFilter);
        const visibleDays = currentFilter ? currentFilter.days : [];
        
        return backendData.filter((schedule: ClassSchedule) => {
            const matchesDay = visibleDays.includes(schedule.faculty_loading.day);
            const matchesType = selectedClassType === 'all' || 
                                schedule.faculty_loading.type === selectedClassType;
            return matchesDay && matchesType;
        });
    }, [selectedDayFilter, backendData, selectedClassType]);
    
    const rooms: string[] = useMemo(() => {
        const set = new Set<string>();
        filteredRawDataRoomView.forEach((s: ClassSchedule) => {
            const rn = s?.faculty_loading?.room?.roomNumber;
            if (rn && rn.toString().trim() !== '') set.add(rn.toString());
        });
        
        return Array.from(set)
            .filter((room: string) => room.toLowerCase().includes(roomSearchQuery.toLowerCase()))
            .sort((a, b) => a.localeCompare(b));
    }, [filteredRawDataRoomView, roomSearchQuery]);

    const filteredScheduleDataRoom: ScheduleGridData = useMemo(() => {
        const finalRoomFilteredData = filteredRawDataRoomView.filter(s => rooms.includes(s.faculty_loading.room.roomNumber));
        return transformToRoomGrid(finalRoomFilteredData);
    }, [filteredRawDataRoomView, rooms]);


    if (isLoading) {
        return (
            <div className="p-10 text-center flex flex-col items-center justify-center text-primary">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <p>Loading class schedules...</p>
            </div>
        );
    }
    
    if (isError) {
        return <div className="p-10 text-center text-destructive border border-destructive/50 rounded-lg">Error loading class schedule data.</div>;
    }


    return (
        <div className="w-full">
            <div className="border-b border-border mb-6">
                <div className="inline-flex items-center gap-1 bg-muted p-1 rounded-lg">
                    <Button
                        variant={activeSubTab === "room" ? "default" : "ghost"}
                        onClick={() => setActiveSubTab("room")}
                        className="flex items-center gap-2 px-4 py-2 h-9 text-sm font-semibold transition-all"
                    >
                        <Building2 size={16} /> Room Schedule View
                    </Button>
                    <Button
                        variant={activeSubTab === "yearLevel" ? "default" : "ghost"}
                        onClick={() => setActiveSubTab("yearLevel")}
                        className="flex items-center gap-2 px-4 py-2 h-9 text-sm font-semibold transition-all"
                    >
                        <GraduationCap size={16} /> Year Level View
                    </Button>
                </div>
            </div>

            {activeSubTab === "room" && (
                <RoomScheduleView 
                    rooms={rooms}
                    filteredScheduleData={filteredScheduleDataRoom}
                    selectedDayFilter={selectedDayFilter}
                    setSelectedDayFilter={setSelectedDayFilter}
                    selectedClassType={selectedClassType}
                    setSelectedClassType={setSelectedClassType}
                    roomSearchQuery={roomSearchQuery}
                    setRoomSearchQuery={setRoomSearchQuery}
                />
            )}

            {activeSubTab === "yearLevel" && (
                <YearLevelScheduleView backendData={backendData} />
            )}
        </div>
    );
}

export default FacultySchedulesView;
