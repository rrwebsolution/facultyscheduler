import React, { useMemo, useState, useEffect } from "react";
// Assuming you have set up the alias for axios
import axios from '../../../../plugin/axios';
import { isAxiosError } from 'axios';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Loader2, UserRound } from "lucide-react"; 

// --- TYPESCRIPT INTERFACES (Unchanged) --- 
interface User {
    id: number;
    name: string;
    email: string;
}

interface Faculty {
  id: number;
  user_id: number;
  designation: string;
  t_load_units: number;
  overload_units: number;
  deload_units: number;
  user: User; 
}

interface Subject {
  id: number;
  subject_code: string;
  des_title: string;
  total_units: number; 
  lec_units: number;
  lab_units: number;
  total_hrs: number; 
  total_lec_hrs: number | null; 
  total_lab_hrs: number | null; 
}

interface Room {
  id: number;
  roomNumber: string;
}

interface BackendLoading {
  id: number;
  faculty_id: number;
  subject_id: number;
  room_id: number;
  section: string | null; 
  type: 'LEC' | 'LAB' | string;
  day: string;
  start_time: string;
  end_time: string;
  faculty: Faculty;
  subject: Subject;
  room: Room;
}

interface BackendResponse {
    success: boolean;
    facultyLoading: BackendLoading[];
}

interface SubjectItem {
    subjectCode: string;
    type: 'LEC' | 'LAB' | string;
    payingHours: number; // This will now store the scheduled duration
    section: string | null; 
    day: string;
    time: string;
    room: string;
    remarks: string; 
    remarkRowSpan: number; 
    totalUnits: number; 
    totalHours: number; 
}

interface GroupedFacultyLoad {
  facultyId: number;
  name: string;
  loadString: string; 
  calculatedLoad: number; 
  preps: number; 
  overload: number;
  totalUnitsSum: number;
  subjects: SubjectItem[];
}

// --- UTILITY FUNCTIONS ---
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

/**
 * Calculates the duration in hours between start_time and end_time.
 * @param startTime time string (e.g., "07:30:00")
 * @param endTime time string (e.g., "09:00:00")
 * @returns duration in hours (e.g., 1.5)
 */
const calculateDurationInHours = (startTime: string, endTime: string): number => {
    try {
        const [startH, startM, startS] = startTime.split(':').map(Number);
        const [endH, endM, endS] = endTime.split(':').map(Number);

        // Calculate total minutes for start and end
        const totalStartMinutes = startH * 60 + startM + (startS / 60);
        const totalEndMinutes = endH * 60 + endM + (endS / 60);

        let diffMinutes = totalEndMinutes - totalStartMinutes;

        // If end time is before start time (e.g., overnight class), add 24 hours (1440 minutes)
        if (diffMinutes < 0) {
            diffMinutes += 1440; 
        }

        // Convert minutes to hours and return a fixed-point number for safety
        return parseFloat((diffMinutes / 60).toFixed(2));
    } catch (e) {
        console.error("Error calculating duration:", e);
        return 0; // Return 0 on error
    }
};

const transformToGroupedData = (backendData: BackendLoading[]): GroupedFacultyLoad[] => {
  // NOTE: componentCount is kept for the 'remarkRowSpan' logic, but is not used for payingHours.
  const componentCount = new Map<string, number>();

  backendData.forEach(loading => {
    const key = `${loading.faculty_id}-${loading.subject_id}-${loading.type}`;
    componentCount.set(key, (componentCount.get(key) || 0) + 1);
  });
    
  const facultyMap = new Map<number, BackendLoading[]>();

  // 1. Group by Faculty
  backendData.forEach(loading => {
    if (!facultyMap.has(loading.faculty_id)) {
      facultyMap.set(loading.faculty_id, []);
    }
    facultyMap.get(loading.faculty_id)!.push(loading);
  });

  const grouped: GroupedFacultyLoad[] = [];

  facultyMap.forEach(loadings => {
    const faculty = loadings[0].faculty;
    const facultyId = faculty.id;
    const facultyName = faculty.user.name;

    // 2. Map loadings to raw SubjectItem list
    const rawSubjectList = loadings.map(loading => {
        
        // --- NEW LOGIC: Paying Hours = Scheduled Duration (end_time - start_time) ---
        const payingHours: number = calculateDurationInHours(loading.start_time, loading.end_time);
        // -----------------------------------------------------------------------------
        
        const startTime = formatTime(loading.start_time);
        const endTime = formatTime(loading.end_time);
        const remarksTitle = loading.subject.des_title;
        
        const subjectItem: SubjectItem = {
            subjectCode: loading.subject.subject_code,
            type: loading.type,
            payingHours: payingHours,
            section: loading.section, 
            day: loading.day,
            time: `${startTime}-${endTime}`,
            room: loading.room.roomNumber,
            remarks: remarksTitle, 
            remarkRowSpan: 0, 
            totalUnits: loading.subject.total_units,
            totalHours: loading.subject.total_hrs,
        };
        return subjectItem;
    });
    
    // Sort rawSubjectList to ensure correct row grouping for remarks
    rawSubjectList.sort((a, b) => a.remarks.localeCompare(b.remarks));

    // 3. Calculate the actual rowSpan for the Remarks column
    const subjectList: SubjectItem[] = [];
    for (let i = 0; i < rawSubjectList.length; i++) {
        const currentItem = rawSubjectList[i];
        
        if (i === 0 || rawSubjectList[i].remarks !== rawSubjectList[i-1].remarks) {
            const currentRemark = currentItem.remarks;
            let remarkRowspan = 1;
            
            for (let j = i + 1; j < rawSubjectList.length; j++) {
                if (rawSubjectList[j].remarks === currentRemark) {
                    remarkRowspan++;
                } else {
                    break;
                }
            }
            currentItem.remarkRowSpan = remarkRowspan; 
        }
        subjectList.push(currentItem);
    }

    const calculatedLoad = faculty.t_load_units;
    const calculatedPreps = subjectList.reduce((count, item) => count + (item.remarkRowSpan > 0 ? 1 : 0), 0);
    const totalPayingHours = rawSubjectList.reduce((sum, item) => sum + item.payingHours, 0);
    
    const totalUnitsSum = rawSubjectList.reduce((sum, item) => sum + item.totalUnits, 0);
    
    // Overload calculation still uses the new totalPayingHours
    const overload = Math.max(0, totalPayingHours - calculatedLoad);
    const loadString = totalPayingHours.toFixed(1).toString();

    grouped.push({
        facultyId,
        name: facultyName,
        loadString: loadString,
        calculatedLoad: calculatedLoad, 
        preps: calculatedPreps,
        overload: overload,
        totalUnitsSum: totalUnitsSum,
        subjects: subjectList,
    });
  });
  
  // Sort faculties by name
  grouped.sort((a, b) => a.name.localeCompare(b.name));

  return grouped;
};


// --- REACT COMPONENT (Rendering logic unchanged, only data is different) ---
export function FacultyLoadingReport() {
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>("all");
  const [backendData, setBackendData] = useState<BackendLoading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const API_URL = 'get-facultyLoading-reports';
  const TOKEN_KEY = 'accessToken'; 
  
  // 1. Data Fetching (Unchanged)
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage("");

      const accessToken = localStorage.getItem(TOKEN_KEY);
      
      if (!accessToken) {
          setIsLoading(false);
          setIsError(true);
          setErrorMessage("Authentication token not found in Local Storage. Please log in.");
          return;
      }
      
      try {
        const response = await axios.get<BackendResponse>(API_URL, {
            headers: {
                'Authorization': `Bearer ${accessToken}`, 
                'Accept': 'application/json',
            }
        });

        const result = response.data;
        
        if (result.success && Array.isArray(result.facultyLoading)) {
            setBackendData(result.facultyLoading);
        } else {
             throw new Error('Invalid data structure or success: false received');
        }
      } catch (error) {
        console.error("Error fetching data with axios:", error);
        setIsError(true);
        if (isAxiosError(error) && error.response) {
            setErrorMessage(`API Error: ${error.response.statusText} (${error.response.status}). Is the token valid?`);
        } else {
            setErrorMessage("Network error or failed to connect to the API.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); 

  // 2. Data Transformation (Unchanged)
  const allGroupedData = useMemo(() => {
    return transformToGroupedData(backendData);
  }, [backendData]);

  // 3. Filtering (Unchanged)
  const filteredLoadData = useMemo(() => {
    if (selectedFacultyId === "all") {
      return allGroupedData;
    }
    return allGroupedData.filter(block => block.facultyId.toString() === selectedFacultyId);
  }, [selectedFacultyId, allGroupedData]);
  
  // List of unique faculty for the Select dropdown (Unchanged)
  const facultyDropdownOptions = useMemo(() => {
    const uniqueFaculties = new Map<number, string>();
    allGroupedData.forEach(block => uniqueFaculties.set(block.facultyId, block.name));
    
    const options = Array.from(uniqueFaculties.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
        
    return options;
  }, [allGroupedData]);


  if (isLoading) {
    return (
        <div className="p-10 text-center flex flex-col items-center justify-center text-primary">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p>Loading faculty load reports...</p>
        </div>
    );
  }

  if (isError) {
    return (
        <div className="p-10 text-center text-destructive border border-destructive/50 rounded-lg">
            <h3 className="font-bold mb-2">Failed to Load Data</h3>
            <p>{errorMessage || "An unknown error occurred while fetching the data."}</p>
        </div>
    );
  }
  
  return (
    <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">
      {/* Faculty Selection Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-700 flex items-center">
            <UserRound className="h-5 w-5 mr-2 text-primary" /> Faculty Loading Report
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Summary of assigned subjects, sections, schedules, and load hours.</p>
        </div>
        <Select value={selectedFacultyId} onValueChange={setSelectedFacultyId}>
          <SelectTrigger className="w-full sm:w-72 border-primary/50 shadow-sm">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter by Faculty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Faculty</SelectItem>
            {facultyDropdownOptions.map((f) => <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
        <div>
          <Table className="w-full border-collapse">
            <TableHeader className="bg-slate-100/70 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[180px] border-r border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-white">Name of Faculty</TableHead>
                {/* Subject Code Header */}
                <TableHead className="w-[110px] border-r border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-indigo-700 bg-indigo-50/80">Subject Code</TableHead> 
                {/* Type Header */}
                <TableHead className="w-[70px] border-r border-b border-slate-200 text-center text-xs uppercase tracking-wider font-bold text-indigo-700 bg-indigo-50/80">Type</TableHead> 
                <TableHead className="w-[110px] border-r border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-indigo-700 bg-indigo-50/80">Section</TableHead> 
                <TableHead className="text-center w-[105px] border-r border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-indigo-700 bg-indigo-50/80">Paying Hours</TableHead>
                <TableHead className="w-[95px] border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-indigo-700 bg-indigo-50/80">Day</TableHead>
                <TableHead className="w-[145px] border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-indigo-700 bg-indigo-50/80">Time</TableHead>
                <TableHead className="w-[90px] border-r border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-indigo-700 bg-indigo-50/80">Room</TableHead>
                <TableHead className="min-w-[250px] border-r border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-indigo-700 bg-indigo-50/80">Remarks</TableHead>
                
                {/* <TableHead className="text-center w-[80px] border-r">Total Load Units</TableHead> */}

                <TableHead className="w-[120px] text-center border-r border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-white">Total Load Units</TableHead>
                <TableHead className="w-[100px] text-center border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-white">Preps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLoadData.map((facultyBlock, fIndex) => {
                const rowCount = facultyBlock.subjects.length;
                const hasOverload = facultyBlock.overload > 0;
                const bgColor = fIndex % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'; 

                if (rowCount === 0) return null;

                return (
                  <React.Fragment key={facultyBlock.facultyId}>
                    {facultyBlock.subjects.map((subject, sIndex) => {
                      const isLastRow = sIndex === rowCount - 1;
                      const isFirstRow = sIndex === 0;
                      const showRemark = subject.remarkRowSpan > 0; 
                      
                      const isSectionAssigned = subject.section && subject.section.trim() !== '';

                      return (
                        <TableRow 
                          key={`${facultyBlock.facultyId}-${sIndex}`} 
                          className={`${bgColor} ${isLastRow ? 'border-b-2 border-slate-300' : 'border-b border-slate-200'} hover:bg-indigo-50/30 transition-colors`}
                        >
                          {/* 1. Name of Faculty (RowSpan) */}
                          {isFirstRow && (
                            <TableCell rowSpan={rowCount} className="align-top border-r border-slate-200 whitespace-nowrap bg-slate-50/70">
                              <div className="font-bold text-sm text-slate-800 leading-tight">{facultyBlock.name}</div>
                              <div className="text-[11px] text-slate-500 mt-1">{rowCount} assigned load{rowCount === 1 ? '' : 's'}</div>
                            </TableCell>
                          )}
                          
                          {/* Subject Code Cell with uppercase class */}
                          <TableCell className="text-sm border-r border-slate-200 whitespace-nowrap uppercase font-bold text-indigo-700"> 
                              {subject.subjectCode}
                          </TableCell> 
                          
                          {/* Type Cell */}
                          <TableCell className="text-center border-r border-slate-200 whitespace-nowrap">
                              <span className="inline-flex items-center justify-center rounded bg-white/70 px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-inset ring-slate-200">
                                {subject.type}
                              </span>
                          </TableCell> 
                          
                          {/* 5. Section */}
                          <TableCell className="text-sm border-r border-slate-200 whitespace-nowrap">
                              {isSectionAssigned ? (
                                  <span className="font-medium text-slate-700">{subject.section}</span>
                              ) : (
                                  <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                                      Unassigned <br />Section
                                  </span>
                              )}
                          </TableCell> 
                          
                          {/* 6. Paying Hours, Day, Time, Room */}
                          <TableCell className="text-center font-semibold border-r border-slate-200 text-slate-700">{subject.payingHours.toFixed(1) || ""}</TableCell>
                          <TableCell className="text-sm text-slate-600">{subject.day}</TableCell>
                          <TableCell className="text-sm text-slate-600 whitespace-nowrap">{subject.time}</TableCell>
                          <TableCell className="text-sm border-r border-slate-200 font-medium text-slate-700">{subject.room}</TableCell>
                          
                          {/* 10. Remarks */}
                          {showRemark && (
                              <TableCell rowSpan={subject.remarkRowSpan} className="text-sm text-slate-600 border-r border-slate-200 whitespace-normal align-top leading-snug">
                                  {subject.remarks}
                              </TableCell>
                          )}

                          {/* Total Units (Consolidated RowSpan) */}
                          {/* {isFirstRow && (
                             <TableCell rowSpan={rowCount} className="text-center font-bold text-lg align-top border-r">
                               <span className="text-xl font-bold">{facultyBlock.totalUnitsSum}</span>
                             </TableCell>
                          )} */}
                          
                          {/* 11. Fac. Total Load Hrs */}
                          {isFirstRow && (
                            <TableCell rowSpan={rowCount} className="text-center align-top border-r border-slate-200 bg-slate-50/70">
                              <div className="py-1">
                                <span className="text-xl font-bold text-slate-800">{facultyBlock.loadString}</span>
                                {hasOverload && (
                                    <div className="text-destructive font-semibold text-xs mt-1">overload {facultyBlock.overload}</div>
                                )}
                              </div>
                            </TableCell>
                          )}

                          {/* 12. Preps */}
                          {isFirstRow && (
                            <TableCell rowSpan={rowCount} className="text-center align-top bg-slate-50/70">
                              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                                {facultyBlock.preps === 1 ? '1 prep' : `${facultyBlock.preps} preps`}
                              </span>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              
              {filteredLoadData.length === 0 && (
                <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                        No faculty load data found for the selected filter.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
