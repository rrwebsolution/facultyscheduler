import { useState, useMemo, useEffect } from "react";
import { BookOpen, Users, GraduationCap, Grid3x3, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axios from '../../../../plugin/axios'; 
import { motion, AnimatePresence } from "framer-motion";

// --- INTERFACES BASED ON PROVIDED DATA (from get-classSchedule-reports) ---

interface User { id: number; name: string; }
interface Faculty { id: number; user_id: number; user: User; }
interface Subject { id: number; subject_code: string; des_title: string; }
interface Room { id: number; roomNumber: string; }
interface Program { id: number; abbreviation: string; }

interface FacultyLoading {
    id: number; type: 'LEC' | 'LAB' | string; day: string; start_time: string; end_time: string;
    faculty: Faculty; subject: Subject; room: Room;
}

interface ClassSchedule {
    id: number; program_id: number; faculty_loading_id: number; year_level: number;
    section: string; faculty_loading: FacultyLoading; program: Program;
}

interface BackendResponse {
    success: boolean; 
    classSchedule: ClassSchedule[]; 
}

// Data structure for the table rows
interface SubjectSchedule {
    course: string; 
    section: string; 
    type: 'LEC' | 'LAB' | string; // <--- ADDED: Type (LEC/LAB) for the row
    day: string;    
    time: string;   
    room: string;   
    teacher: string; 
}

// --- UTILITY FUNCTION ---
const formatTimeRange = (start: string, end: string): string => {
    try {
        const format12Hour = (time24: string) => {
            const [h, m] = time24.split(':').map(Number);
            const period = h >= 12 ? 'pm' : 'am';
            const displayHour = h % 12 || 12;
            return `${displayHour}:${String(m).padStart(2, '0')}${period}`;
        };
        // The time strings from the API are 'HH:mm:ss' which are 24-hour format
        return `${format12Hour(start.substring(0, 5))}-${format12Hour(end.substring(0, 5))}`;
    } catch (e) {
        return `${start}-${end}`;
    }
};

// --- FACULTY STUDY LOAD VIEW COMPONENT ---

const API_URL = 'get-classSchedule-reports';
const TOKEN_KEY = 'accessToken'; 

export const FacultyStudyLoadView = () => {
    const [backendData, setBackendData] = useState<ClassSchedule[]>([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    // Filter States
    const [selectedProgram, setSelectedProgram] = useState<string>("all");
    const [selectedYearLevel, setSelectedYearLevel] = useState<string>("all");
    const [selectedSection, setSelectedSection] = useState<string>("all");
    const [selectedFaculty, setSelectedFaculty] = useState<string>("all"); 

    // --- Data Fetching (unchanged) ---
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setIsError(false);
            const accessToken = localStorage.getItem(TOKEN_KEY);
            if (!accessToken) {
                setIsLoading(false);
                setIsError(true); 
                return;
            }
            
            try {
                const response = await axios.get<BackendResponse>(API_URL, {
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
                });

                if (response.data.success && Array.isArray(response.data.classSchedule)) {
                    setBackendData(response.data.classSchedule);
                } else {
                    throw new Error('Invalid data structure or API response');
                }
            } catch (error) {
                console.error("Error fetching study load:", error);
                setIsError(true);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []); 

    // --- Filter Options Extraction (unchanged) ---

    const uniquePrograms = useMemo(() => {
        const programs = new Set<string>();
        backendData.forEach((s) => s.program?.abbreviation && programs.add(s.program.abbreviation));
        return ["all", ...Array.from(programs).sort()];
    }, [backendData]);

    const uniqueYearLevels = useMemo(() => {
        const levels = new Set<number>();
        backendData.forEach((s) => s.year_level && levels.add(s.year_level));
        return ["all", ...Array.from(levels).sort((a, b) => a - b)];
    }, [backendData]);

    const sectionsByFilters = useMemo(() => {
        const sections = new Set<string>();
        backendData
            .filter(s => 
                (selectedProgram === 'all' || s.program?.abbreviation === selectedProgram) &&
                (selectedYearLevel === 'all' || String(s.year_level) === selectedYearLevel)
            )
            .forEach((s) => s.section && sections.add(s.section));
        return ["all", ...Array.from(sections).sort()];
    }, [backendData, selectedProgram, selectedYearLevel]);
    
    // Returns an array of unique faculty names (strings) + 'all'
    const uniqueFacultyNames = useMemo(() => {
        const names = new Set<string>();
        backendData.forEach(s => {
            const facultyName = s.faculty_loading?.faculty?.user?.name;
            if (facultyName) {
                names.add(facultyName);
            }
        });
        return ["all", ...Array.from(names).sort()];
    }, [backendData]);


    // --- Data Filtering and Transformation (UPDATED) ---

    const filteredReportData: SubjectSchedule[] = useMemo(() => {
        
        return backendData
            .filter((entry) => {
                const matchesProgram = selectedProgram === 'all' || entry.program?.abbreviation === selectedProgram;
                const matchesYear = selectedYearLevel === 'all' || String(entry.year_level) === selectedYearLevel;
                const matchesSection = selectedSection === 'all' || entry.section === selectedSection;
                
                const facultyName = entry.faculty_loading?.faculty?.user?.name || '';
                const matchesFaculty = selectedFaculty === 'all' || facultyName === selectedFaculty;

                return matchesProgram && matchesYear && matchesSection && matchesFaculty;
            })
            .map((entry) => ({
                // Format: SubjectCode YearLevel
                course: `${entry.faculty_loading.subject.subject_code} ${entry.year_level}`.trim(),
                section: entry.section, 
                type: entry.faculty_loading.type, // <--- ADDED
                day: entry.faculty_loading.day,
                time: formatTimeRange(entry.faculty_loading.start_time, entry.faculty_loading.end_time),
                room: entry.faculty_loading.room?.roomNumber || 'N/A', 
                teacher: entry.faculty_loading.faculty.user.name,
            }));
    }, [backendData, selectedProgram, selectedYearLevel, selectedSection, selectedFaculty]);

    // --- Current Section Header (unchanged) ---
    const currentSectionHeader = useMemo(() => {
        const program = selectedProgram !== 'all' ? selectedProgram : '';
        const year = selectedYearLevel !== 'all' ? `${selectedYearLevel} Year` : '';
        const section = selectedSection !== 'all' ? selectedSection : '';
        const faculty = selectedFaculty !== 'all' ? selectedFaculty : '';
        
        const parts = [year, section, program].filter(p => p);
        
        let header = parts.join(' ');
        if (parts.length === 0) {
             header = "Entire Study Load";
        }
        
        if (selectedFaculty !== 'all' && header !== "Entire Study Load") {
            header += ` (Assigned to: ${faculty})`;
        } else if (selectedFaculty !== 'all') {
            header = `Assigned to: ${faculty}`;
        }

        return header;
    }, [selectedProgram, selectedYearLevel, selectedSection, selectedFaculty]);


    // --- Render Logic for Loading/Error (unchanged) ---
    if (isLoading) {
        return (
            <div className="p-10 text-center flex flex-col items-center justify-center text-primary bg-card rounded-xl shadow-lg border border-border min-h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <p>Loading student study load data...</p>
            </div>
        );
    }
    
    if (isError) {
        return (
            <div className="p-10 text-center text-destructive border border-destructive/50 rounded-lg bg-card shadow-lg min-h-[300px]">
                Error loading student study load data. Please check the API and your connection.
            </div>
        );
    }


    // --- Main Component Render (UPDATED) ---
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key="studyload-content"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 overflow-x-auto"
            >
                 <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center mb-6 border-b border-slate-200 pb-4">
                    <div>
                        <h3 className="text-xl font-semibold text-slate-700 flex items-center">
                             <BookOpen className="h-5 w-5 mr-2 text-primary" /> Student Study Load
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">Filter study loads by program, year level, section, and faculty.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 w-full lg:w-auto">
                        
                        {/* Program Filter */}
                        <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                            <SelectTrigger className="w-full sm:w-[150px] border-primary/50 shadow-sm">
                                <GraduationCap className="h-4 w-4 mr-2 text-primary" />
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

                        {/* Year Level Filter */}
                        <Select value={selectedYearLevel} onValueChange={setSelectedYearLevel}>
                            <SelectTrigger className="w-full sm:w-[150px] border-primary/50 shadow-sm">
                                <Grid3x3 className="h-4 w-4 mr-2 text-primary" />
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

                        {/* Section Filter */}
                         <Select value={selectedSection} onValueChange={setSelectedSection}>
                            <SelectTrigger className="w-full sm:w-[150px] border-primary/50 shadow-sm">
                                <Users className="h-4 w-4 mr-2 text-primary" />
                                <SelectValue placeholder="Section" />
                            </SelectTrigger>
                            <SelectContent>
                                {sectionsByFilters.map((section) => (
                                    <SelectItem key={section} value={section}>
                                        {section === "all" ? "All Sections" : section}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        
                        {/* Faculty Filter */}
                        <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
                            <SelectTrigger className="w-full sm:w-[180px] border-primary/50 shadow-sm">
                                <Users className="h-4 w-4 mr-2 text-primary" />
                                <SelectValue placeholder="Faculty" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Faculty</SelectItem>
                                {uniqueFacultyNames.filter(name => name !== "all").map((name) => (
                                    <SelectItem key={name} value={name}>
                                        {name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Report Table */}
                <div className="border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    
                    {/* Section Header */}
                    <div className="p-3 bg-slate-50/70 border-b border-slate-200">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                           {currentSectionHeader}
                        </h4>
                    </div>

                    <Table className="w-full border-collapse">
                        <TableHeader className="bg-slate-100/70 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-[18%] border-r border-b border-slate-200 text-center font-bold text-indigo-700 bg-indigo-50/80 text-xs uppercase tracking-wider">
                                    Subject / Course
                                </TableHead>
                                <TableHead className="w-[8%] border-r border-b border-slate-200 text-center font-bold text-indigo-700 bg-indigo-50/80 text-xs uppercase tracking-wider"> 
                                    Section
                                </TableHead>
                                <TableHead className="w-[8%] border-r border-b border-slate-200 text-center font-bold text-indigo-700 bg-indigo-50/80 text-xs uppercase tracking-wider">
                                    Type
                                </TableHead>
                                <TableHead className="w-[10%] border-r border-b border-slate-200 text-center font-bold text-indigo-700 bg-indigo-50/80 text-xs uppercase tracking-wider"> 
                                    Day
                                </TableHead>
                                <TableHead className="w-[15%] border-r border-b border-slate-200 text-center font-bold text-indigo-700 bg-indigo-50/80 text-xs uppercase tracking-wider"> 
                                    Time
                                </TableHead>
                                <TableHead className="w-[10%] border-r border-b border-slate-200 text-center font-bold text-indigo-700 bg-indigo-50/80 text-xs uppercase tracking-wider"> 
                                    Room
                                </TableHead>
                                <TableHead className="w-[20%] border-b border-slate-200 text-center font-bold text-indigo-700 bg-indigo-50/80 text-xs uppercase tracking-wider"> 
                                    Teacher/Instructor
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        
                        <TableBody>
                            {filteredReportData.length > 0 ? (
                                filteredReportData.map((schedule, index) => (
                                    <TableRow key={index} className={`${index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'} border-b border-slate-200 hover:bg-indigo-50/30 transition-colors`}> 
                                        <TableCell className="border-r border-slate-200 align-middle p-2 text-sm font-bold text-indigo-700">
                                            {schedule.course}
                                        </TableCell>
                                        <TableCell className="border-r border-slate-200 align-middle p-2 text-center text-sm font-semibold text-slate-700">
                                            <span className="inline-flex items-center rounded-md bg-white/70 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                                                {schedule.section}
                                            </span>
                                        </TableCell>
                                        <TableCell className="border-r border-slate-200 align-middle p-2 text-center text-sm font-semibold text-slate-700 uppercase">
                                            <span className="inline-flex items-center rounded bg-white/70 px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-inset ring-slate-200">
                                                {schedule.type === 'LEC' ? 'Lecture' : schedule.type === 'LAB' ? 'Laboratory' : schedule.type}
                                            </span>
                                        </TableCell>
                                        <TableCell className="border-r border-slate-200 align-middle p-2 text-center text-sm font-semibold text-slate-600">
                                            {schedule.day}
                                        </TableCell>
                                        <TableCell className="border-r border-slate-200 align-middle p-2 text-center text-sm text-slate-600 whitespace-nowrap">
                                            {schedule.time}
                                        </TableCell>
                                        <TableCell className="border-r border-slate-200 align-middle p-2 text-center text-sm font-medium text-slate-700">
                                            {schedule.room}
                                        </TableCell>
                                        <TableCell className="align-middle p-2 text-sm text-slate-700">
                                            {schedule.teacher}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground"> {/* <--- UPDATED COLSPAN to 7 */}
                                        No study load data found for the selected filters.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

export default FacultyStudyLoadView;
