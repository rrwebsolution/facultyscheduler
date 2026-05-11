import { useState, useMemo, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, CalendarX2, CheckCircle, AlertTriangle, Check, ChevronRight, Clock } from 'lucide-react';
import { toast } from 'sonner';
import axios from '../../../../plugin/axios'; 
import type { Faculty, Subject } from '../type'; 
// import { FacultyScheduleDisplay } from './FacultyScheduleDisplay'; // This remains removed
import { Label } from '@/components/ui/label';
import type { Room } from '../../room/classroom';

// --- HELPER FUNCTIONS (No change) ---
const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

const minutesToTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const addMinutesToTime = (timeStr: string, add: number): string => {
    if (!timeStr) return '';
    const total = timeToMinutes(timeStr) + add;
    const bounded = Math.max(0, Math.min(23 * 60 + 59, total));
    return minutesToTime(bounded);
};

// Days of week constant used by selects
const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Format HH:MM (24h) into 12-hour format for user-friendly messages
const formatTime12 = (timeStr: string) => {
    if (!timeStr) return '--:--';
    const [hh, mm] = timeStr.split(':').map(Number);
    const period = (hh ?? 0) >= 12 ? 'PM' : 'AM';
    const hour12 = (hh ?? 0) % 12 === 0 ? 12 : (hh ?? 0) % 12;
    return `${hour12}:${String(mm ?? 0).padStart(2, '0')} ${period}`;
};

// Check if two time ranges overlap. times are strings 'HH:MM'
const timesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
    const as = timeToMinutes(aStart);
    const ae = timeToMinutes(aEnd);
    const bs = timeToMinutes(bStart);
    const be = timeToMinutes(bEnd);
    if (!as || !ae || !bs || !be) return false;
    return as < be && ae > bs;
};

// Simple room type matching helper: allow case-insensitive contains check
const matchesRoomType = (roomType: string | undefined, expectedType: string) => {
    if (!roomType) return false;
    try {
        return roomType.toString().toLowerCase().includes(expectedType.toString().toLowerCase());
    } catch (e) {
        return false;
    }
};

// --- INTERFACE (No change from original) ---
interface SubjectWithTotalUnits extends Subject {
    total_units: number;
}
interface AssignSubjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
    faculty: Faculty;
    availableSubjects: SubjectWithTotalUnits[];
    onAssign: (facultyId: number, subjectId: number, schedules: { type: 'LEC' | 'LAB', day: string, time: string, roomId: number }[]) => void;
}

interface Schedule { [day: string]: { start: string; end: string }[]; }
interface LoadingState { lec: boolean; lab: boolean; }

// Local schedule shape used for the form state
// UPDATED: Added pairedDays array
interface LocalSchedule { day: string; startTime: string; endTime: string; pairedDays?: string[] } 

// ----------------------------------------------------------------------
// ScheduleInputGroup (Logic for disabling unavailable/selected days in pairedDays checkbox)
// ----------------------------------------------------------------------
const ScheduleInputGroup = ({ 
    type, 
    hours, 
    schedules, 
    facultySchedule, 
    onScheduleChange, 
    onTogglePairedDay,
    timeError 
}: { 
    type: 'lec' | 'lab', 
    hours: number, 
    schedules: any, 
    facultySchedule: Schedule, 
    onScheduleChange: (type: 'lec' | 'lab', field: string, value: string) => void,
    onTogglePairedDay: (type: 'lec' | 'lab', day: string) => void,
    timeError: string | null
}) => {
    const timeBounds = useMemo(() => {
        const day = schedules[type].day;
        if (!day || !facultySchedule[day]?.length) return { min: undefined, max: undefined };
        const slots = facultySchedule[day];
        const min = slots.reduce((e: string, c: any) => (c.start < e ? c.start : e), slots[0].start);
        const max = slots.reduce((l: string, c: any) => (c.end > l ? c.end : l), slots[0].end);
        return { min, max };
    }, [schedules[type].day, facultySchedule, type, schedules]);

    const selectedDay = schedules[type].day; // Get the currently selected day

    return (
        <div className="pt-4 border-t space-y-4">
            <h4 className="font-semibold text-md text-foreground">{type === 'lec' ? 'Lecture' : 'Laboratory'} Schedule ({hours} hours)</h4>
            <div className="grid grid-cols-1 gap-4">
                <div>
                    <Label htmlFor={`${type}-day`}>Day of Class</Label>
                    <select id={`${type}-day`} value={schedules[type].day} onChange={(e) => onScheduleChange(type, 'day', e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-background disabled:opacity-50">
                        <option value="" disabled>Select a day</option>
                        {/* Option disabled if faculty has no availability on that day */}
                        {daysOfWeek.map((d: string) => <option key={d} value={d} disabled={!facultySchedule[d]?.length}>{d} {!facultySchedule[d]?.length && '(Unavailable)'}</option>)}
                    </select>

                    {/* Paired days checkboxes (Monday - Saturday) - Logic for disabling is here */}
                    {selectedDay && ( // Check if a day is selected before displaying the paired days option
                        <div className="mt-2"> 
                            <Label className="text-sm">Pair With (weekdays)</Label>
                            <div className="grid grid-cols-6 gap-2 mt-2">
                                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d) => {
                                    const checked = Array.isArray(schedules[type].pairedDays) && schedules[type].pairedDays.includes(d);
                                    
                                    // LOGIC: Disable if faculty is unavailable OR if it's the selected Day of Class
                                    const isSelectedDay = d === selectedDay;
                                    const isUnavailable = !facultySchedule[d]?.length; // Check if facultySchedule[d] has entries
                                    const disabled = isUnavailable || isSelectedDay;
                                    
                                    return (
                                        <label key={d} className="inline-flex items-center gap-2 text-xs">
                                            <input 
                                                type="checkbox" 
                                                checked={checked} 
                                                onChange={() => onTogglePairedDay(type, d)} 
                                                disabled={disabled} 
                                                className="h-4 w-4" 
                                            />
                                            <span className="truncate">{d.slice(0,3)}</span>
                                            {isSelectedDay && <span className='text-[10px] text-primary/70'>(Main)</span>}
                                            {isUnavailable && !isSelectedDay && <span className='text-[10px] text-destructive/70'>(X)</span>}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor={`${type}-start-time`} className="text-xs font-semibold text-muted-foreground">Start Time</Label>
                    <div className="relative mt-1">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id={`${type}-start-time`} 
                            type="time" 
                            value={schedules[type].startTime} 
                            onChange={e => onScheduleChange(type, 'startTime', e.target.value)} 
                            className="pl-9" 
                            step="1800" 
                            min={timeBounds.min} 
                            max={timeBounds.max} 
                            disabled={!schedules[type].day} 
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor={`${type}-end-time`} className="text-xs font-semibold text-muted-foreground">End Time</Label>
                    <div className="relative mt-1">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id={`${type}-end-time`} 
                            type="time" 
                            value={schedules[type].endTime} 
                            onChange={e => onScheduleChange(type, 'endTime', e.target.value)} 
                            className="pl-9" 
                            step="1800" 
                            min={timeBounds.min} 
                            max={timeBounds.max} 
                            disabled={!schedules[type].day} 
                        />
                    </div>
                </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    {(() => {
                        const formatShort = (t?: string) => { if (!t) return '--:--'; const parts = t.split(':'); return `${parts[0]?.padStart(2, '0')}:${parts[1]?.padStart(2, '0')}`; };
                        return `Window: ${formatShort(timeBounds.min)} - ${formatShort(timeBounds.max)}`;
                    })()}
                </p>
                {(hours ?? 0) > 0 && schedules[type].startTime && (
                    <Button 
                        type="button" 
                        size="sm" 
                        variant="outline" 
                        onClick={() => onScheduleChange(type, 'endTime', addMinutesToTime(schedules[type].startTime, (hours || 0) * 60))}
                    >
                        Auto-fill end (+{hours}h)
                    </Button>
                )}
            </div>
            {timeError && (
                <div className="flex items-center gap-2 p-2 bg-destructive/10 border-destructive/30 rounded-lg text-destructive text-sm"><AlertTriangle className="h-4 w-4 flex-shrink-0" /><p>{timeError}</p></div>
            )}
        </div>
    );
};

// ----------------------------------------------------------------------
// RoomSelectionGroup (No change)
// ----------------------------------------------------------------------
const RoomSelectionGroup = ({ 
    type, 
    schedules, 
    availableRooms, 
    isLoadingRooms,
    selectedRooms, 
    onSelectRoom
}: { 
    type: 'lec' | 'lab', 
    schedules: any, 
    availableRooms: any, 
    isLoadingRooms: LoadingState, 
    selectedRooms: any, 
    onSelectRoom: (type: 'lec' | 'lab', roomId: number) => void
}) => {
    
    const selDay = schedules[type].day || '';
    const selStart = schedules[type].startTime || '';
    const selEnd = schedules[type].endTime || '';
    const expectedType = type === 'lec' ? 'Lecture' : 'Laboratory';
    
    // Determine the rooms that are AVAILABLE for the *exact time slot* (based on backend filter + frontend general avail filter)
    const availableRoomIds = useMemo(() => {
        if (!selDay || !selStart || !selEnd) return new Set<number>();
        
        const validRooms = availableRooms[type].filter((room: any) => {
            if (!matchesRoomType((room as any).type, expectedType)) return false;
            
            // Check general availability blocks containment
            const roomAvail: any[] = (room as any).availabilities || [];
            const availForDay = roomAvail.filter((a: any) => (a.day || '').toString().toLowerCase() === selDay.toString().toLowerCase());
            return availForDay.some((a: any) => {
                const aStart = a.start_time ?? a.start ?? '';
                const aEnd = a.end_time ?? a.end ?? '';
                if (!aStart || !aEnd) return false;
                return timeToMinutes(aStart) <= timeToMinutes(selStart) && timeToMinutes(aEnd) >= timeToMinutes(selEnd);
            });
        });
        return new Set(validRooms.map((r: any) => r.id));
    }, [availableRooms, type, selDay, selStart, selEnd, expectedType]);

    // Rooms to show (only rooms that match the expected type AND are available for the selected time slot)
    const roomsToShow = (availableRooms[type] || []).filter((room: any) => matchesRoomType(room.type, expectedType) && availableRoomIds.has(room.id));
    const isScheduleComplete = !!selDay && !!selStart && !!selEnd;

    const formattedTimeSlot = isScheduleComplete ? `${formatTime12(selStart)} - ${formatTime12(selEnd)}` : '--:-- - --:--';

    return (
        <div className="pt-4 border-t space-y-3">
            {isLoadingRooms[type] ? ( 
                <div className="flex items-center justify-center h-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
                (() => {
                    if (!isScheduleComplete) {
                        return <p className="text-sm text-muted-foreground text-center py-4">Set a full valid day and time schedule to view room status.</p>;
                    }
                    
                    if (roomsToShow.length === 0) {
                        return (
                            <div className="flex flex-col items-center justify-center h-24 text-center text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                                <AlertTriangle className="h-5 w-5 mb-1 flex-shrink-0" />
                                <p className="text-sm font-semibold">ALL {expectedType.toUpperCase()} ROOMS ARE BUSY</p>
                                <p className="text-xs text-muted-foreground mt-1">No rooms are free for the slot: ({selDay}, {formattedTimeSlot}). Please change the time or day.</p>
                            </div>
                        );
                    }

                    return (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-2 -mr-2">
                                {roomsToShow.map((room: any) => {
                                    const isAvailable = availableRoomIds.has(room.id);
                                    
                                    const label = isAvailable ? 'MATCH SCHED' : 'BUSY'; 
                                    const labelClass = isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
                                    const cardClass = isAvailable 
                                        ? (selectedRooms[type] === room.id ? 'bg-primary/10 border-primary shadow-sm' : 'bg-background hover:border-primary/50')
                                        : 'bg-red-50 border-red-300 opacity-70 cursor-not-allowed';

                                    return (
                                        <button 
                                            key={room.id} 
                                            onClick={() => isAvailable && onSelectRoom(type, room.id)}
                                            disabled={!isAvailable}
                                            className={`p-2 border rounded-md text-left transition-all relative ${cardClass}`}
                                        >
                                            {/* --- LABEL INSIDE BUTTON --- */}
                                            <div className={`absolute top-0 right-0 p-1 px-2 rounded-tr-md rounded-bl-md text-xs font-semibold ${labelClass}`}>
                                                {label}
                                            </div>
                                            
                                            {selectedRooms[type] === room.id && isAvailable && <Check className="h-4 w-4 text-primary absolute top-2 right-2 mt-2" />}
                                            
                                            <p className="font-semibold text-sm pt-2">{room.roomNumber}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-xs text-muted-foreground">Cap: {room.capacity ?? '--'}</p>
                                                {room.type && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">{room.type}</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()
            )}
        </div>
    );
};


// ----------------------------------------------------------------------
// MAIN COMPONENT: AssignSubjectDialog 
// ----------------------------------------------------------------------
export function AssignSubjectDialog({ isOpen, onClose, faculty, availableSubjects = [], onAssign }: AssignSubjectDialogProps) {
    const [step, setStep] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSubject, setSelectedSubject] = useState<SubjectWithTotalUnits | null>(null); 
    
    // REMOVED: const [section, setSection] = useState(''); 

    const [currentAssignedUnits, setCurrentAssignedUnits] = useState<number>(0);
    const [isLoadingCurrentLoad, setIsLoadingCurrentLoad] = useState(true);
    const [_assignedSubjectIds, setAssignedSubjectIds] = useState<number[]>([]); 

    const [displayedSubjects, setDisplayedSubjects] = useState<SubjectWithTotalUnits[]>([]);
    const [isSearchingSubject, setIsSearchingSubject] = useState(false);
    const [allSubjects, setAllSubjects] = useState<SubjectWithTotalUnits[] | null>(null);

    const [schedules, setSchedules] = useState<{ lec: LocalSchedule; lab: LocalSchedule }>({
        lec: { day: '', startTime: '', endTime: '', pairedDays: [] },
        lab: { day: '', startTime: '', endTime: '', pairedDays: [] },
    });
    const [selectedRooms, setSelectedRooms] = useState<{ lec: number | null, lab: number | null }>({ lec: null, lab: null });
    const [availableRooms, setAvailableRooms] = useState<{ lec: Room[], lab: Room[] }>({ lec: [], lab: [] });
    const [isLoadingRooms, setIsLoadingRooms] = useState<LoadingState>({ lec: false, lab: false }); 
    const [timeErrors, setTimeErrors] = useState<{ lec: string | null; lab: string | null }>({ lec: null, lab: null });
    const [facultySchedule, setFacultySchedule] = useState<Schedule>({});
    const [facultyAssignedSchedules, setFacultyAssignedSchedules] = useState<any[]>([]); 
    const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeScheduleType, setActiveScheduleType] = useState<'lec' | 'lab' | null>(null);
    const [serverErrors, setServerErrors] = useState<{ general?: string; lec?: string; lab?: string }>({}); 

    // --- FIX: Wrapped in useCallback and used as a dependency ---
    const resetAllStates = useCallback(() => {
        setStep(1);
        setSearchQuery('');
        setSelectedSubject(null);
        // REMOVED: setSection('');
        setSchedules({ lec: { day: '', startTime: '', endTime: '', pairedDays: [] }, lab: { day: '', startTime: '', endTime: '', pairedDays: [] } });
        setSelectedRooms({ lec: null, lab: null });
        setAvailableRooms({ lec: [], lab: [] });
        setTimeErrors({ lec: null, lab: null });
        setActiveScheduleType(null);
        setIsSubmitting(false);
        setServerErrors({}); 
    }, []);
    // --- END FIX ---

    useEffect(() => {
        if (isOpen) {
            // Reset states
            setSearchQuery(''); 
            resetAllStates(); 

            // Subject fetching logic... (no change)
            if (availableSubjects && Array.isArray(availableSubjects)) {
                const mappedFromProp: SubjectWithTotalUnits[] = availableSubjects.map((s: any) => {
                    const lec = s.total_lec_hrs ?? s.lec_units ?? 0;
                    const lab = s.total_lab_hrs ?? s.lab_units ?? 0;
                    const calculated_hrs = s.total_hrs ?? (lec + lab);
                    return {
                        ...s,
                        total_lec_hrs: lec,
                        total_lab_hrs: lab,
                        total_hrs: calculated_hrs,
                        total_units: s.total_units ?? calculated_hrs
                    };
                });
                setAllSubjects(mappedFromProp);
                setDisplayedSubjects(mappedFromProp);
            } else {
                const fetchSubjects = async () => {
                    setIsSearchingSubject(true);
                    try {
                        const token = localStorage.getItem('accessToken');
                        let response;
                        try {
                            response = await axios.get('get-subjects', { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
                        } catch (e) {
                            response = await axios.get('get-subjects');
                        }
                        const items: any[] = response.data?.subject || response.data?.data || [];
                        const mapped: SubjectWithTotalUnits[] = items.map(item => {
                            const lec = item.total_lec_hrs ?? item.lec_units ?? 0;
                            const lab = item.total_lab_hrs ?? item.lab_units ?? 0;
                            const calculated_hrs = item.total_hrs ?? (lec + lab);
                            return ({
                                ...item,
                                total_lec_hrs: lec,
                                total_lab_hrs: lab,
                                total_hrs: calculated_hrs,
                                total_units: item.total_units ?? calculated_hrs
                            });
                        });
                        setAllSubjects(mapped);
                        setDisplayedSubjects(mapped);
                    } catch (e) { const error = e as any;
                        console.error('Failed to fetch subjects:', error);
                        setDisplayedSubjects([]);
                        setAllSubjects([]);
                    } finally {
                        setIsSearchingSubject(false);
                    }
                };
                fetchSubjects();
            }
            
            if (faculty) {
                // Fetch Current Assigned Units (no change)
                const fetchCurrentLoad = async () => {
                    setIsLoadingCurrentLoad(true);
                    const token = localStorage.getItem('accessToken');
                    if (!token) { setIsLoadingCurrentLoad(false); return; }
                    try {
                        const loadRes = await axios.get(`/faculties/${faculty.id}/current-load`, { headers: { Authorization: `Bearer ${token}` } });
                        setCurrentAssignedUnits(loadRes.data.current_load_units ?? 0);
                        setAssignedSubjectIds(loadRes.data.assigned_subject_ids ?? loadRes.data.assigned_subjects ?? []);
                    } catch (e) { const error = e as any;
                        console.error("Error fetching current load:", error);
                        setCurrentAssignedUnits(0); 
                        toast.error("Failed to fetch faculty's current load.");
                    } finally { 
                        setIsLoadingCurrentLoad(false); 
                    }
                }
                // Fetch Availability (no change)
                const fetchAvailability = async () => {
                    setIsLoadingSchedule(true);
                    const token = localStorage.getItem('accessToken');
                    if (!token) { setIsLoadingSchedule(false); return; }
                    try {
                        const response = await axios.get(`/faculties/${faculty.id}/availability`, { headers: { Authorization: `Bearer ${token}` } });
                        setFacultySchedule(response.data);
                    } catch (e) { setFacultySchedule({}); }
                    finally { setIsLoadingSchedule(false); }
                };
                // Fetch assigned schedules to perform client-side conflict detection (no change)
                const fetchAssignedSchedules = async () => {
                    const token = localStorage.getItem('accessToken');
                    if (!token) { setFacultyAssignedSchedules([]); return; }
                    try {
                        const resp = await axios.get(`faculty-loading/${faculty.id}/schedules`, { headers: { Authorization: `Bearer ${token}` } });
                        const data = resp.data?.data || resp.data || [];
                        setFacultyAssignedSchedules(Array.isArray(data) ? data : []);
                    } catch (e) { const error = e as any;
                        console.error('Failed to fetch assigned schedules', error);
                        setFacultyAssignedSchedules([]);
                    }
                };
                fetchCurrentLoad();
                fetchAvailability();
                fetchAssignedSchedules();
            }
        }
    }, [isOpen, faculty, availableSubjects, resetAllStates]); 

    // --- Load Calculation (Memoized - No change) ---
    const { 
        maxNormalLoad,
        maxOverload,
        totalAllowedLoad, 
        potentialTotalLoad, 
        isLoadExceeded,
        isOverloadApplied
    } = useMemo(() => {
        const maxNormalLoad = faculty.t_load_units ?? 0;
        const maxOverload = faculty.overload_units ?? 0;
        const totalAllowedLoad = maxNormalLoad + maxOverload;
        const newSubjectUnits = selectedSubject?.total_hrs ?? selectedSubject?.total_units ?? 0;
        const potentialTotalLoad = currentAssignedUnits + newSubjectUnits;
        const isLoadExceeded = totalAllowedLoad > 0 && potentialTotalLoad > totalAllowedLoad;
        // isOverloadApplied is true if the potential load is above the normal load BUT NOT above the total allowed load
        const isOverloadApplied = maxNormalLoad > 0 && potentialTotalLoad > maxNormalLoad && !isLoadExceeded;
        
        return { 
            maxNormalLoad, 
            maxOverload, 
            totalAllowedLoad, 
            potentialTotalLoad, 
            isLoadExceeded,
            isOverloadApplied
        };
    }, [faculty, currentAssignedUnits, selectedSubject]);

    const newSubjectUnits = selectedSubject?.total_hrs ?? selectedSubject?.total_units ?? 0;

    // --- MANUAL SEARCH HANDLER (No change) ---
    const handleSearchClick = async () => {
        const q = searchQuery.trim();
        if (!q) { if (allSubjects) { setDisplayedSubjects(allSubjects); } return; }

        setIsSearchingSubject(true);
        try {
            const token = localStorage.getItem('accessToken');
            let resp;
            try {
                resp = await axios.get('filter-subjects', { params: { subject: q }, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
            } catch (e) {
                resp = await axios.get('filter-subjects', { params: { subject: q } });
            }

            const items = resp.data?.data || resp.data?.subject || [];
            const mapped = (items as any[]).map((item: any) => {
                const lec = item.total_lec_hrs ?? item.lec_units ?? 0;
                const lab = item.total_lab_hrs ?? item.lab_units ?? 0;
                const calculated_hrs = item.total_hrs ?? (lec + lab);
                return ({
                    id: item.id,
                    subject_code: item.subject_code,
                    des_title: item.des_title,
                    total_lec_hrs: lec,
                    total_lab_hrs: lab,
                    total_hrs: calculated_hrs,
                    total_units: item.total_units ?? calculated_hrs
                });
            });

            setDisplayedSubjects(mapped as SubjectWithTotalUnits[]);
        } catch (e) { const error = e as any;
            console.error('Subject search failed:', error);
            toast.error('Search failed');
            setDisplayedSubjects([]);
        } finally {
            setIsSearchingSubject(false);
        }
    };

    // Step Transition (No change)
    useEffect(() => { if (selectedSubject) setStep(2); }, [selectedSubject]);

    // Validation (No change)
    useEffect(() => {
        const validate = (type: 'lec' | 'lab', hours: number) => {
            const { day, startTime, endTime } = schedules[type];
            if (!startTime || !endTime || !selectedSubject || !day || hours === 0) return null;
            const startMinutes = timeToMinutes(startTime);
            const endMinutes = timeToMinutes(endTime);
            const requiredDuration = hours * 60;
            const actualDuration = endMinutes - startMinutes;
            if (startMinutes >= endMinutes) return "End time must be after start time.";
            if (actualDuration > requiredDuration) return `Duration cannot exceed ${hours} hour(s).`; 
            const dayAvailability = facultySchedule[day];
            if (!dayAvailability?.length) return "Faculty is not available on this day.";
            const isWithin = dayAvailability.some(slot =>
                startMinutes >= timeToMinutes(slot.start) && endMinutes <= timeToMinutes(slot.end)
            );
            if (!isWithin) return "Time is outside faculty's availability.";
            return null;
        };
        if (selectedSubject) {
            setTimeErrors({
                lec: validate('lec', selectedSubject.total_lec_hrs ?? 0),
                lab: validate('lab', selectedSubject.total_lab_hrs ?? 0),
            });
        }
    }, [schedules, selectedSubject, facultySchedule]);

    // Fetch Rooms Logic (No change)
    const fetchAvailableRooms = useCallback(async (type: 'lec' | 'lab') => {
        const schedule = schedules[type];
        if (!schedule.day || !schedule.startTime || !schedule.endTime || timeErrors[type]) {
            setAvailableRooms(prev => ({...prev, [type]: []}));
            return;
        }

        setIsLoadingRooms(prev => ({ ...prev, [type]: true }));
        const token = localStorage.getItem('accessToken');
        if (!token) { setIsLoadingRooms(prev => ({ ...prev, [type]: false })); return; }

        try {
            const response = await axios.get('/rooms/availabilities', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    day: schedule.day,
                    start_time: schedule.startTime, 
                    end_time: schedule.endTime,
                    type: type === 'lec' ? 'Lecture' : 'Laboratory', 
                }
            });
            const rooms: any[] = response.data.rooms || [];
            const roomsWithAvail = await Promise.all(rooms.map(async (room) => {
                try {
                    const r = await axios.get(`/rooms/${room.id}/availabilities`, { headers: { Authorization: `Bearer ${token}` } });
                    return { ...room, availabilities: r.data.availabilities || [] }; 
                } catch (e) { return { ...room, availabilities: [] }; }
            }));
            setAvailableRooms(prev => ({...prev, [type]: roomsWithAvail}));
        } catch (e) {
            toast.error(`Failed to fetch available ${type} rooms.`);
            setAvailableRooms(prev => ({...prev, [type]: []}));
        } finally {
            setIsLoadingRooms(prev => ({ ...prev, [type]: false }));
        }
    }, [schedules, timeErrors]);

    const isLecScheduleValid = useMemo(() => (selectedSubject?.total_lec_hrs ?? 0) > 0 ? (schedules.lec.day && schedules.lec.startTime && schedules.lec.endTime && !timeErrors.lec) : true, [schedules.lec, timeErrors.lec, selectedSubject]);
    const isLabScheduleValid = useMemo(() => (selectedSubject?.total_lab_hrs ?? 0) > 0 ? (schedules.lab.day && schedules.lab.startTime && schedules.lab.endTime && !timeErrors.lab) : true, [schedules.lab, timeErrors.lab, selectedSubject]);

    useEffect(() => {
        if (activeScheduleType === 'lec' && isLecScheduleValid && (selectedSubject?.total_lec_hrs ?? 0) > 0) {
            fetchAvailableRooms('lec');
        }
    }, [activeScheduleType, isLecScheduleValid, schedules.lec, selectedSubject, fetchAvailableRooms]);

    useEffect(() => {
        if (activeScheduleType === 'lab' && isLabScheduleValid && (selectedSubject?.total_lab_hrs ?? 0) > 0) {
            fetchAvailableRooms('lab');
        }
    }, [activeScheduleType, isLabScheduleValid, schedules.lab, selectedSubject, fetchAvailableRooms]);

    useEffect(() => { if (!selectedSubject) { setStep(1); setActiveScheduleType(null); } }, [selectedSubject]);

    // WRAPPER Handlers (No change)
    const handleScheduleChange = (type: 'lec' | 'lab', field: string, value: string) => {
        setSchedules(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
        setSelectedRooms(prev => ({...prev, [type]: null}));
        setActiveScheduleType(type);
        // Clear server errors when user edits schedule
        setServerErrors(prev => ({ ...prev, general: undefined, [type]: undefined }));
    };

    const handleSelectRoom = (type: 'lec' | 'lab', roomId: number) => {
        setSelectedRooms(prev => ({...prev, [type]: roomId}));
        // Clear server errors when selecting a room
        setServerErrors(prev => ({ ...prev, general: undefined, [type]: undefined }));
    };

    const handleTogglePairedDay = (type: 'lec' | 'lab', day: string) => {
        setSchedules(prev => {
            const cur = prev[type].pairedDays ?? [];
            const next = cur.includes(day) ? cur.filter(d => d !== day) : [...cur, day];
            return { ...prev, [type]: { ...prev[type], pairedDays: next } };
        });
        setActiveScheduleType(type);
        setServerErrors(prev => ({ ...prev, general: undefined, [type]: undefined }));
    };

    // Count unique total subjects (No change)
    const uniqueTotalSubjectCount = useMemo(() => {
        try {
            const src = allSubjects && allSubjects.length ? allSubjects : displayedSubjects || [];
            const ids = new Set<any>();
            (src || []).forEach((s: any) => {
                const id = s.id ?? s.subject_id ?? s.subjectId ?? null;
                if (id != null) ids.add(id);
            });
            return ids.size;
        } catch (e) {
            return 0;
        }
    }, [allSubjects, displayedSubjects]);

    // UPDATED: Added pairedDays to the payload for backend
    const handleAssignClick = async () => {
        if (!selectedSubject) return;
        
        if (isLoadExceeded) {
             toast.error(`Assignment blocked: Potential load of ${potentialTotalLoad} exceeds maximum allowed load of ${totalAllowedLoad} units.`);
             return;
        }

        const schedulesToAssign: { type: 'LEC' | 'LAB', day: string, time: string, roomId: number, pairedDays?: string[] }[] = [];

        if ((selectedSubject.total_lec_hrs ?? 0) > 0) {
            const { day, startTime, endTime, pairedDays } = schedules.lec;
            if (!day || !startTime || !endTime || !selectedRooms.lec) { toast.error("Incomplete lecture schedule or room selection."); return; }
            schedulesToAssign.push({ type: 'LEC', day, time: `${startTime}-${endTime}`, roomId: selectedRooms.lec, pairedDays });
        }
        if ((selectedSubject.total_lab_hrs ?? 0) > 0) {
            const { day, startTime, endTime, pairedDays } = schedules.lab;
            if (!day || !startTime || !endTime || !selectedRooms.lab) { toast.error("Incomplete laboratory schedule or room selection."); return; }
            schedulesToAssign.push({ type: 'LAB', day, time: `${startTime}-${endTime}`, roomId: selectedRooms.lab, pairedDays });
        }

        setIsSubmitting(true);
        // Client-side conflict detection against already assigned schedules (simplified since backend handles it better now, but kept as first line defense)
        try {
            // Simplified check only for the main day schedule in the frontend
            for (const s of schedulesToAssign) {
                const [sStart, sEnd] = s.time.split('-');
                const daysToCheck = [s.day, ...(s.pairedDays || [])]; // Include paired days for F/E check
                
                for(const day of daysToCheck) {
                    for (const existing of facultyAssignedSchedules) {
                        if (!existing.day) continue;
                        if (existing.day.toString().toLowerCase() !== day.toString().toLowerCase()) continue;
                        const eStart = existing.start_time ?? existing.start ?? '';
                        const eEnd = existing.end_time ?? existing.end ?? '';
                        if (timesOverlap(sStart, sEnd, eStart, eEnd)) {
                            const msg = `Conflict: Faculty is already assigned a class on ${day} from ${formatTime12(eStart)} to ${formatTime12(eEnd)}. Assignment failed.`;
                            toast.error(msg);
                            setIsSubmitting(false);
                            return;
                        }
                    }
                }
            }
        } catch (e) { const error = e as any;
            console.error('Conflict check failed', error);
        }
        
        try {
            const token = localStorage.getItem('accessToken');
            const payload = {
                facultyId: faculty.id,
                subjectId: selectedSubject.id,
                schedules: schedulesToAssign
            };

            const response = await axios.post('faculty-loading/assign', payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                toast.success(response.data.message || "Subject assigned successfully!");
                // Note: onAssign signature remains the same as it handles post-assignment UI logic
                onAssign(faculty.id, selectedSubject.id, schedulesToAssign.map(s => ({ type: s.type, day: s.day, time: s.time, roomId: s.roomId }))); // Simple schedule structure for UI
                onClose();
            }
        } catch (err) {
            const error = err as any;
            console.error("Assignment Error:", error);
            
            const backendErrors = error?.response?.data?.errors;
            const errorMessage = error?.response?.data?.message || "Failed to assign subject. Please check conflicts.";
            
            const mappedErrors: { general?: string; lec?: string; lab?: string } = {};

            if (backendErrors) {
                if (backendErrors.LEC) {
                    mappedErrors.lec = backendErrors.LEC;
                }
                if (backendErrors.LAB) {
                    mappedErrors.lab = backendErrors.LAB;
                }
                if (!mappedErrors.lec && !mappedErrors.lab) {
                    mappedErrors.general = errorMessage; 
                }
            } else {
                mappedErrors.general = errorMessage;
            }
            
            toast.error(errorMessage);
            
            setServerErrors(mappedErrors);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isLecRoomSelected = (selectedSubject?.total_lec_hrs ?? 0) > 0 ? !!selectedRooms.lec : true;
    const isLabRoomSelected = (selectedSubject?.total_lab_hrs ?? 0) > 0 ? !!selectedRooms.lab : true;
    
    // UPDATED: Removed !section.trim() check from isButtonDisabled
    const isButtonDisabled = !selectedSubject || !isLecScheduleValid || !isLabScheduleValid || !isLecRoomSelected || !isLabRoomSelected || isSubmitting || isLoadExceeded || isLoadingCurrentLoad;
    
    const hasAvailability = Object.values(facultySchedule).some(slots => slots.length > 0);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-7xl w-[96%] h-[92vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-indigo-50 to-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-bold tracking-tight">Assign Subject</DialogTitle>
                            <DialogDescription>Assign a subject to <span className="font-semibold text-foreground">{faculty.name}</span>.</DialogDescription>
                        </div>
                        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                            <div className={`h-6 px-2 rounded-full flex items-center gap-1 ${selectedSubject ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                <span className="font-semibold">1</span><span>Select</span>
                            </div>
                            <ChevronRight className="w-4 h-4" />
                            <div className={`h-6 px-2 rounded-full flex items-center gap-1 ${step >= 2 ? (isLecRoomSelected && isLabRoomSelected ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700') : 'bg-muted text-muted-foreground'}`}>
                                <span className="font-semibold">2</span><span>Details</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Load Status Display (No change) */}
                    <div className="mt-4 p-3 bg-white border rounded-lg shadow-sm">
                        <h4 className="font-semibold text-sm mb-2">Faculty Load Status</h4>
                        {isLoadingCurrentLoad ? (
                            <div className="flex items-center gap-2 text-primary text-sm">
                                <Loader2 className="h-4 w-4 animate-spin" /> Fetching Load...
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-2 text-xs">
                                <p className="font-medium">Teaching Load: <span className="text-foreground font-bold">{maxNormalLoad} units</span></p>
                                <p className="font-medium">Overload Max: <span className="text-foreground font-bold">{maxOverload} units</span></p>
                                <p className="font-medium">Total Max: <span className="text-foreground font-bold">{totalAllowedLoad} units</span></p>
                                <p className="font-medium">Total Subjects: <span className="text-foreground font-bold">{uniqueTotalSubjectCount}</span></p>
                                
                                    <p className="col-span-4 text-sm pt-2 border-t mt-2">
                                    <span className="font-semibold">Current Assigned:</span> 
                                    <span className="text-foreground font-bold ml-1">{currentAssignedUnits} units</span>
                                    {selectedSubject && (
                                        <>
                                            <span className="text-muted-foreground ml-2">(Current + {newSubjectUnits} units)</span>
                                            <span className={`font-bold ml-2 ${isLoadExceeded ? 'text-destructive' : (isOverloadApplied ? 'text-yellow-700' : 'text-primary')}`}>
                                                → Potential Total: {potentialTotalLoad} units
                                            </span>
                                        </>
                                    )}
                                </p>
                            </div>
                        )}
                        
                        {/* WARNING MESSAGE WHEN OVERLOAD IS APPLIED BUT NOT EXCEEDED (No change) */}
                        {!isLoadExceeded && isOverloadApplied && (
                            <div className="mt-3 flex items-center gap-2 p-2 bg-yellow-100 border-yellow-300 rounded-lg text-yellow-800 text-sm">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                <p className="font-medium">Notice: This assignment will use **overload** units. Potential load is {potentialTotalLoad} (within max {totalAllowedLoad}).</p>
                            </div>
                        )}

                        {/* ERROR MESSAGE WHEN TOTAL ALLOWED LOAD IS EXCEEDED (No change) */}
                        {isLoadExceeded && (
                            <div className="mt-3 flex items-center gap-2 p-2 bg-destructive/10 border-destructive/30 rounded-lg text-destructive text-sm">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                <p className="font-medium">Warning: This assignment will exceed the total allowed load of {totalAllowedLoad} units. Assignment is **blocked**.</p>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow overflow-y-auto px-6 py-6 bg-muted/30">
                    {/* --- STEP 1: SELECT SUBJECT (Searchable) (No functional change) --- */}
                    <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${selectedSubject ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'}`}>
                                    {selectedSubject ? <Check className="h-5 w-5" /> : '1'}
                                </div>
                                <h3 className="text-lg font-semibold text-foreground">Select Subject</h3>
                            </div>
                        </div>
                        <div className="flex flex-col flex-grow">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="relative flex-grow">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                    <Input 
                                        placeholder="Search by code or title..." 
                                        value={searchQuery} 
                                        onChange={(e) => setSearchQuery(e.target.value)} 
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
                                        className="pl-10 bg-background" 
                                    />
                                </div>
                                <Button 
                                    variant="default" 
                                    onClick={handleSearchClick}
                                    disabled={isSearchingSubject || !searchQuery.trim()}
                                >
                                    {isSearchingSubject ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Searching
                                        </>
                                    ) : "Search"}
                                </Button>
                            </div>
                            <div className="flex-grow overflow-y-auto space-y-2 -mr-2 pr-2">
                                    {displayedSubjects.length > 0 ? (
                                        displayedSubjects.map(subject => {
                                            return (
                                                <button 
                                                    key={subject.id} 
                                                    onClick={() => setSelectedSubject(subject)} 
                                                    className={`w-full text-left p-3 rounded-md border transition-all duration-200 relative ${
                                                        selectedSubject?.id === subject.id 
                                                            ? 'bg-primary/10 border-primary shadow-sm' 
                                                            : 'bg-background hover:border-primary/50 hover:bg-primary/5'
                                                    }`}
                                                >
                                                    {selectedSubject?.id === subject.id && <CheckCircle className="h-5 w-5 text-primary absolute top-3 right-3" />}
                                                    
                                                    <p className="font-semibold text-foreground pr-6 uppercase">{subject.subject_code}</p>
                                                    <p className="text-sm text-muted-foreground truncate mb-2 uppercase">{subject.des_title}</p>
                                                    <div className="flex gap-2 text-xs">
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">Lec: {subject.total_lec_hrs ?? 0}</span>
                                                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">Lab: {subject.total_lab_hrs ?? 0}</span>
                                                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Units: {subject.total_hrs ?? subject.total_units ?? 0}</span>
                                                    </div>
                                                </button>
                                            )
                                        })
                                    ) : (
                                    <div className="flex flex-col items-center justify-center h-full min-h-64 text-center text-muted-foreground rounded-lg bg-muted/20 border-2 border-dashed p-5">
                                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                            {isSearchingSubject ? (
                                                <Loader2 className="h-6 w-6 animate-spin" />
                                            ) : (
                                                <Search className="h-6 w-6" />
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-foreground">
                                            {isSearchingSubject ? "Searching subjects..." : (searchQuery ? "No matching subjects found." : "Search for a subject first.")}
                                        </p>
                                        <p className="mt-1 max-w-48 text-xs text-muted-foreground">
                                            {isSearchingSubject ? "Please wait while subjects are being loaded." : (searchQuery ? "Try another subject code or title." : "Enter a subject code or title, then click Search.")}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* --- STEP 2: SET SCHEDULE --- */}
                    <div className={`bg-white p-4 rounded-xl border shadow-sm flex flex-col transition-all ${step < 2 && 'opacity-50 pointer-events-none'}`}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${step >= 2 && isLecScheduleValid && isLabScheduleValid ? 'bg-green-500 text-white' : (step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/30 text-muted-foreground')}`}>
                                {step >= 2 && isLecScheduleValid && isLabScheduleValid ? <Check className="h-5 w-5" /> : '2'}
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">Set Schedule</h3>
                        </div>
                        {step >= 2 && (
                            <div className="flex-grow overflow-y-auto -mr-2 pr-2">
                                {isLoadingSchedule ? (
                                    <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                ) : (
                                    <div className="space-y-4">
                                        
                                        {!hasAvailability ? (
                                            <div className="flex items-center gap-3 p-3 bg-destructive/10 border-destructive/30 rounded-lg text-destructive">
                                                <CalendarX2 className="h-5 w-5 flex-shrink-0" /><p className="text-sm font-medium">No faculty availability found. Schedules may not be valid.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4 pt-2">
                                                {(selectedSubject?.total_lec_hrs ?? 0) > 0 && 
                                                    <ScheduleInputGroup 
                                                        type="lec" 
                                                        hours={selectedSubject?.total_lec_hrs ?? 0} 
                                                        schedules={schedules} 
                                                        facultySchedule={facultySchedule}
                                                        onScheduleChange={handleScheduleChange}
                                                        onTogglePairedDay={handleTogglePairedDay}
                                                        timeError={timeErrors.lec}
                                                    />
                                                }
                                                {(selectedSubject?.total_lab_hrs ?? 0) > 0 && 
                                                    <ScheduleInputGroup 
                                                        type="lab" 
                                                        hours={selectedSubject?.total_lab_hrs ?? 0} 
                                                        schedules={schedules} 
                                                        facultySchedule={facultySchedule}
                                                        onScheduleChange={handleScheduleChange}
                                                        onTogglePairedDay={handleTogglePairedDay}
                                                        timeError={timeErrors.lab}
                                                    />
                                                }
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* --- STEP 3: SELECT ROOM (No functional change) --- */}
                    <div className={`flex flex-col gap-4 h-full ${step < 2 && 'opacity-50 pointer-events-none'}`}>
                        
                        {/* 3A: LECTURE ROOM CARD */}
                        {(selectedSubject?.total_lec_hrs ?? 0) > 0 && (
                            <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col flex-1 min-h-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${step >= 3 && isLecRoomSelected ? 'bg-green-500 text-white' : (step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/30 text-muted-foreground')}`}>
                                        {step >= 3 && isLecRoomSelected ? <Check className="h-5 w-5" /> : '3'}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-foreground">Lecture Room</h3>
                                        <p className="text-xs text-muted-foreground">Select room</p>
                                    </div>
                                </div>
                                {step >= 2 && (
                                    <div className="flex-grow overflow-y-auto -mr-2 pr-2">
                                        {serverErrors.lec && (
                                            <div className="mb-3 flex items-center gap-2 p-2 bg-destructive/10 border-destructive/30 rounded-lg text-destructive text-sm">
                                                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                                <p className="font-medium">{serverErrors.lec}</p>
                                            </div>
                                        )}
                                        <RoomSelectionGroup 
                                            type="lec" 
                                            schedules={schedules} 
                                            availableRooms={availableRooms} 
                                            isLoadingRooms={isLoadingRooms} 
                                            selectedRooms={selectedRooms} 
                                            onSelectRoom={handleSelectRoom}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3B: LABORATORY ROOM CARD */}
                        {(selectedSubject?.total_lab_hrs ?? 0) > 0 && (
                            <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col flex-1 min-h-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${step >= 3 && isLabRoomSelected ? 'bg-green-500 text-white' : (step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/30 text-muted-foreground')}`}>
                                        {step >= 3 && isLabRoomSelected ? <Check className="h-5 w-5" /> : '3'}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-foreground">Laboratory Room</h3>
                                        <p className="text-xs text-muted-foreground">Select room</p>
                                    </div>
                                </div>
                                {step >= 2 && (
                                    <div className="flex-grow overflow-y-auto -mr-2 pr-2">
                                            {serverErrors.lab && (
                                                <div className="mb-3 flex items-center gap-2 p-2 bg-destructive/10 border-destructive/30 rounded-lg text-destructive text-sm">
                                                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                                    <p className="font-medium">{serverErrors.lab}</p>
                                                </div>
                                            )}
                                            <RoomSelectionGroup 
                                            type="lab" 
                                            schedules={schedules} 
                                            availableRooms={availableRooms} 
                                            isLoadingRooms={isLoadingRooms} 
                                            selectedRooms={selectedRooms} 
                                            onSelectRoom={handleSelectRoom}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Fallback if no hours */}
                        {((selectedSubject?.total_lec_hrs ?? 0) === 0 && (selectedSubject?.total_lab_hrs ?? 0) === 0) && (
                             <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col items-center justify-center h-full text-muted-foreground">
                                <p>Select a subject to view room options.</p>
                             </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-6 pt-4 border-t bg-background">
                    <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                    <Button onClick={handleAssignClick} disabled={isButtonDisabled}>
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Assigning...</> : (isLoadExceeded ? "Load Exceeded" : "Assign Subject")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
