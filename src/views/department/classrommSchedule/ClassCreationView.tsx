// src/components/classroom/ClassCreationView.tsx

import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PenSquare, CheckCircle, X, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// --- ADJUSTED/MISSING TYPE DEFINITIONS (FIX) ---

// Assuming base types from your provided structure:
interface BaseSubject {
  id: string; // Changed to string for consistency with component subjectId
  subject_code: string;
  des_title: string;
  total_units: number;
  lec_units: number;
  lab_units: number;
}

// Subject used in this component (with original field aliases for code/title/units)
export interface ComponentSubject extends BaseSubject {
  code: string; // Alias for subject_code
  title: string; // Alias for des_title
  units: number; // Alias for total_units
}

// Extended ClassSchedule used in this component (with component-required fields)
export interface ComponentClassSchedule {
    id: string; // Assuming string ID for consistency with subjectId check
    subjectId: string; // Component is using 'subjectId'
    course: string; // Component is using 'course'
    yearLevel: string; // Component is using 'yearLevel'
    dayPair: 'MTh' | 'TF' | 'WS' | 'MWF' | 'TTH' | 'Sat' | string; // Component is using 'dayPair'
    time: string; // e.g., "08:30-10:00"
    instructor: string;
    roomId: string | null;
}

// Curriculum (The missing type)
export interface Curriculum {
    [course: string]: {
        [yearLevel: string]: ComponentSubject[];
    };
}

// AdminRoom (Minimal structure derived from original component)
export interface AdminRoom {
    id: number;
    roomNumber: string;
    type: string;
    capacity: number;
    status: number;
    created_at: string;
    updated_at: string;
}

// FacultyLoadEntry (Minimal structure derived from original component)
export interface FacultyLoadEntry {
    subject_id: number;
    room: {
        id: number;
        roomNumber: string;
        type: string;
    };
    day: string;
    start_time: string;
    end_time: string;
    type: 'LEC' | 'LAB';
}

// AdminSubject (Minimal structure derived from original component)
export interface AdminSubject {
  id: number;
  subject_code: string;
  des_title: string;
}


// --- PROPS INTERFACES ---
interface DayPairing {
  value: string;
  label: string;
}

interface ClassCreationProps {
  curriculum: Curriculum; // Fixed
  courses: string[];
  yearLevels: string[];
  schedules: ComponentClassSchedule[]; // Fixed to use ComponentClassSchedule
  dayPairings: DayPairing[];
  onCreateSchedule: (newSchedule: Omit<ComponentClassSchedule, 'id'>) => void; // Fixed to use ComponentClassSchedule
  onUpdateSchedule: (updatedSchedule: ComponentClassSchedule) => void;
  rooms?: AdminRoom[];
  facultyLoadingData?: FacultyLoadEntry[];
}


// --- MAIN COMPONENT ---
const ClassCreationView: React.FC<ClassCreationProps> = ({ curriculum, courses, yearLevels, schedules, dayPairings, onCreateSchedule, rooms = [], facultyLoadingData = [] }) => {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  // State for the scheduling modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [schedulingSubject, setSchedulingSubject] = useState<ComponentSubject | null>(null); // Fixed to use ComponentSubject

  const subjects = (selectedCourse && selectedYear && curriculum[selectedCourse]?.[selectedYear]) || [];
  const scheduledSubjectIds = new Set(
    schedules
      .filter((s: ComponentClassSchedule) => s.course === selectedCourse && s.yearLevel === selectedYear) // Fixed type
      .map((s: ComponentClassSchedule) => s.subjectId) // Fixed type, used subjectId
  );

  const handleOpenModal = (subject: ComponentSubject) => { // Fixed to use ComponentSubject
    setSchedulingSubject(subject);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSchedulingSubject(null);
    setIsModalOpen(false);
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-background">
        <div>
          <label className="text-sm font-medium">Program / Course</label>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger><SelectValue placeholder="Select a course..." /></SelectTrigger>
            <SelectContent>{courses.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Year Level</label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger><SelectValue placeholder="Select a year level..." /></SelectTrigger>
            <SelectContent>{yearLevels.map((y: string) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-bold">Curriculum Subjects</h3>
        <div className="space-y-3 mt-4">
          {subjects.map((subject: ComponentSubject) => { // Fixed to use ComponentSubject
            const isScheduled = scheduledSubjectIds.has(subject.id);
            return (
              <div key={subject.id} className={`p-4 rounded-lg border flex items-center justify-between ${isScheduled ? 'bg-green-50 border-green-200' : 'bg-card'}`}>
                <div>
                  <p className="font-bold">{subject.code} - {subject.title}</p>
                  <p className="text-sm text-muted-foreground">{subject.units} units</p>
                </div>
                {isScheduled ? (
                  <span className="flex items-center gap-2 text-sm font-semibold text-green-600"><CheckCircle size={16}/> Scheduled</span>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => handleOpenModal(subject)}>
                    <PenSquare size={14} className="mr-2"/> Schedule Class
                  </Button>
                )}
              </div>
            );
          })}
          {subjects.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Select a course and year level to see subjects.</p>
          )}
        </div>
      </div>

      {/* Render the modal */}
      <AnimatePresence>
        {isModalOpen && schedulingSubject && (
            <ScheduleClassModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                subject={schedulingSubject}
                course={selectedCourse}
                yearLevel={selectedYear}
                dayPairings={dayPairings}
                onCreateSchedule={onCreateSchedule}
                rooms={rooms}
                facultyLoadingData={facultyLoadingData}
            />
        )}
      </AnimatePresence>
    </div>
  );
};


// --- MODAL COMPONENT for scheduling a class ---
interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: ComponentSubject; // Fixed to use ComponentSubject
  course: string;
  yearLevel: string;
  dayPairings: DayPairing[];
  onCreateSchedule: (newSchedule: Omit<ComponentClassSchedule, 'id'>) => void; // Fixed to use ComponentClassSchedule
  rooms?: AdminRoom[];
  facultyLoadingData?: FacultyLoadEntry[];
}

const ScheduleClassModal: React.FC<ScheduleModalProps> = ({ onClose, subject, course, yearLevel, onCreateSchedule, facultyLoadingData = [], rooms = [] }) => {
  const [dayPair, setDayPair] = useState('');
  const [time, setTime] = useState('');
  const [instructor, setInstructor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [section, setSection] = useState('');
  const [selectedLectureRoomId, setSelectedLectureRoomId] = useState<string>('');
  const [selectedLabRoomId, setSelectedLabRoomId] = useState<string>('');

  const handleSubmit = async () => {
    // FIX: Extract start_time, end_time, and type from the 'time' value
    const [startTime, endTime ] = time.split('|');

    const needsLecture = subject.lec_units && subject.lec_units > 0;
    const needsLab = subject.lab_units && subject.lab_units > 0;

    if (!dayPair || !startTime || !endTime || !instructor || !section) {
      toast.error('Please fill all required fields (Day, Time, Instructor, Section).');
      return;
    }

    if (needsLecture && !selectedLectureRoomId) {
      toast.error('Please select a Lecture Room.');
      return;
    }

    if (needsLab && !selectedLabRoomId) {
      toast.error('Please select a Laboratory Room.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateSchedule({
        subjectId: subject.id, // Fixed: Used subject.id
        course,
        yearLevel,
        dayPair: dayPair as ComponentClassSchedule['dayPair'],
        time: `${startTime}-${endTime}`, // Format used by the main component's logic
        instructor,
        roomId: selectedLectureRoomId || selectedLabRoomId, // Use available room
        // Assuming other fields like faculty_id, type etc. are handled in the parent/API call
      });
      toast.success('Class scheduled (local state updated).');
      onClose();
    } catch (err) {
      toast.error('Failed to create schedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Availability calculations using admin facultyLoadingData ---
  const selectedSubjectLoads = React.useMemo(() => {
    if (!subject || !facultyLoadingData) return [] as FacultyLoadEntry[];
    return facultyLoadingData.filter(l => l.subject_id.toString() === subject.id.toString());
  }, [subject, facultyLoadingData]);

  // FIX: Filter rooms by type - Lecture and Laboratory
  const availableLectureRooms = React.useMemo(() => {
    return rooms.filter(r => r.type === 'Lecture').map(r => ({ ...r, id: r.id.toString() }));
  }, [rooms]);

  const availableLabRooms = React.useMemo(() => {
    return rooms.filter(r => r.type === 'Laboratory').map(r => ({ ...r, id: r.id.toString() }));
  }, [rooms]);

  const availableDays = React.useMemo(() => {
    if (!selectedLectureRoomId && !selectedLabRoomId) return [] as string[];
    // Find loads for the selected subject AND room(s)
    const selectedRoomIds = [selectedLectureRoomId, selectedLabRoomId].filter(Boolean);
    const roomLoads = selectedSubjectLoads.filter(l => selectedRoomIds.includes(l.room.id.toString()));
    return Array.from(new Set(roomLoads.map(l => l.day)));
  }, [selectedSubjectLoads, selectedLectureRoomId, selectedLabRoomId]);

  const formatTime12Hour = (time: string) => {
    if(!time) return "";
    const clean = time.length > 5 ? time.substring(0,5) : time;
    const [h, m] = clean.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${m < 10 ? '0'+m : m} ${ampm}`;
  };

  const availableTimeSlots = React.useMemo(() => {
    if ((!selectedLectureRoomId && !selectedLabRoomId) || !dayPair) return [] as any[];
    // Filter loads by selected room and dayPair (the day, e.g., 'Mon')
    const selectedRoomIds = [selectedLectureRoomId, selectedLabRoomId].filter(Boolean);
    const relevant = selectedSubjectLoads.filter(l => selectedRoomIds.includes(l.room.id.toString()) && l.day === dayPair);
    return relevant.map(load => ({ 
        value: `${load.start_time.substring(0,5)}|${load.end_time.substring(0,5)}|${load.type}`, 
        display: `${formatTime12Hour(load.start_time)} - ${formatTime12Hour(load.end_time)} (${load.type})`, 
        type: load.type 
    }));
  }, [selectedSubjectLoads, selectedLectureRoomId, selectedLabRoomId, dayPair]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-bold">Schedule Class</DialogTitle>
              {/* Use correct subject fields */}
              <p className="text-sm text-muted-foreground mt-1">{subject.subject_code} — {subject.des_title}</p>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon"><X /></Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="grid gap-5 py-4">
            <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Year Level <span className="text-red-500">*</span></Label>
              <Select value={String(yearLevel)} onValueChange={() => {}} disabled>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={String(yearLevel)}>{String(yearLevel)}</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Section <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <Input placeholder="Section name" value={section} onChange={(e) => setSection(e.target.value)} />
                <Button size="icon" variant="outline" title="Create New Section"><Plus /></Button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100"></div>

          <div className="space-y-2">
            <Label className="text-sm">Subject <span className="text-red-500">*</span></Label>
            <div className="p-3 rounded-md bg-slate-50 border border-slate-100">
              {/* Use subject_code and des_title */}
              <div className="font-semibold">{subject.subject_code} — {subject.des_title}</div>
              <div className="text-xs text-muted-foreground mt-1">Units: {subject.total_units ?? '--'}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Lecture Room {subject.lec_units && subject.lec_units > 0 ? <span className="text-red-500">*</span> : ''}</Label>
              <Select value={selectedLectureRoomId} onValueChange={(v) => setSelectedLectureRoomId(v)} disabled={availableLectureRooms.length === 0}>
                <SelectTrigger><SelectValue placeholder={availableLectureRooms.length ? 'Select lecture room' : 'No lecture rooms'} /></SelectTrigger>
                <SelectContent>
                  {availableLectureRooms.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.roomNumber} (Lecture)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Laboratory Room {subject.lab_units && subject.lab_units > 0 ? <span className="text-red-500">*</span> : ''}</Label>
              <Select value={selectedLabRoomId} onValueChange={(v) => setSelectedLabRoomId(v)} disabled={availableLabRooms.length === 0}>
                <SelectTrigger><SelectValue placeholder={availableLabRooms.length ? 'Select lab room' : 'No lab rooms'} /></SelectTrigger>
                <SelectContent>
                  {availableLabRooms.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.roomNumber} (Laboratory)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Day <span className="text-red-500">*</span></Label>
              <Select value={dayPair} onValueChange={setDayPair} disabled={availableDays.length === 0}>
                <SelectTrigger><SelectValue placeholder={availableDays.length ? 'Select day' : 'No available days'} /></SelectTrigger>
                <SelectContent>
                  {availableDays.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Time Slot <span className="text-red-500">*</span></Label>
              <Select value={time} onValueChange={setTime} disabled={availableTimeSlots.length === 0}>
                <SelectTrigger><SelectValue placeholder={availableTimeSlots.length ? 'Select Time Slot' : 'Select Room/Day'} /></SelectTrigger>
                <SelectContent>
                  {availableTimeSlots.map((slot, idx) => (
                    <SelectItem key={idx} value={slot.value}>{slot.display}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
              <Label className="text-sm">Instructor <span className="text-red-500">*</span></Label>
              <Input value={instructor} onChange={(e) => setInstructor(e.target.value)} placeholder="Enter instructor name..." />
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !dayPair || !time || !instructor || !section || 
              (subject.lec_units && subject.lec_units > 0 && !selectedLectureRoomId) || 
              (subject.lab_units && subject.lab_units > 0 && !selectedLabRoomId)}>
            {isSubmitting ? 'Saving...' : 'Confirm Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClassCreationView;