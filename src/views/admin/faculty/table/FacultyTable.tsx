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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  const navigate = useNavigate();

  const fetchFaculty = useCallback(async () => {
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
        const response = await axios.get('/faculties', { headers: { 'Authorization': `Bearer ${token}` } });
        
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
        title: 'Are you absolutely sure?', 
        text: "This faculty member and ALL their related data (expertises, loadings, etc.) will be PERMANENTLY DELETED and cannot be recovered.", 
        icon: 'warning',
        showCancelButton: true, 
        confirmButtonColor: '#d33', 
        confirmButtonText: 'Yes, permanently delete it!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            const token = localStorage.getItem('accessToken');
            if (!token) { toast.error("Authentication required."); return; }
            try {
                // The DELETE request maps to the backend function $faculty->delete()
                const response = await axios.delete(`/faculties/${facultyId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                
                toast.success(response.data.message || "Faculty deleted successfully!");
                
                // KEY CHANGE: Remove the deleted faculty from the state
                setAllFaculty(prev => prev.filter(f => f.id !== facultyId)); 
                
            } catch (error) {
                toast.error("Failed to delete faculty. This faculty might have related records that prevent deletion.");
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
  
  const handleEdit = (facultyMember: Faculty) => { 
    setEditingFaculty(facultyMember); 
    setIsModalOpen(true); 
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
          onClick={() => fetchFaculty()}
          disabled={isLoading}
          className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Refresh data"
          aria-label="Refresh data"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="bg-card p-4 md:p-6 rounded-lg shadow-sm border border-border">
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: itemsPerPage }).map((_, i) => <SkeletonFacultyCard key={i} />)
              ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center h-48 text-muted-foreground">No Faculty Found</TableCell></TableRow>
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
                        
                          {/* 4. PERMANENT DELETE (TRASH2 ICON) */}
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