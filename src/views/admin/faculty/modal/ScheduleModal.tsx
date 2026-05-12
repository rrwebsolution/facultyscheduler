// src/components/modal/ScheduleModal.tsx

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import type { Faculty } from '../table/FacultyTable';
import { 
  PlusCircle, 
  Trash2, 
  Loader2, 
  CalendarDays, 
  ArrowRight, 
  Clock 
} from 'lucide-react';
import axios from "../../../../plugin/axios"; // Your configured axios instance

// Interface for a single time slot
interface TimeSlot {
  id: number;
  start: string;
  end: string;
}

// Props for the modal component
interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  faculty: Faculty | null;
}

// The days of the week to display
const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * A modal to view, set, and update the weekly availability for a faculty member.
 */
export function ScheduleModal({ isOpen, onClose, faculty }: ScheduleModalProps) {
  const [availability, setAvailability] = useState<Record<string, TimeSlot[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && faculty) {
      const fetchAvailability = async () => {
        setIsLoading(true);
        const token = localStorage.getItem('accessToken');
        if (!token) {
            toast.error("Authentication required.");
            setIsLoading(false);
            return;
        }
        try {
          const response = await axios.get(
            `/faculties/${faculty.id}/availability`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          setAvailability(response.data);
        } catch (error) {
          toast.error("Could not fetch the existing schedule for this faculty.");
          setAvailability({});
        } finally {
          setIsLoading(false);
        }
      };

      fetchAvailability();
    }
  }, [isOpen, faculty]);

  if (!faculty) return null;

  const addTimeSlot = (day: string) => {
    const newSlot: TimeSlot = {
      id: Date.now(),
      start: '',
      end: '',
    };
    setAvailability(prev => ({
      ...prev,
      [day]: [...(prev[day] ||[]), newSlot],
    }));
  };

  const updateTimeSlot = (day: string, slotId: number, field: 'start' | 'end', value: string) => {
    setAvailability(prev => {
      const updatedSlots = (prev[day] ||[]).map(slot =>
        slot.id === slotId ? { ...slot, [field]: value } : slot
      );
      return { ...prev, [day]: updatedSlots };
    });
  };

  const removeTimeSlot = (day: string, slotId: number) => {
    setAvailability(prev => ({
      ...prev,
      [day]: (prev[day] ||[]).filter(slot => slot.id !== slotId),
    }));
  };

  const handleSaveSchedule = async () => {
    for (const day in availability) {
      for (const slot of availability[day]) {
        if (!slot.start || !slot.end) {
          toast.error(`Please complete all time fields for ${day}.`);
          return;
        }
        if (slot.start >= slot.end) {
          toast.error(`On ${day}, the end time must be after the start time.`);
          return;
        }
      }
    }

    setIsSaving(true);
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
        toast.error("Authentication required. Please log in again.");
        setIsSaving(false);
        return;
    }

    try {
        const response = await axios.post(
            `/faculties/${faculty.id}/availability`,
            availability,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        toast.success(response.data.message || `Schedule updated successfully.`);
        onClose();
    } catch (error: any) {
        const errorMessage = error.response?.data?.message || "An unknown error occurred while saving.";
        toast.error(errorMessage);
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        
        {/* Header Section */}
        <div className="px-6 py-5 border-b bg-muted/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CalendarDays className="h-5 w-5 text-primary" />
              Set Availability for {faculty.name}
            </DialogTitle>
            <DialogDescription className="pt-1">
              Configure the working hours and available time slots for this faculty member.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Content Section */}
        <div className="flex-grow overflow-y-auto px-6 py-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Loading existing schedule...</p>
            </div>
          ) : (
            daysOfWeek.map((day) => {
              const hasSlots = availability[day] && availability[day].length > 0;
              
              return (
                <div 
                  key={day} 
                  className={`flex flex-col md:flex-row md:items-start gap-4 p-4 rounded-xl border transition-colors ${
                    hasSlots ? 'bg-card border-border shadow-sm' : 'bg-muted/20 border-dashed'
                  }`}
                >
                  {/* Day Label & Add Button */}
                  <div className="w-full md:w-1/3 flex flex-row md:flex-col justify-between md:justify-start items-center md:items-start gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground md:hidden" />
                      <h4 className="font-semibold text-foreground">{day}</h4>
                    </div>
                    <Button 
                      variant={hasSlots ? "outline" : "secondary"} 
                      size="sm" 
                      onClick={() => addTimeSlot(day)}
                      className="h-8 text-xs"
                    >
                      <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                      Add slot
                    </Button>
                  </div>

                  {/* Time Slots Area */}
                  <div className="w-full md:w-2/3 flex flex-col gap-2">
                    {hasSlots ? (
                      availability[day].map((slot) => (
                        <div 
                          key={slot.id} 
                          className="flex items-center gap-3 bg-muted/30 p-2.5 rounded-lg border border-border/50 transition-all hover:bg-muted/50"
                        >
                          <div className="flex-1">
                            <Input 
                              type="time" 
                              className="h-9 w-full bg-background" 
                              value={slot.start} 
                              onChange={(e) => updateTimeSlot(day, slot.id, 'start', e.target.value)} 
                            />
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1">
                            <Input 
                              type="time" 
                              className="h-9 w-full bg-background" 
                              value={slot.end} 
                              onChange={(e) => updateTimeSlot(day, slot.id, 'end', e.target.value)} 
                            />
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeTimeSlot(day, slot.id)} 
                            title="Remove slot"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center h-full min-h-[2.5rem]">
                        <span className="text-sm text-muted-foreground italic bg-background/50 px-3 py-1 rounded-md border border-border/50">
                          Unavailable
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Section */}
        <div className="px-6 py-4 border-t bg-muted/10">
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveSchedule} disabled={isSaving || isLoading} className="min-w-[120px]">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Schedule"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}