// src/components/classroom/ClassroomScheduleLayout.tsx

import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from "sonner";
import axios from "../../../plugin/axios"; // Assuming the same axios instance path as RoomContainer
import ClassSchedule from '@/views/admin/room/ClassSchedule'; // Assuming this is the correct path for the reusable component


// --- TYPE DEFINITIONS (Self-contained for this file, assuming import from './classroom') ---

interface Faculty { id: number; user_id: number; designation: string; department: string; }
interface Room { id: number; roomNumber: string; type: "Lecture" | "Laboratory" | string; capacity: number | null; status: number; created_at: string; updated_at: string; }
interface Subject { id: number; semester_id: number; subject_code: string; des_title: string; total_units: number; lec_units: number; lab_units: number; code: string; name: string; yearLevel: number; }
interface FacultyLoading {
    id: number; faculty_id: number; subject_id: number; room_id: number;
    type: 'LEC' | 'LAB' | string; day: string; start_time: string; end_time: string; 
    faculty: Faculty & { user?: { id: number, name?: string } }; 
    subject: { id: number; subject_code: string; des_title: string; }; 
    room: { id: number; roomNumber: string; type: string; }; 
}
type FacultyLoadEntry = FacultyLoading; 
interface ScheduleEntry { id: number; faculty_loading_id: number; year_level: number; section: string; created_at: string; updated_at: string; faculty_loading: FacultyLoading; }
interface SectionEntry { yearLevel: number; section: string; }
// --- END TYPE DEFINITIONS ---


// Helper to get the token (assuming it's stored in localStorage)
const getToken = () => localStorage.getItem('accessToken');
const getAuthHeader = () => ({ 'Authorization': `Bearer ${getToken()}` });

const fetchInitialData = async (forceRefresh = false): Promise<{
    subjects: Subject[];
    rooms: Room[];
    facultyLoading: FacultyLoadEntry[];
    savedSections: SectionEntry[];
}> => {
    const token = getToken();
    if (!token) {
        toast.error("Authentication required for initial data load.", { duration: 10000 });
        throw new Error("Missing Auth Token");
    }

    try {
        const [subjectsRes, roomsRes, loadsRes] = await Promise.all([
            axios.get<{ subject: any[] }>('/get-subjects', { headers: getAuthHeader(), params: forceRefresh ? { _ts: Date.now() } : undefined }),
            axios.get<{ rooms: Room[] }>('/rooms', { headers: getAuthHeader(), params: forceRefresh ? { _ts: Date.now() } : undefined }),
            axios.get<{ success: boolean; data: FacultyLoadEntry[] }>('/get-faculty-loading', { headers: getAuthHeader(), params: forceRefresh ? { _ts: Date.now() } : undefined }),
        ]);

        // Transform subjects data as done in RoomContainer
        const transformedSubjects: Subject[] = subjectsRes.data.subject.map((s: any) => ({
            id: s.id,
            subject_code: s.subject_code,
            des_title: s.des_title,
            code: s.subject_code, 
            name: s.des_title, 
            yearLevel: parseInt(s.semester.year_level) || 0,
            semester_id: s.semester_id,
            total_units: s.total_units,
            lec_units: s.lec_units,
            lab_units: s.lab_units,
        }));
        
        // Load sections from localStorage (as done in RoomContainer)
        const saved = localStorage.getItem('saved_class_sections');
        const sectionsFromStorage = saved ? JSON.parse(saved) : [];

        return {
            subjects: transformedSubjects,
            rooms: roomsRes.data.rooms || [],
            facultyLoading: loadsRes.data.success ? loadsRes.data.data : [],
            savedSections: sectionsFromStorage,
        };
    } catch (error) {
        console.error("Error fetching initial data:", error);
        throw new Error("Failed to load global scheduling data.");
    }
};

/**
 * Fetches the schedule entries for a specific year and section (using the filter endpoint).
 */
const fetchSchedules = async (
    year: number | null = null,
    section: string | null = null,
    programId: number | null = null,
    forceRefresh = false
): Promise<{ success: boolean; data: ScheduleEntry[]; message?: string }> => {
    const token = getToken();
    if (!token) { 
        return { success: false, data: [], message: "Authentication required." }; 
    } 

    // If programId is not provided, avoid calling the backend filter endpoint
    // because the API requires `program_id`. Return an empty successful result
    // when there are no filters to apply so the UI can initialize without errors.
    if (!programId) {
        if (year || section) {
            return { success: false, data: [], message: 'Program id is required for filtering schedules.' };
        }
        return { success: true, data: [], message: 'No program selected; schedule list is empty.' };
    }

    const payload: Record<string, any> = {};
    if (year) payload.year_level = year;
    if (section) payload.section = section;
    payload.program_id = programId;
    if (forceRefresh) payload._ts = Date.now();

    try {
        const response = await axios.post('/filter-schedule', payload, { 
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            }
        });
        
        if (response.data.success) {
          const apiSchedules: ScheduleEntry[] = response.data.data || [];
          return {
            success: true,
            data: apiSchedules,
            message: response.data.message
          };
        }
        return { success: false, data: [], message: response.data.message || "Failed to fetch schedules." };
    } catch (error: any) {
        console.error("Fetch Schedules Error:", error);
        return { success: false, data: [], message: error.response?.data?.message || "An unexpected error occurred." };
    }
};


/**
 * Posts a new schedule entry to the server.
 */
const postNewSchedule = async (entry: {
    yearLevel: number;
    section: string;
    subjectId: number;
    roomId: number;
    day: string;
    startTime: string;
    endTime: string;
    type: 'LEC' | 'LAB' | string;
    programId?: number;
}): Promise<{ success: boolean; newEntry?: ScheduleEntry }> => {
    const token = getToken();
    if (!token) {
        throw new Error("Authentication required to save schedule.");
    }

    const payload: any = {
        subject_id: entry.subjectId,
        room_id: entry.roomId,
        day: entry.day,
        start_time: entry.startTime,
        end_time: entry.endTime,
        section: entry.section,
        year_level: entry.yearLevel,
        type: entry.type,
    };

    if (entry.programId) payload.program_id = entry.programId;

    try {
        const response = await axios.post('/create-schedule', payload, {
             headers: getAuthHeader()
        });

           if (response.data.success) {
               toast.success(response.data.message || "Schedule created successfully.");
             return { success: true }; 
        }
        
           toast.error(response.data.message || "Failed to save schedule.", { duration: 10000 });
        return { success: false };

    } catch (error: any) {
        if (error.response && error.response.data) {
            toast.error(error.response.data.message, { duration: 10000 }); // Show backend conflict/error message
        } else {
            toast.error("An unexpected network error occurred while saving the schedule.", { duration: 10000 });
        }
        throw new Error("Save operation failed.");
    }
};
// --- END API CALL IMPLEMENTATIONS ---


// NOTE: Skeleton loader removed — replaced by a compact spinner during initial load.


// --- CLASSROOM SCHEDULE LAYOUT COMPONENT ---

function ClassroomScheduleLayout() {
  // Global Data States (fetched on mount)
  const [subjectsData, setSubjectsData] = useState<Subject[]>([]);
  const [roomsData, setRoomsData] = useState<Room[]>([]);
  const [facultyLoadingData, setFacultyLoadingData] = useState<FacultyLoadEntry[]>([]);
  const [savedSections, setSavedSections] = useState<SectionEntry[]>([]);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtered Schedule State (updated by onFilterApply)
  const [scheduleData, setScheduleData] = useState<ScheduleEntry[]>([]);
  
  // --- MOCK PERMISSION STATE ---
  const [canAddSchedule, _setCanAddSchedule] = useState(true); 

  // 1. Initial Data Fetch (on mount)
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingInitialData(true);
      try {
        const { subjects, rooms, facultyLoading, savedSections: initialSections } = await fetchInitialData();
        setSubjectsData(subjects);
        setRoomsData(rooms);
        setFacultyLoadingData(facultyLoading);
        setSavedSections(initialSections);
        
        // Attempt a general fetch to populate the schedule grid initially (or leave empty)
        const initialScheduleResult = await fetchSchedules();
        if (initialScheduleResult.success) {
             setScheduleData(initialScheduleResult.data);
        }

            } catch (error: any) {
                console.error("Failed to load initial scheduling data:", error);
                toast.error(error.message || "Failed to load initial data. Please log in or check console.", { duration: 10000 });
      } finally {
        setIsLoadingInitialData(false);
      }
    };

    loadData();
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setIsLoadingInitialData(true);
    try {
      const { subjects, rooms, facultyLoading, savedSections: initialSections } = await fetchInitialData(true);
      setSubjectsData(subjects);
      setRoomsData(rooms);
      setFacultyLoadingData(facultyLoading);
      setSavedSections(initialSections);
      toast.success("Data refreshed.");
    } catch (error: any) {
      toast.error(error.message || "Failed to refresh data.", { duration: 10000 });
    } finally {
      setIsRefreshing(false);
      setIsLoadingInitialData(false);
    }
  }, []);

  // Helper to re-fetch the schedule for the current view
    const refreshScheduleData = useCallback(async (year: number, section: string, programId?: number) => {
            try {
                const result = await fetchSchedules(year, section, programId ?? null);
                if (result.success) {
                        setScheduleData(result.data);
                } else {
                    toast.error(result.message || "Failed to refresh schedule data.", { duration: 10000 });
                }
            } catch (error: any) {
                toast.error(error.message || "Failed to refresh schedule data.", { duration: 10000 });
            }
    }, []);


  // 2. Handler for Filter (Passed to ClassSchedule as onFilterApply)
    const handleFilterApply = useCallback(async (year: number, section: string, programId?: number) => {
        const result = await fetchSchedules(year, section, programId ?? null);

        if (result.success) {
                setScheduleData(result.data);
        }

        return result;
    }, []);
  

  // 3a. ACTUAL API Handler for Adding Schedule
    const apiAddSchedule = useCallback(async (entry: {
        yearLevel: number;
        section: string;
        subjectId: number;
        roomId: number;
        day: string;
        startTime: string;
        endTime: string;
        type: 'LEC' | 'LAB' | string;
        programId?: number;
    }) => {
        try {
            const result = await postNewSchedule(entry as any);

            if (result.success) {
                // 1. Update Saved Sections (for Dropdown Persistence)
                const sectionExists = savedSections.some(
                        s => s.yearLevel === entry.yearLevel && s.section === entry.section
                );
                if (!sectionExists) {
                        const updatedSections = [...savedSections, { yearLevel: entry.yearLevel, section: entry.section }];
                        updatedSections.sort((a, b) => a.section.localeCompare(b.section));
            
                        setSavedSections(updatedSections);
                        localStorage.setItem('saved_class_sections', JSON.stringify(updatedSections));
                }

                // 2. Re-fetch the schedule to update the grid.
                await refreshScheduleData(entry.yearLevel, entry.section, entry.programId);
        
                return true;
            }
            return false; // Error toast handled inside postNewSchedule
      
        } catch (error: any) {
            console.error("Error during Add Schedule:", error);
            return false;
        }
    }, [refreshScheduleData, savedSections]);


  // 3b. MOCK HANDLER (If user cannot add schedule)
  const noPermissionAddSchedule = useCallback(async (_entry: any) => {
      toast.error("Permission Denied: You do not have rights to add new schedules.", { duration: 10000 });
      return false;
  }, []);

  // 3c. Select the appropriate handler to pass as prop
  const finalAddScheduleHandler = canAddSchedule ? apiAddSchedule : noPermissionAddSchedule;


    if (isLoadingInitialData) {
        // Show the real header + label and a compact spinner while initial data loads.
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Classroom Schedule</h1>
                    <p className="text-gray-600 mt-1">Manage, create, and view classroom assignments across all departments.</p>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-white shadow-sm w-full justify-start">
                    <div className="flex items-center justify-center w-10 h-10 bg-white rounded-full border border-gray-100">
                        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-800">Loading schedule data…</p>
                        <p className="text-xs text-gray-500">Fetching rooms, subjects, and faculty loading.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Classroom Schedule</h1>
                <p className="text-gray-600 mt-1">Manage, create, and view classroom assignments across all departments.</p>
            </div>
            <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Refresh data"
                aria-label="Refresh data"
            >
                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                <span className="text-sm font-medium">Refresh data</span>
            </button>
     
            {/* ClassSchedule Component (The "admin" component being reused) */}
            <ClassSchedule
                scheduleData={scheduleData}
                subjectsData={subjectsData}
                roomsData={roomsData}
                facultyLoadingData={facultyLoadingData}
                savedSections={savedSections}
                isInitialLoading={isLoadingInitialData}
                // Conditionally pass the API handler or the permission denied handler
                onAddSchedule={finalAddScheduleHandler}
                onFilterApply={handleFilterApply}
                authToken={getToken()}
            />
        </div>
    );
} 

export default ClassroomScheduleLayout;
