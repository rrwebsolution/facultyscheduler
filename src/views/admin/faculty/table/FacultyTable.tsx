import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Search,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  CalendarDays,
  List,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AddFacultyButton } from "../modal/AddFacultyButton";
import { SkeletonFacultyCard } from "./../SkeletonFacultyCard";
import axios from "../../../../plugin/axios";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { ViewAssignedSubjectsDialog } from "../../faculty-loading/components/ViewAssignedSubjectsDialog";
import { ScheduleModal } from "../modal/ScheduleModal";
import { FacultyFormModal } from "../modal/FacultyFormModal";

// Apat na buttons na ang magiging target
// 1. List: View Assigned Subjects (ViewAssignedSubjectsDialog)
// 2. CalendarDays: View/Set Availability (ScheduleModal)
// 3. Edit: Edit Faculty (FacultyFormModal)
// 4. Trash2: Permanent Delete

export interface Faculty {
  id: number;
  name: string;
  designation: string;
  expertise: string[];
  department: string;
  email: string;
  // status: "Active" | "Inactive"; // Commented out: Status is less relevant with permanent deletion
  status: "Active"; // Assuming all remaining faculties are active
  profile_picture: string | null;
  deload_units: number;
  t_load_units: number;
  overload_units: number;
  role?: number;
}

interface FacultyLoadSnapshot {
  usedHours: number;
  availableHours: number;
  remainingHours: number;
  utilization: number;
}
interface FacultyAvailabilitySnapshot {
  lines: string[];
}

interface TimeRange {
  start: string;
  end: string;
}

const expertiseColorPalette = [
    { bg: "bg-blue-100", text: "text-blue-800" },
    { bg: "bg-emerald-100", text: "text-emerald-800" },
    { bg: "bg-amber-100", text: "text-amber-800" },
    { bg: "bg-rose-100", text: "text-rose-800" },
    { bg: "bg-indigo-100", text: "text-indigo-800" },
    { bg: "bg-cyan-100", text: "text-cyan-800" },
    { bg: "bg-pink-100", text: "text-pink-800" },
];

const getStringHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

function FacultyTable() {
  const [allFaculty, setAllFaculty] = useState<Faculty[]>([]);
  const [facultyLoadById, setFacultyLoadById] = useState<Record<number, FacultyLoadSnapshot>>({});
  const [facultyAvailabilityById, setFacultyAvailabilityById] = useState<Record<number, FacultyAvailabilitySnapshot>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  // const [filters, setFilters] = useState<{ department: string; status: "All" | "Active" | "Inactive" }>({ department: "All", status: "Active" });
  const [filters, setFilters] = useState<{ department: string }>({ department: "All" }); // Status filter removed
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);
  const [departmentFilterOptions, setDepartmentFilterOptions] = useState<string[]>([]);
  
  // State 1: Para sa View Assigned Subjects (LIST ICON)
  const [isViewAssignedModalOpen, setIsViewAssignedModalOpen] = useState(false);
  const [facultyForViewModal, setFacultyForViewModal] = useState<Faculty | null>(null);

  // State 2: Para sa View/Set Availability (CALENDAR ICON)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [facultyForScheduleModal, setFacultyForScheduleModal] = useState<Faculty | null>(null);


  const [highlightedFacultyId, setHighlightedFacultyId] = useState<number | null>(null);
  const [resettingFacultyId, setResettingFacultyId] = useState<number | null>(null);
  const [expandedAvailabilityRows, setExpandedAvailabilityRows] = useState<Record<number, boolean>>({});
  const navigate = useNavigate();

  const formatTime12 = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(":")) return timeStr || "--:--";
    const [hhRaw, mmRaw] = timeStr.split(":");
    const hh = Number(hhRaw);
    const mm = Number(mmRaw);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return timeStr;
    const period = hh >= 12 ? "PM" : "AM";
    const hour12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${hour12}:${String(mm).padStart(2, "0")} ${period}`;
  };

  const timeToMinutes = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(":")) return 0;
    const [hhRaw, mmRaw] = timeStr.split(":");
    const hh = Number(hhRaw);
    const mm = Number(mmRaw);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
    return hh * 60 + mm;
  };

  const calculateHoursFromRanges = (ranges: { start: string; end: string }[]) => {
    return ranges.reduce((sum, slot) => {
      const mins = Math.max(0, timeToMinutes(slot.end) - timeToMinutes(slot.start));
      return sum + mins / 60;
    }, 0);
  };

  const minutesToTime = (totalMinutes: number) => {
    const bounded = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
    const hh = Math.floor(bounded / 60);
    const mm = bounded % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };

  const subtractRanges = (base: TimeRange[], used: TimeRange[]) => {
    let remaining = [...base];

    for (const u of used) {
      const us = timeToMinutes(u.start);
      const ue = timeToMinutes(u.end);
      if (ue <= us) continue;

      const next: TimeRange[] = [];
      for (const r of remaining) {
        const rs = timeToMinutes(r.start);
        const re = timeToMinutes(r.end);

        if (re <= rs || ue <= rs || us >= re) {
          next.push(r);
          continue;
        }

        if (us > rs) next.push({ start: r.start, end: minutesToTime(us) });
        if (ue < re) next.push({ start: minutesToTime(ue), end: r.end });
      }
      remaining = next;
    }

    return remaining.filter((r) => timeToMinutes(r.end) > timeToMinutes(r.start));
  };

  const buildFreeSlotLines = (
    availabilityByDay: Record<string, TimeRange[]>,
    schedules: Array<{ day: string; start_time?: string; end_time?: string; start?: string; end?: string }>
  ) => {
    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dayShort: Record<string, string> = {
      Monday: "Mon",
      Tuesday: "Tue",
      Wednesday: "Wed",
      Thursday: "Thu",
      Friday: "Fri",
      Saturday: "Sat",
      Sunday: "Sun",
    };

    const usedByDay: Record<string, TimeRange[]> = {};
    for (const row of schedules) {
      const day = row?.day;
      const start = row?.start_time ?? row?.start ?? "";
      const end = row?.end_time ?? row?.end ?? "";
      if (!day || !start || !end) continue;
      if (!usedByDay[day]) usedByDay[day] = [];
      usedByDay[day].push({ start, end });
    }

    for (const day of Object.keys(usedByDay)) {
      usedByDay[day].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    }

    const lines: string[] = [];
    for (const day of dayOrder) {
      const base = Array.isArray(availabilityByDay?.[day]) ? availabilityByDay[day] : [];
      const used = usedByDay[day] || [];
      const free = subtractRanges(base, used);
      for (const slot of free) {
        lines.push(`${dayShort[day]} ${formatTime12(slot.start)}-${formatTime12(slot.end)}`);
      }
    }

    return lines;
  };

  const fetchFaculty = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    const token = localStorage.getItem('accessToken');
    if (!token) {
        toast.error("Authentication required.");
        setIsLoading(false);
        navigate('/user-login');
        return;
    }
    try {
        // Fetch only the 'active' faculty list
        const response = await axios.get('/faculties', {
          headers: { 'Authorization': `Bearer ${token}` },
          params: forceRefresh ? { _ts: Date.now() } : undefined
        });
        
        const activeList: any[] = response.data.faculties || [];
        // const inactiveList: any[] = response.data.inactive_faculties || []; // Commented out: No longer needed for archive

        const transform = (f: any): Faculty => ({
            id: f.id, name: f.user?.name || 'N/A', email: f.user?.email || 'N/A', role: f.user?.role,
            designation: f.designation || '', department: f.department || '', 
            // status: f.status === 0 ? "Active" : "Inactive", // Simplified status logic
            status: "Active",
            profile_picture: f.profile_picture ? `${import.meta.env.VITE_URL}/${f.profile_picture}` : null, 
            expertise: f.expertises?.map((exp: any) => exp.list_of_expertise) || [],
            deload_units: f.deload_units || 0, 
            t_load_units: f.t_load_units || 0, 
            overload_units: f.overload_units || 0,
        });
        
        // Only display active faculty
        // const allTransformed = [...activeList.map(transform), ...inactiveList.map(transform)];
        const allTransformed = activeList.map(transform);
        setAllFaculty(allTransformed);

        const loadEntries = await Promise.all(
          allTransformed.map(async (faculty) => {
            try {
              const [schedulesRes, availabilityRes] = await Promise.all([
                axios.get(`faculty-loading/${faculty.id}/schedules`, {
                  headers: { Authorization: `Bearer ${token}` },
                }),
                axios.get(`/faculties/${faculty.id}/availability`, {
                  headers: { Authorization: `Bearer ${token}` },
                }),
              ]);
              const availabilityData = availabilityRes?.data || {};
              const availabilityRanges = Object.values(availabilityData).flatMap((slots: any) =>
                Array.isArray(slots)
                  ? slots.map((slot: any) => ({ start: slot?.start ?? "", end: slot?.end ?? "" }))
                  : []
              );
              const availableHours = calculateHoursFromRanges(availabilityRanges);

              const scheduleRows = Array.isArray(schedulesRes?.data?.data)
                ? schedulesRes.data.data
                : Array.isArray(schedulesRes?.data)
                  ? schedulesRes.data
                  : [];
              const usedHours = calculateHoursFromRanges(
                scheduleRows.map((row: any) => ({
                  start: row?.start_time ?? row?.start ?? "",
                  end: row?.end_time ?? row?.end ?? "",
                }))
              );

              const remainingHours = Math.max(0, availableHours - usedHours);
              const utilization = availableHours > 0 ? Math.min(100, (usedHours / availableHours) * 100) : 0;
              const availabilityLines = buildFreeSlotLines(availabilityData, scheduleRows);
              return [faculty.id, { usedHours, availableHours, remainingHours, utilization, availabilityLines }] as const;
            } catch {
              return [faculty.id, { usedHours: 0, availableHours: 0, remainingHours: 0, utilization: 0, availabilityLines: [] }] as const;
            }
          })
        );

        const nextLoadState: Record<number, FacultyLoadSnapshot> = {};
        const nextAvailabilityState: Record<number, FacultyAvailabilitySnapshot> = {};
        for (const [facultyId, payload] of loadEntries) {
          const { availabilityLines, ...loadInfo } = payload;
          nextLoadState[facultyId] = loadInfo;
          nextAvailabilityState[facultyId] = { lines: [...availabilityLines] };
        }

        setFacultyLoadById(nextLoadState);
        setFacultyAvailabilityById(nextAvailabilityState);
    } catch (error) {
      toast.error("Failed to fetch faculty data.");
      // navigate('/user-login');
    } finally {
        setIsLoading(false);
    }
    }, [navigate]);

  useEffect(() => {
    const fetchDepartmentsForFilter = async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        try {
            const response = await axios.get('/department-program', { headers: { 'Authorization': `Bearer ${token}` } });
            const programList: any[] = Array.isArray(response.data.programs) ? response.data.programs : Object.values(response.data.programs || {});
            const departmentNames = [...new Set(programList.map(p => p.program_name))];
            setDepartmentFilterOptions(departmentNames.sort());
        } catch (error) {
            console.error("Failed to fetch departments for filter:", error);
        }
    };
    fetchDepartmentsForFilter();
  }, []);

  useEffect(() => {
    fetchFaculty();
  }, [fetchFaculty]);

  const handleSave = (newOrUpdatedFaculty: Faculty) => {
    setIsModalOpen(false);
    const facultyExists = allFaculty.some(f => f.id === newOrUpdatedFaculty.id);

    if (facultyExists) {
      setAllFaculty(prev => prev.map(f => (f.id === newOrUpdatedFaculty.id ? newOrUpdatedFaculty : f)));
      setHighlightedFacultyId(newOrUpdatedFaculty.id);
      globalThis.setTimeout(() => setHighlightedFacultyId(null), 5000);
    } else {
      const facultyToAdd = { ...newOrUpdatedFaculty, status: 'Active' as const };
      setAllFaculty(prev => [facultyToAdd, ...prev]);
      setCurrentPage(1);
      setHighlightedFacultyId(facultyToAdd.id);
      globalThis.setTimeout(() => setHighlightedFacultyId(null), 5000);
    }
  };

  /**
   * *** MODIFIED FUNCTION: Permanent Deletion (instead of Deactivate/Archive) ***
   */
  const handleDeactivate = (facultyId: number) => {
    Swal.fire({
        title: 'Delete faculty record?',
        text: "This action is permanent and cannot be undone. Deletion is useless if this faculty already has assigned subjects, schedule loads, or availability slots.",
        icon: 'warning',
        showCancelButton: true, 
        confirmButtonColor: '#d33', 
        cancelButtonText: 'Cancel',
        confirmButtonText: 'Delete'
    }).then(async (result) => {
        if (result.isConfirmed) {
            const token = localStorage.getItem('accessToken');
            if (!token) { toast.error("Authentication required."); return; }
            try {
                // The DELETE request maps to the backend function $faculty->delete()
                const response = await axios.delete(`/faculties/${facultyId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                
                toast.success(response.data.message || "Faculty record deleted successfully.");
                
                // KEY CHANGE: Remove the deleted faculty from the state
                setAllFaculty(prev => prev.filter(f => f.id !== facultyId)); 
                
            } catch (error: any) {
                const message = error?.response?.data?.message || "Failed to delete faculty.";
                toast.error(message);
            }
        }
    });
  };

  // const handleActivate = (facultyId: number) => { // Commented out: No longer needed with permanent deletion
  //   Swal.fire({
  //       title: 'Activate this faculty?', text: "This will make the faculty available again.", icon: 'info',
  //       showCancelButton: true, confirmButtonColor: '#3085d6', confirmButtonText: 'Yes, activate it!'
  //   }).then(async (result) => {
  //       if (result.isConfirmed) {
  //           const token = localStorage.getItem('accessToken');
  //           if (!token) { toast.error("Authentication required."); return; }
  //           try {
  //               const response = await axios.post(`/faculties/${facultyId}/activate`, {}, { headers: { 'Authorization': `Bearer ${token}` } });
  //               toast.success(response.data.message || "Faculty activated.");
  //               setAllFaculty(prev => prev.map(f => f.id === facultyId ? { ...f, status: 'Active' } : f));
  //           } catch (error) {
  //               toast.error("Failed to activate faculty.");
  //           }
  //       }
  //   });
  // };

  const handleAdd = () => { setEditingFaculty(null); setIsModalOpen(true); };

  const handleResetPassword = (facultyMember: Faculty) => {
    Swal.fire({
      title: `Reset password for ${facultyMember.name}?`,
      text: "This will reset the account password to the system default.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, reset password"
    }).then(async (result) => {
      if (!result.isConfirmed) return;

      const token = localStorage.getItem("accessToken");
      if (!token) {
        toast.error("Authentication required.");
        return;
      }

      setResettingFacultyId(facultyMember.id);
      try {
        const response = await axios.post(
          `/faculties/${facultyMember.id}/reset-password`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const defaultPassword = response?.data?.temporary_password || "@password123";
        toast.success(`Password reset successful. Temporary password: ${defaultPassword}`);
      } catch (error: any) {
        const msg = error?.response?.data?.message || "Failed to reset password.";
        toast.error(msg);
      } finally {
        setResettingFacultyId(null);
      }
    });
  };
  
  const handleEdit = (facultyMember: Faculty) => { 
    setEditingFaculty(facultyMember); 
    setIsModalOpen(true); 
  };

  const toggleAvailabilityRow = (facultyId: number) => {
    setExpandedAvailabilityRows((prev) => ({
      ...prev,
      [facultyId]: !prev[facultyId],
    }));
  };

  // HANDLERS FOR VIEWING ASSIGNED SUBJECTS (List Icon)
  const handleOpenAssignedViewModal = (facultyMember: Faculty) => {
    setFacultyForViewModal(facultyMember);
    setIsViewAssignedModalOpen(true);
  };
  
  const handleCloseAssignedViewModal = () => {
    setIsViewAssignedModalOpen(false);
    setFacultyForViewModal(null);
  };

  // HANDLERS FOR VIEWING/SETTING AVAILABILITY (CalendarDays Icon)
  const handleOpenAvailabilityModal = (facultyMember: Faculty) => {
    setFacultyForScheduleModal(facultyMember);
    setIsScheduleModalOpen(true);
  };
  
  const handleCloseAvailabilityModal = () => {
    setIsScheduleModalOpen(false);
    setFacultyForScheduleModal(null);
  };
  
  const filteredData = useMemo(() => {
    return allFaculty
      // .filter(f => (f.id === highlightedFacultyId) || (filters.status === "All" || f.status === filters.status)) // Commented out: Status filter removed
      .filter(f => (f.id === highlightedFacultyId) || (filters.department === "All" || f.department === filters.department))
      .filter(f => {
        const searchLower = searchTerm.toLowerCase();
        return f.id === highlightedFacultyId || (
          (f.name || '').toLowerCase().includes(searchLower) ||
          (f.department || '').toLowerCase().includes(searchLower) ||
          (f.designation || '').toLowerCase().includes(searchLower) ||
          (f.expertise || []).some(e => (e || '').toLowerCase().includes(searchLower))
        );
      });
  }, [allFaculty, searchTerm, filters, highlightedFacultyId]); // Removed filters.status dependency

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const availabilitySummary = useMemo(() => {
    return filteredData.reduce(
      (acc, faculty) => {
        const row = facultyLoadById[faculty.id];
        if (!row) return acc;
        acc.availableHours += row.availableHours;
        acc.usedHours += row.usedHours;
        acc.remainingHours += row.remainingHours;
        if (row.utilization >= 80) acc.nearLimit += 1;
        return acc;
      },
      { availableHours: 0, usedHours: 0, remainingHours: 0, nearLimit: 0 }
    );
  }, [filteredData, facultyLoadById]);
  
  // const statuses = ["All", "Active", "Inactive"]; // Commented out: Status filter options removed
  const expertiseOptions = [
    "Computer Networks",
    "HCI",
    "Computer Graphics & Vision",
    "Software Engineering",
    "Software Development",
    "Cyber Security",
    "Programming",
    "Mobile App Development", 
    "Data Science",
    "Artificial Intelligence",
    "Information Systems",
    "Machine Learning",
    "Robotics"
  ];

  return (
    <>
      <header className="mb-6 md:mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Faculty Management</h1>
          <p className="text-muted-foreground mt-2">A centralized hub to add, edit, and manage all faculty members.</p>
        </div>
        <button
          type="button"
          onClick={() => fetchFaculty(true)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Refresh data"
          aria-label="Refresh data"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          <span className="text-sm font-medium">Refresh data</span>
        </button>
      </header>

      <div className="bg-card p-4 md:p-6 rounded-lg shadow-sm border border-border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-lg border border-border p-4 bg-muted/30">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Available</p>
            <p className="text-2xl font-bold text-foreground">{availabilitySummary.availableHours.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Hours</p>
          </div>
          <div className="rounded-lg border border-border p-4 bg-blue-50/40">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Used Time</p>
            <p className="text-2xl font-bold text-blue-700">{availabilitySummary.usedHours.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Hours from View Faculty Load</p>
          </div>
          <div className="rounded-lg border border-border p-4 bg-emerald-50/40">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining</p>
            <p className="text-2xl font-bold text-emerald-700">{availabilitySummary.remainingHours.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Hours still available</p>
          </div>
          <div className="rounded-lg border border-border p-4 bg-amber-50/40">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Near Limit</p>
            <p className="text-2xl font-bold text-amber-700">{availabilitySummary.nearLimit}</p>
            <p className="text-xs text-muted-foreground">Faculty at 80%+ utilization</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input placeholder="Search faculty..." className="pl-10 w-full" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Select value={filters.department} onValueChange={(v) => setFilters(f => ({ ...f, department: v }))}>
              <SelectTrigger className="w-full sm:w-auto md:w-[200px]"><Briefcase className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent><SelectItem value="All">All Departments</SelectItem>{departmentFilterOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
            {/* 
            <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v as any }))}>
              <SelectTrigger className="w-full sm:w-auto md:w-[180px]"><Filter className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            */}
            <AddFacultyButton onAdd={handleAdd} />
          </div>
        </div>
        
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[300px]">Faculty Member</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Expertise</TableHead>
                <TableHead className="text-center">Teaching Load</TableHead>
                <TableHead className="text-center">Deload</TableHead>
                <TableHead className="text-center">Overload</TableHead>
                <TableHead className="w-[260px]">Availability Monitor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: itemsPerPage }).map((_, i) => <SkeletonFacultyCard key={i} />)
              ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center h-48 text-muted-foreground">No Faculty Found</TableCell></TableRow>
              ) : (
                paginatedData.map((f) => (
                  <TableRow key={f.id} className={`${highlightedFacultyId === f.id ? 'ring-2 ring-yellow-400 bg-yellow-50' : ''}`}>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <img 
                          src={f.profile_picture || `https://avatar.iran.liara.run/public/boy?username=${(f.name || '').replace(/\s/g, '')}`} 
                          alt={f.name} 
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-offset-2 ring-border" 
                        />
                        <div>
                          <p className="font-semibold text-foreground whitespace-nowrap">{f.name}</p>
                          <p className="text-sm text-muted-foreground whitespace-nowrap">{f.designation}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{f.department}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                        {f.expertise.map((e) => {
                            const colorIndex = getStringHash(e) % expertiseColorPalette.length;
                            const color = expertiseColorPalette[colorIndex];
                            return (<Badge key={e} className={`font-normal hover:${color.bg} ${color.bg} hover:${color.text} ${color.text}`}>{e}</Badge>)
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">{f.t_load_units}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{f.deload_units}</TableCell>
                    <TableCell className="text-center text-destructive">{f.overload_units}</TableCell>
                    <TableCell>
                      {(() => {
                        const load = facultyLoadById[f.id];
                        const availability = facultyAvailabilityById[f.id];
                        if (!load) return <span className="text-xs text-muted-foreground">Loading...</span>;
                        const utilizationColor = load.utilization >= 80 ? "text-amber-700" : "text-emerald-700";
                        const allLines = availability?.lines || [];
                        const isExpanded = !!expandedAvailabilityRows[f.id];
                        const visibleLines = isExpanded ? allLines : allLines.slice(0, 2);
                        const remainingLinesCount = Math.max(0, allLines.length - visibleLines.length);
                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Used {load.usedHours.toFixed(1)}h / {load.availableHours.toFixed(1)}h</span>
                              <span className={`font-semibold ${utilizationColor}`}>{load.utilization.toFixed(0)}%</span>
                            </div>
                            <Progress value={load.utilization} className="h-2" />
                            <p className="text-[11px] text-muted-foreground">Remaining: {load.remainingHours.toFixed(1)} hours</p>
                            <div className="pt-1 border-t border-border/70 space-y-0.5">
                              {visibleLines.length > 0 ? (
                                <>
                                  {visibleLines.map((line) => (
                                    <p key={`${f.id}-${line}`} className="text-[11px] text-foreground leading-tight">{line}</p>
                                  ))}
                                  {remainingLinesCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleAvailabilityRow(f.id)}
                                      className="text-[11px] text-primary hover:underline"
                                    >
                                      +{remainingLinesCount} more slots
                                    </button>
                                  )}
                                  {isExpanded && allLines.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleAvailabilityRow(f.id)}
                                      className="text-[11px] text-muted-foreground hover:underline"
                                    >
                                      Show less
                                    </button>
                                  )}
                                </>
                              ) : (
                                <p className="text-[11px] text-muted-foreground">No availability time set</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {/* Assuming all faculties listed are now 'Active' */}
                      <Badge variant={'default'}>Active</Badge> 
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                         
                          {/* 1. VIEW ASSIGNED SUBJECTS (LIST ICON) */}
                         <Button 
                            variant="ghost" 
                            size="icon" 
                            title="View faculty load" 
                            onClick={() => handleOpenAssignedViewModal(f)} 
                            className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <List className="h-4 w-4 text-purple-500" /> 
                        </Button>
                          
                          {/* 2. VIEW AVAILABILITY / SCHEDULE (CALENDAR ICON) */}
                         <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Set Availability" 
                            onClick={() => handleOpenAvailabilityModal(f)} 
                            className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <CalendarDays className="h-4 w-4 text-green-500" /> 
                        </Button>
                          
                          {/* 3. EDIT FACULTY (EDIT ICON) */}
                        <Button variant="ghost" size="icon" title="Edit Faculty" onClick={() => handleEdit(f)} className="h-8 w-8 text-muted-foreground hover:text-primary"><Edit className="h-4 w-4 text-blue-500" /></Button>

                          {/* 4. RESET PASSWORD (KEY ICON) */}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reset Password"
                          onClick={() => handleResetPassword(f)}
                          disabled={resettingFacultyId === f.id}
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                        >
                          <KeyRound className={`h-4 w-4 text-amber-500 ${resettingFacultyId === f.id ? 'animate-pulse' : ''}`} />
                        </Button>
                        
                          {/* 5. PERMANENT DELETE (TRASH2 ICON) */}
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                title="Permanently Delete Faculty"
                                onClick={() => handleDeactivate(f.id)} 
                                className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mt-6 text-sm gap-4">
          <p className="text-muted-foreground">
            Showing <strong>{paginatedData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredData.length)}</strong> of <strong>{filteredData.length}</strong> entries
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4 mr-1" />Previous</Button>
            <span className="font-medium text-foreground px-2">Page {currentPage} of {totalPages || 1}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next<ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      </div>

      {/* MODAL FOR ADD/EDIT FACULTY */}
      <FacultyFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingFaculty}
        expertiseOptions={expertiseOptions}
      />

      {/* 1. MODAL FOR VIEW ASSIGNED SUBJECTS (LIST ICON) */}
      <ViewAssignedSubjectsDialog
        isOpen={isViewAssignedModalOpen}
        onClose={handleCloseAssignedViewModal}
        faculty={facultyForViewModal}
      />
      
      {/* 2. MODAL FOR VIEW/SET AVAILABILITY (CALENDAR ICON) */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={handleCloseAvailabilityModal}
        faculty={facultyForScheduleModal}
      />
    </>
  );
}

export default FacultyTable;
