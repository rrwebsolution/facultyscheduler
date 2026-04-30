// src/components/classroom/RoomContainer.tsx

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import axios from "../../../plugin/axios"; // Adjust path as necessary
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchFacultyLoading as fetchFacultyLoadingAction,
  fetchRooms as fetchRoomsAction,
  fetchSubjects as fetchSubjectsAction,
  fetchFilteredSchedules as fetchFilteredSchedulesAction,
  clearSelectedScheduleFilter,
  setSelectedScheduleFilter,
} from "@/store/slices/dataCacheSlice";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Building2, CalendarDays } from "lucide-react";

// Importing UI and Component Dependencies
import RoomTable from "./table/RoomTable";
import { RoomFormModal } from "./modal/RoomFormModal";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { ManageAvailabilityModal } from "./modal/ManageAvailabilityModal";
import ClassSchedule from "./ClassSchedule";
import type { FacultyLoadEntry, Room, RoomFormData, ScheduleEntry, SectionEntry, Subject } from "./classroom"; // CORRECTED PATH


// --- MAIN COMPONENT ---
function RoomContainer({ mode = "both" }: { mode?: "both" | "classrooms" | "schedules" }) {
  const dispatch = useAppDispatch();
  const cachedRooms = useAppSelector((state) => state.dataCache.rooms);
  const cachedSubjects = useAppSelector((state) => state.dataCache.subjects);
  const cachedFacultyLoading = useAppSelector((state) => state.dataCache.facultyLoading);
  const roomsStatus = useAppSelector((state) => state.dataCache.roomsStatus);
  const subjectsStatus = useAppSelector((state) => state.dataCache.subjectsStatus);
  const facultyLoadingStatus = useAppSelector((state) => state.dataCache.facultyLoadingStatus);

  const schedules = useAppSelector((state) => state.dataCache.filteredSchedules) as ScheduleEntry[];
  const selectedScheduleFilter = useAppSelector((state) => state.dataCache.selectedScheduleFilter);
  const scheduleCacheByKey = useAppSelector((state) => state.dataCache.scheduleCacheByKey);
  const scheduleStatusByKey = useAppSelector((state) => state.dataCache.scheduleStatusByKey);

  const [savedSections, setSavedSections] = useState<SectionEntry[]>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('saved_class_sections');
        return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  // --- UI STATES ---
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; roomId: number | null }>({ open: false, roomId: null });

  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [selectedRoomForAvailability, setSelectedRoomForAvailability] = useState<Room | null>(null);
  const [activeTab, setActiveTab] = useState<"classrooms" | "schedules">(mode === "schedules" ? "schedules" : "classrooms");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const subjects = useMemo(() => {
    return (cachedSubjects || []).map((s: any) => ({
      id: s.id,
      subject_code: s.subject_code,
      des_title: s.des_title,
      code: s.subject_code,
      name: s.des_title,
      yearLevel: parseInt(s?.semester?.year_level) || 0,
      semester_id: s.semester_id,
      total_units: s.total_units,
      lec_units: s.lec_units,
      lab_units: s.lab_units,
    })) as Subject[];
  }, [cachedSubjects]);

  useEffect(() => {
    if (mode === "classrooms") setActiveTab("classrooms");
    if (mode === "schedules") setActiveTab("schedules");
  }, [mode]);

  const roomMonitoring = useMemo(() => {
    const rooms = (cachedRooms as Room[]) || [];
    const scheduleRows = schedules || [];

    const totalRooms = rooms.length;
    const activeRooms = rooms.filter((r) => Number(r.status) === 0).length;
    const totalSchedules = scheduleRows.length;
    const uniqueSections = new Set(scheduleRows.map((s) => `${s.year_level}-${s.section}-${s.program_id || 0}`)).size;
    const totalCapacity = rooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0);

    const timeToMinutes = (time: string) => {
      if (!time) return 0;
      const clean = String(time).slice(0, 5);
      const [h, m] = clean.split(":").map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
      return h * 60 + m;
    };

    const roomHoursMap = new Map<number, number>();
    for (const sch of scheduleRows) {
      const roomId = Number(sch?.faculty_loading?.room?.id || sch?.faculty_loading?.room_id || 0);
      if (!roomId) continue;
      const start = sch?.faculty_loading?.start_time || "";
      const end = sch?.faculty_loading?.end_time || "";
      const mins = Math.max(0, timeToMinutes(end) - timeToMinutes(start));
      const hours = mins / 60;
      roomHoursMap.set(roomId, (roomHoursMap.get(roomId) || 0) + hours);
    }

    const roomUsage = rooms.map((room) => ({
      roomId: room.id,
      roomName: room.roomNumber,
      usedHours: roomHoursMap.get(room.id) || 0,
      capacity: Number(room.capacity) || 0,
    }));
    const topUsedRooms = [...roomUsage].sort((a, b) => b.usedHours - a.usedHours).slice(0, 5);
    const maxUsedHours = Math.max(1, ...topUsedRooms.map((r) => r.usedHours));

    return {
      totalRooms,
      activeRooms,
      inactiveRooms: Math.max(0, totalRooms - activeRooms),
      totalSchedules,
      uniqueSections,
      totalCapacity,
      topUsedRooms,
      maxUsedHours,
      totalUsedHours: roomUsage.reduce((sum, r) => sum + r.usedHours, 0),
    };
  }, [cachedRooms, schedules]);

  // --- API CALLS (Logic remains the same) ---
  const fetchRooms = useCallback(async (force = false) => {
    try {
      await dispatch(fetchRoomsAction(force)).unwrap();
      return true;
    } catch (error) {
      toast.error("Failed to fetch rooms.");
      console.error("Fetch Rooms Error:", error);
      return false;
    }
  }, [dispatch]);

  const fetchSubjects = useCallback(async (force = false) => {
    try {
      await dispatch(fetchSubjectsAction(force)).unwrap();
      return true;
    } catch (error) {
      toast.error("Failed to fetch subjects.");
      console.error("Fetch Subjects Error:", error);
      return false;
    }
  }, [dispatch]);

  const fetchFacultyLoading = useCallback(async (force = false) => {
    try {
      await dispatch(fetchFacultyLoadingAction(force)).unwrap();
      return true;
    } catch (error) {
      console.error("Fetch Faculty Loading Error:", error);
      return false;
    }
  }, [dispatch]);

  const fetchSchedules = useCallback(async (
    year: number | null = null,
    section: string | null = null,
    programId: number | null = null,
    forceRefresh = false
  ): Promise<{ success: boolean; data: ScheduleEntry[]; message?: string }> => {
    const key = `${programId ?? "none"}|${year ?? "none"}|${(section || "").trim() || "all"}`;
    const cached = scheduleCacheByKey[key] || [];
    const status = scheduleStatusByKey[key];

    if (!forceRefresh && status === "succeeded") {
      dispatch(setSelectedScheduleFilter({ year, section, programId }));
      return { success: true, data: cached, message: "Loaded from cache." };
    }

    try {
      const action = await dispatch(
        fetchFilteredSchedulesAction({ year, section, programId, forceRefresh })
      );

      if (fetchFilteredSchedulesAction.fulfilled.match(action)) {
        const payload = action.payload;
        return {
          success: true,
          data: payload.data || [],
          message: payload.message,
        };
      }

      // Condition callback aborted duplicate request: return cached data quietly.
      if (fetchFilteredSchedulesAction.rejected.match(action) && action.meta.condition) {
        dispatch(setSelectedScheduleFilter({ year, section, programId }));
        return { success: true, data: cached, message: "Loaded from cache." };
      }

      return {
        success: false,
        data: [],
        message: action.error?.message || "Failed to fetch schedules.",
      };
    } catch (error: any) {
      return { success: false, data: [], message: error?.message || "An unexpected error occurred." };
    }
  }, [dispatch, scheduleCacheByKey, scheduleStatusByKey]);

  const handleFilterApply = useCallback(async (year: number, section: string, programId: number) => {
    const result = await fetchSchedules(year, section, programId); 
    return result;
  }, [fetchSchedules]);

  const handleClearScheduleFilter = useCallback(() => {
    dispatch(clearSelectedScheduleFilter());
  }, [dispatch]);


  // Initial Data Load: Fetch all required data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const loadTasks: Promise<any>[] = [];
        const hasSelectedProgram = !!selectedScheduleFilter?.programId;
        if (hasSelectedProgram) {
          loadTasks.push(
            fetchSchedules(
              selectedScheduleFilter.year ?? null,
              selectedScheduleFilter.section ?? null,
              selectedScheduleFilter.programId ?? null
            )
          );
        }
        if (roomsStatus === "idle") loadTasks.push(fetchRooms());
        if (subjectsStatus === "idle") loadTasks.push(fetchSubjects());
        if (facultyLoadingStatus === "idle") loadTasks.push(fetchFacultyLoading());

        const results = await Promise.all(loadTasks);
        if (hasSelectedProgram) {
          const scheduleResult = results[0];
          if (!scheduleResult?.success && scheduleResult?.message) {
            toast.error(scheduleResult.message);
          }
        }

      } catch (error) {
        console.error("An error occurred during data fetching:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [fetchRooms, fetchSubjects, fetchFacultyLoading, fetchSchedules, roomsStatus, subjectsStatus, facultyLoadingStatus, selectedScheduleFilter]);


  // --- ROOM CRUD HANDLERS (Logic remains the same) ---
  const handleSaveRoom = async (data: RoomFormData) => { 
    const token = localStorage.getItem('accessToken');
    if (!token) { toast.error("Authentication required."); return; }
    
    try {
      if (editingRoom) {
        // Edit
        const response = await axios.put(`/rooms/${editingRoom.id}`, data, { headers: { 'Authorization': `Bearer ${token}` } });
        toast.success(response.data.message || 'Room updated successfully!');
      } else {
        // Add
        const roomResponse = await axios.post('/rooms', data, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        toast.success(roomResponse.data.message || 'Room created successfully!');

        const newRoomId = roomResponse.data.room?.id;

        if (newRoomId) {
          const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const timeSlots = [
              { start_time: '07:00:00', end_time: '12:00:00' },
              { start_time: '13:00:00', end_time: '21:00:00' },
          ];
          
          const availabilitiesPayload = {
            availabilities: days.flatMap(day => 
              timeSlots.map(slot => ({ day, ...slot }))
            )
          };
          
          await axios.post(`/rooms/${newRoomId}/availabilities`, availabilitiesPayload, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          toast.success('Default availability has been set.');
        }
      }

      setIsModalOpen(false);
      setEditingRoom(null);
      fetchRooms();

    } catch (error: any) {
      if (error.response?.status === 422) {
        const validationErrors = error.response.data.errors;
        for (const key in validationErrors) { 
          toast.error(`Validation Error: ${validationErrors[key][0]}`); 
          return; 
        }
      } else {
        toast.error("An error occurred. Please try again.");
      }
    }
  };

  const handleAddRoom = () => { setEditingRoom(null); setIsModalOpen(true); };
  const handleEditRoom = (room: Room) => { setEditingRoom(room); setIsModalOpen(true); };
  const openDeleteConfirm = (roomId: number) => { setConfirmDialog({ open: true, roomId: roomId }); };
  const handleManageAvailability = (room: Room) => { setSelectedRoomForAvailability(room); setIsAvailabilityModalOpen(true); };
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setIsLoading(true);
    try {
      const loadTasks: Promise<any>[] = [fetchRooms(true), fetchSubjects(true), fetchFacultyLoading(true)];
      if (activeTab === "schedules" && selectedScheduleFilter?.programId) {
        loadTasks.push(
          fetchSchedules(
            selectedScheduleFilter.year ?? null,
            selectedScheduleFilter.section ?? null,
            selectedScheduleFilter.programId ?? null,
            true
          )
        );
      }
      await Promise.all(loadTasks);
      toast.success("Data refreshed.");
    } catch (error) {
      console.error("Manual refresh error:", error);
      toast.error("Failed to refresh data.");
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  /**
   * *** IMPLEMENTATION: handleDeleteRoom for permanent deletion ***
   */
  const handleDeleteRoom = async () => {
    if (confirmDialog.roomId === null) return;
    const token = localStorage.getItem('accessToken');
    if (!token) { toast.error("Authentication required."); return; }
    try {
      const response = await axios.delete(`/rooms/${confirmDialog.roomId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      
      // Updated success message to reflect the backend deletion of room and availabilities
      toast.success(response.data.message || 'Room and related availability slots deleted successfully!');
      
      fetchRooms();
    } catch (error) {
      // General error message in case of foreign key failure from other tables (e.g., Faculty Loading)
      toast.error("Failed to delete room. It might be currently in use for class schedules.");
    } finally {
      setConfirmDialog({ open: false, roomId: null });
    }
  };


  // --- SCHEDULE HANDLER (MODIFIED: Added programId) ---
  const handleAddScheduleEntry = async (newEntry: { 
      yearLevel: number; 
      section: string;
      subjectId: number; 
      roomId: number; 
      day: string;
      startTime: string;
      endTime: string;
      type: 'LEC' | 'LAB' | string;
      programId: number; // <--- NEW PARAMETER
  }): Promise<boolean> => {
    try {
        const token = localStorage.getItem('accessToken');
        
        // Prepare payload for backend (Laravel)
        const payload = {
          subject_id: newEntry.subjectId, 
          room_id: newEntry.roomId, 
          day: newEntry.day, 
          start_time: newEntry.startTime, 
          end_time: newEntry.endTime,   
          section: newEntry.section,
          year_level: newEntry.yearLevel,
          type: newEntry.type,
          program_id: newEntry.programId, // <--- NEW FIELD IN PAYLOAD
        };

        const response = await axios.post('/create-schedule', payload, {
             headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data.success) {
             toast.success(response.data.message);
             
             // 1. Update Saved Sections (for Dropdown Persistence)
             // NOTE: A more robust solution for savedSections might involve saving programId here too.
             const sectionExists = savedSections.some(
                s => s.yearLevel === newEntry.yearLevel && s.section === newEntry.section
             );

             if (!sectionExists) {
                 const updatedSections = [...savedSections, { yearLevel: newEntry.yearLevel, section: newEntry.section }];
                 updatedSections.sort((a, b) => a.section.localeCompare(b.section));
                 
                 setSavedSections(updatedSections);
                 localStorage.setItem('saved_class_sections', JSON.stringify(updatedSections));
             }
             
             // 2. Refresh Schedules to show the new entry (optional, depends on app design)
             await handleFilterApply(newEntry.yearLevel, newEntry.section, newEntry.programId); // <--- Pass programId

             return true; // Success
        }
        return false;

    } catch (error: any) {
        if (error.response && error.response.data) {
            toast.error(error.response.data.message); // Show backend conflict message
        } else {
            toast.error("Failed to save schedule.");
        }
        return false; // Failure
    }
  };

  // --- RENDER ---
  const token = localStorage.getItem('accessToken');
  
  return (
    <>
      <main>
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Classroom & Schedule Management</h1>
            <p className="text-muted-foreground mt-2">Monitor classroom utilization and view schedules by year level.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh data"
              aria-label="Refresh data"
              className="inline-flex items-center gap-2"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              <span className="text-sm font-medium">Refresh data</span>
            </Button>
            {(mode !== "schedules" && activeTab === "classrooms") && (
              <Button onClick={handleAddRoom} className="shadow-md hover:shadow-lg transition-all">
                <Plus size={16} className="mr-2" />
                Add Room
              </Button>
            )}
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={(value) => mode === "both" && setActiveTab(value as "classrooms" | "schedules")}>
          {mode === "both" && (
            <TabsList className="mb-6 grid w-full grid-cols-1 sm:grid-cols-2 h-auto gap-3 bg-transparent p-0">
              <TabsTrigger
                value="classrooms"
                className="h-auto rounded-xl border border-border bg-card p-4 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50/60"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                    <Building2 size={16} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-foreground">Classroom List</p>
                    <p className="text-xs text-muted-foreground">Manage rooms and availability</p>
                  </div>
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="schedules"
                className="h-auto rounded-xl border border-border bg-card p-4 data-[state=active]:border-indigo-500 data-[state=active]:bg-indigo-50/60"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
                    <CalendarDays size={16} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-foreground">Class Schedules</p>
                    <p className="text-xs text-muted-foreground">View and assign class schedules</p>
                  </div>
                </div>
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="classrooms">
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Rooms</p>
                <p className="text-2xl font-bold text-foreground mt-1">{roomMonitoring.totalRooms}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {roomMonitoring.activeRooms} active, {roomMonitoring.inactiveRooms} inactive
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Seat Capacity</p>
                <p className="text-2xl font-bold text-foreground mt-1">{roomMonitoring.totalCapacity}</p>
                <p className="text-xs text-muted-foreground mt-1">Combined room capacity</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Schedules</p>
                <p className="text-2xl font-bold text-foreground mt-1">{roomMonitoring.totalSchedules}</p>
                <p className="text-xs text-muted-foreground mt-1">Linked schedules across rooms</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Sections Covered</p>
                <p className="text-2xl font-bold text-foreground mt-1">{roomMonitoring.uniqueSections}</p>
                <p className="text-xs text-muted-foreground mt-1">Unique section allocations</p>
              </div>
            </div>
            <RoomTable
              roomsData={cachedRooms as Room[]}
              scheduleData={schedules}
              subjectsData={subjects}
              onEdit={handleEditRoom}
              onDelete={openDeleteConfirm}
              onManageAvailability={handleManageAvailability} 
              isLoading={isLoading} 
            />
          </TabsContent>

          <TabsContent value="schedules">
            <div className="mb-6 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Top Rooms by Scheduled Hours</h3>
                <p className="text-xs text-muted-foreground">Total used time: {roomMonitoring.totalUsedHours.toFixed(1)}h</p>
              </div>
              <div className="space-y-3">
                {roomMonitoring.topUsedRooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No schedule data to visualize yet.</p>
                ) : (
                  roomMonitoring.topUsedRooms.map((room) => {
                    const width = (room.usedHours / roomMonitoring.maxUsedHours) * 100;
                    return (
                      <div key={room.roomId}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-foreground">{room.roomName}</span>
                          <span className="text-muted-foreground">{room.usedHours.toFixed(1)}h</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <ClassSchedule
              scheduleData={schedules}
              subjectsData={subjects}
              roomsData={cachedRooms as Room[]}
              facultyLoadingData={cachedFacultyLoading as FacultyLoadEntry[]} 
              savedSections={savedSections}
              initialSelectedFilter={selectedScheduleFilter}
              onClearFilter={handleClearScheduleFilter}
              onAddSchedule={handleAddScheduleEntry}
              onFilterApply={handleFilterApply}
              authToken={token} // Pass the token read from localStorage
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* --- MODALS --- */}
      <RoomFormModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingRoom(null); }}
        onSave={handleSaveRoom}
        initialData={editingRoom}
      />

      <Dialog open={confirmDialog.open} onOpenChange={() => setConfirmDialog({ open: false, roomId: null })}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>This action cannot be undone. This will permanently delete the room and all its saved availability data.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button variant="destructive" onClick={handleDeleteRoom}>Yes, delete it</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <ManageAvailabilityModal
        isOpen={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        room={selectedRoomForAvailability}
      />
    </>
  );
}

export default RoomContainer;
