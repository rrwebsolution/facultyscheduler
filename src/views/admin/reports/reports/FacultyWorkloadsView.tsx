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
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[220px]">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
          <p>Loading Faculty Workloads...</p>
        </div>
      </div>
    );
  }

  // --- Error State Handler ---
  if (error) {
    return (
       <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-destructive/50 text-center text-destructive min-h-[220px] flex items-center justify-center">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }
  
  // --- Empty State Handler ---
  if (facultyWorkloads.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-center text-muted-foreground">
          <p>No active faculty found to display workload data.</p>
        </div>
      </div>
    );
  }

  // --- Main Render Logic ---
  return (
    <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200"> 
        <header className="mb-6 border-b border-slate-200 pb-4">
            <h3 className="text-xl font-semibold text-slate-700 flex items-center">
                <BarChartHorizontal className="h-5 w-5 mr-2 text-primary" />
                Faculty Workloads
            </h3>
            <p className="text-muted-foreground text-sm mt-1">
                Current unit loads compared against <span className="font-semibold">{BASE_LOAD} base units</span> plus <span className="font-semibold">{OVERLOAD_LIMIT} overload units</span>.
            </p>
        </header>

        <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden" data-workloads-export="true">
          <div className="divide-y divide-slate-200">
            {facultyWorkloads.map((faculty) => {
              const assignedLoad = faculty.t_load_units; 
              const facultyLimit = faculty.limit || BASE_LOAD; 
              const allowedOverload = faculty.overloadUnits ?? OVERLOAD_LIMIT; 
              const allowedMax = facultyLimit + allowedOverload;

              let loadTextColor = "text-primary";
              let statusBadgeClass = "bg-slate-100 text-slate-700 ring-slate-200";
              let statusText = "";

              // Determine status text and colors based on allowed overload
              if (assignedLoad > allowedMax) {
                loadTextColor = "text-red-600";
                statusBadgeClass = "bg-red-50 text-red-700 ring-red-200";
                statusText = `Excess +${(assignedLoad - allowedMax).toFixed(1)}`;
              } else if (assignedLoad > facultyLimit) {
                loadTextColor = "text-yellow-500";
                statusBadgeClass = "bg-amber-50 text-amber-700 ring-amber-200";
                statusText = `Overload +${(assignedLoad - facultyLimit).toFixed(1)} / ${allowedOverload}`;
              } else if (assignedLoad === facultyLimit) {
                loadTextColor = "text-primary";
                statusBadgeClass = "bg-indigo-50 text-indigo-700 ring-indigo-100";
                statusText = "Full load";
              } else {
                loadTextColor = "text-slate-600";
                statusBadgeClass = "bg-emerald-50 text-emerald-700 ring-emerald-100";
                statusText = `${facultyLimit - assignedLoad} units available`;
              }
              
              // Ensure assignedLoad is formatted to one decimal place if not an integer
              const displayLoad = Number.isInteger(assignedLoad) ? assignedLoad : assignedLoad.toFixed(1);


              return (
                <div
                  key={faculty.name}
                  className="p-4 hover:bg-indigo-50/20 transition-colors"
                  data-workload-row="true"
                  data-faculty-name={faculty.name}
                  data-assigned-load={displayLoad}
                  data-base-limit={facultyLimit}
                  data-overload-allowance={allowedOverload}
                  data-status={statusText}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 rounded-md bg-slate-100 p-2">
                        <User className="h-4 w-4 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800 block truncate">{faculty.name}</span>
                        <span className="text-xs text-slate-500">Limit {facultyLimit} units, overload allowance {allowedOverload}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClass}`}>
                        {statusText}
                      </span>
                      <span className={`font-mono font-bold ${loadTextColor}`}>
                        {displayLoad}/{facultyLimit}
                      </span>
                    </div>
                  </div>
                  {/* Segmented progress bar: base (primary), overload (yellow), excess (red) */}
                  <div className="w-full h-3 rounded-full overflow-hidden bg-slate-100 ring-1 ring-inset ring-slate-200">
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
                          <div style={{ width: `${primaryPct}%` }} className="bg-indigo-500" />
                          <div style={{ width: `${yellowPct}%` }} className="bg-amber-400" />
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
