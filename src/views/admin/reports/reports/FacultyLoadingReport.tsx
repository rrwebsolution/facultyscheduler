import React, { useMemo, useState, useEffect } from "react";
// Assuming you have set up the alias for axios
import axios from '../../../../plugin/axios';
import { isAxiosError } from 'axios';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Loader2 } from "lucide-react"; 

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
    <div className="bg-card p-4 md:p-6 rounded-lg shadow-sm border border-border">
      {/* Faculty Selection Filter (Unchanged) */}
      <div className="flex justify-end mb-6">
        <Select value={selectedFacultyId} onValueChange={setSelectedFacultyId}>
          <SelectTrigger className="w-full md:w-64">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter by Faculty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Faculty</SelectItem>
            {facultyDropdownOptions.map((f) => <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <div>
          <Table className="w-full">
            <TableHeader className="bg-card sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[100px] border-r">Name of Faculty</TableHead>
                {/* Subject Code Header */}
                <TableHead className="w-[80px] border-r">Subject Code</TableHead> 
                {/* Type Header */}
                <TableHead className="w-[50px] border-r">Type</TableHead> 
                <TableHead className="w-[80px] border-r">Section</TableHead> 
                <TableHead className="text-center w-[100px] border-r">Paying Hours</TableHead>
                <TableHead className="w-[80px]">Day</TableHead>
                <TableHead className="w-[150px]">Time</TableHead>
                <TableHead className="w-[80px] border-r">Room</TableHead>
                <TableHead className="min-w-[250px] border-r">Remarks</TableHead>
                
                {/* <TableHead className="text-center w-[80px] border-r">Total Load Units</TableHead> */}

                <TableHead className="w-[100px] text-right border-r">Total Load Units</TableHead>
                <TableHead className="w-[100px] text-center">Preps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLoadData.map((facultyBlock, fIndex) => {
                const rowCount = facultyBlock.subjects.length;
                const hasOverload = facultyBlock.overload > 0;
                const bgColor = fIndex % 2 === 1 ? 'bg-accent/10' : ''; 

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
                          className={`${bgColor} ${isLastRow ? 'border-b-4 border-gray-300' : 'border-b border-border/50'}`}
                        >
                          {/* 1. Name of Faculty (RowSpan) */}
                          {isFirstRow && (
                            <TableCell rowSpan={rowCount} className="font-bold text-base align-top border-r whitespace-nowrap">
                              {facultyBlock.name}
                            </TableCell>
                          )}
                          
                          {/* Subject Code Cell with uppercase class */}
                          <TableCell className="text-sm border-r whitespace-nowrap uppercase"> 
                              {subject.subjectCode}
                          </TableCell> 
                          
                          {/* Type Cell */}
                          <TableCell className="text-center font-semibold text-xs border-r whitespace-nowrap">
                              {subject.type}
                          </TableCell> 
                          
                          {/* 5. Section */}
                          <TableCell className="text-sm border-r whitespace-nowrap">
                              {isSectionAssigned ? (
                                  subject.section
                              ) : (
                                  <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                                      Unassigned <br />Section
                                  </span>
                              )}
                          </TableCell> 
                          
                          {/* 6. Paying Hours, Day, Time, Room */}
                          <TableCell className="text-center font-medium border-r">{subject.payingHours.toFixed(1) || ""}</TableCell>
                          <TableCell className="text-sm">{subject.day}</TableCell>
                          <TableCell className="text-sm">{subject.time}</TableCell>
                          <TableCell className="text-sm border-r">{subject.room}</TableCell>
                          
                          {/* 10. Remarks */}
                          {showRemark && (
                              <TableCell rowSpan={subject.remarkRowSpan} className="text-sm text-muted-foreground border-r whitespace-normal align-top">
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
                            <TableCell rowSpan={rowCount} className="text-center font-bold text-lg align-top border-r">
                              <div className="py-1">
                                <span className="text-xl font-bold">{facultyBlock.loadString}</span>
                                {hasOverload && (
                                    <div className="text-destructive font-semibold text-xs mt-1">overload {facultyBlock.overload}</div>
                                )}
                              </div>
                            </TableCell>
                          )}

                          {/* 12. Preps */}
                          {isFirstRow && (
                            <TableCell rowSpan={rowCount} className="text-center align-top">
                              {facultyBlock.preps === 1 ? 'prep' : `${facultyBlock.preps} preps`}
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
                    <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
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