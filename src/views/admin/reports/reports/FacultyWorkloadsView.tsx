import { useState, useEffect } from "react";
import { User, BarChartHorizontal, Loader2 } from "lucide-react"; 
import axios from "../../../../plugin/axios";
import { isAxiosError } from 'axios';

// 1. Local types for API response (faculty-loading rows)
interface ApiLoadingRow {
  id: number;
  faculty_id: number;
  // ASSUMPTION: subject_id is available on the main row object
  subject_id?: number; 
  type: string; 
  faculty: {
    id: number;
    user: { id: number; name: string };
    t_load_units?: number;
    overload_units?: number;
  };
  subject: {
    // FIX: Using total_units as the source of truth for load
    total_units?: number; 
    lec_units?: number;
    lab_units?: number;
    total_lec_hrs?: number | null;
    total_lab_hrs?: number | null;
  };
}

interface GetFacultyLoadingResponse {
  success: boolean;
  data: ApiLoadingRow[];
}

// 2. Define the UI model for workloads
interface FacultyLoad {
  facultyId: number;
  name: string;
  t_load_units: number; 
  limit: number; 
  overloadUnits: number; 
}

export function FacultyWorkloadsView() {
  const [facultyWorkloads, setFacultyWorkloads] = useState<FacultyLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- POLICY LIMITS (Constants) ---
  const BASE_LOAD = 21;       
  const OVERLOAD_LIMIT = 3;   
  const TOTAL_MAX_LOAD = BASE_LOAD + OVERLOAD_LIMIT; 
  // ---------------------------------

  // 3. Fetch data from the faculty-loading endpoint and compute assigned loads per faculty
  useEffect(() => {
    const fetchWorkloads = async () => {
      try {
        setLoading(true);
        setError(null);

        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) {
          setError("Authentication token not found. Please log in.");
          setLoading(false);
          return;
        }

        const config = {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        };

        const response = await axios.get<GetFacultyLoadingResponse>('get-faculty-loading', config);

        if (!response.data || !response.data.success || !Array.isArray(response.data.data)) {
          setError('Invalid response from server when fetching faculty loading.');
          setLoading(false);
          return;
        }

        const rows = response.data.data;

        // Group by faculty and SUM the DISTINCT total_units for each assigned subject.
        const facultyMap = new Map<number, { 
            name: string; 
            // This map ensures we only count a subject's total_units once
            distinctSubjects: Map<number, number>; // Map<subject_id, total_units>
            limit: number; 
            overloadUnits: number; 
        }>();

        rows.forEach((row) => {
            const facultyId = row.faculty?.id ?? row.faculty_id;
            const name = row.faculty?.user?.name ?? `Faculty ${facultyId}`;
            const subjectId = row.subject_id; 
            const totalUnits = row.subject.total_units ?? 0; // The required unit value

            // Determine faculty limits 
            const facultyLimit = (row.faculty && typeof row.faculty.t_load_units === 'number') ? row.faculty.t_load_units : BASE_LOAD;
            const facultyOverload = (row.faculty && typeof (row.faculty as any).overload_units === 'number') ? (row.faculty as any).overload_units : OVERLOAD_LIMIT;

            // Initialize the entry if it doesn't exist
            if (!facultyMap.has(facultyId)) {
                facultyMap.set(facultyId, { 
                    name, 
                    distinctSubjects: new Map<number, number>(), 
                    limit: facultyLimit, 
                    overloadUnits: facultyOverload 
                });
            }
            
            const currentEntry = facultyMap.get(facultyId)!;

            // FIX: Use total_units and prevent double-counting
            if (subjectId !== undefined && totalUnits > 0) {
                // The key is subjectId, the value is totalUnits. 
                // Using Map.set() ensures that if the same subject_id appears 
                // in multiple rows, it is only recorded once with its total_units.
                currentEntry.distinctSubjects.set(subjectId, totalUnits);
            }
        });

        // Build array for UI by summing the distinct subject total_units
        const workloads: FacultyLoad[] = Array.from(facultyMap.entries()).map(([facultyId, v]) => {
            // Sum all the total_units stored in the Map
            const totalLoadUnits = Array.from(v.distinctSubjects.values())
                .reduce((sum, units) => sum + units, 0);

            return {
                facultyId,
                name: v.name,
                t_load_units: totalLoadUnits, 
                limit: v.limit,
                overloadUnits: v.overloadUnits,
            };
        });

        workloads.sort((a, b) => a.name.localeCompare(b.name));

        setFacultyWorkloads(workloads);
      } catch (err) {
        const errorMessage = isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Could not connect to the server or fetch data.";

        console.error("Error fetching faculty workload data:", err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkloads();
  }, []);
  
  // --- Loading State Handler ---
  if (loading) {
    return (
      <div className="space-y-6 pt-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Faculty Workload Management</h1>
        <div className="bg-card p-6 rounded-lg shadow-sm border text-center text-muted-foreground flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
          <p>Loading Faculty Workloads...</p>
        </div>
      </div>
    );
  }

  // --- Error State Handler ---
  if (error) {
    return (
       <div className="space-y-6 pt-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-destructive">Data Error</h1>
        <div className="bg-card p-6 rounded-lg shadow-sm border border-destructive text-center text-destructive">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }
  
  // --- Empty State Handler ---
  if (facultyWorkloads.length === 0) {
    return (
      <div className="space-y-6 pt-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Faculty Workload Management</h1>
        <div className="bg-card p-6 rounded-lg shadow-sm border text-center text-muted-foreground">
          <p>No active faculty found to display workload data.</p>
        </div>
      </div>
    );
  }

  // --- Main Render Logic ---
  return (
    <div className="space-y-6"> 
        {/* Page Header Structure */}
        <header className="pb-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
                <BarChartHorizontal className="h-6 w-6 text-primary" />
                Faculty Workload Management
            </h1>
            <p className="text-muted-foreground text-sm mt-1 ml-9">
                Overview of current unit loads vs. a standard teaching load of <span className="font-semibold">{BASE_LOAD} units</span> with an allowed overload of <span className="font-semibold">{OVERLOAD_LIMIT} units</span> (Total: {TOTAL_MAX_LOAD} units).
            </p>
        </header>

        {/* Workload Cards */}
        <div className="bg-card p-4 md:p-6 rounded-lg shadow-sm border border-border">
          <div className="space-y-6">
            {facultyWorkloads.map((faculty) => {
              const assignedLoad = faculty.t_load_units; 
              const facultyLimit = faculty.limit || BASE_LOAD; 
              const allowedOverload = faculty.overloadUnits ?? OVERLOAD_LIMIT; 
              const allowedMax = facultyLimit + allowedOverload;

              let loadTextColor = "text-primary";
              let statusText = "";

              // Determine status text and colors based on allowed overload
              if (assignedLoad > allowedMax) {
                loadTextColor = "text-red-600";
                statusText = `(EXCESSIVE OVERLOAD +${(assignedLoad - allowedMax).toFixed(1)})`;
              } else if (assignedLoad > facultyLimit) {
                loadTextColor = "text-yellow-500";
                statusText = `(OVERLOAD +${(assignedLoad - facultyLimit).toFixed(1)} of ${allowedOverload})`;
              } else if (assignedLoad === facultyLimit) {
                loadTextColor = "text-primary";
                statusText = "(FULL LOAD)";
              } else {
                loadTextColor = "text-muted-foreground";
                statusText = `${facultyLimit - assignedLoad}`;
              }
              
              // Ensure assignedLoad is formatted to one decimal place if not an integer
              const displayLoad = Number.isInteger(assignedLoad) ? assignedLoad : assignedLoad.toFixed(1);


              return (
                <div key={faculty.name}>
                  <div className="flex justify-between items-center mb-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground">{faculty.name}</span>
                    </div>
                    {/* Display load and status text. */}
                    <span className={`font-mono font-bold ${loadTextColor}`}>
                      {statusText}/{facultyLimit}
                      {displayLoad && <span className={`ml-1 text-sm ${loadTextColor}`}>{`(${displayLoad} units left)` }</span>}
                    </span>
                  </div>
                  {/* Segmented progress bar: base (primary), overload (yellow), excess (red) */}
                  <div className="w-full h-3 rounded overflow-hidden bg-border">
                    {(() => {
                      const baseLimit = facultyLimit; 
                      const overloadLimit = allowedMax; 
                      const totalCap = Math.max(assignedLoad, overloadLimit, 1); 

                      const primaryFilled = Math.max(0, Math.min(assignedLoad, baseLimit));
                      const yellowFilled = Math.max(0, Math.min(assignedLoad, overloadLimit) - baseLimit);
                      const redFilled = Math.max(0, assignedLoad - overloadLimit);

                      const primaryPct = (primaryFilled / totalCap) * 100;
                      const yellowPct = (yellowFilled / totalCap) * 100;
                      const redPct = (redFilled / totalCap) * 100;

                      return (
                        <div className="flex h-3 w-full">
                          <div style={{ width: `${primaryPct}%` }} className="bg-primary" />
                          <div style={{ width: `${yellowPct}%` }} className="bg-yellow-500" />
                          <div style={{ width: `${redPct}%` }} className="bg-red-600" />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
    </div>
  );
}