// src/components/classroom/modal/ManageAvailabilityModal.tsx

import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter, 
  DialogClose 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Loader2, 
  Trash2, 
  PlusCircle, 
  CalendarDays, 
  CalendarX, 
  Clock,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import axios from "../../../../plugin/axios"; // Adjust path as necessary
// FIX: Update imports to use the centralized types file
import type { Room, AvailabilitySlot } from "../classroom"; 

type Props = {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
}

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// --- Helper function para i-convert ang oras ---
const formatTimeTo12Hour = (time24: string): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12; 
    return `${String(h12).padStart(2, '0')}:${minutes} ${ampm}`;
};

export function ManageAvailabilityModal({ isOpen, onClose, room }: Props) {
  const [availabilities, setAvailabilities] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAllSlots, setShowAllSlots] = useState(false);

  // Ang input sa form magpabilin nga 24-hour format (mas sayon i-handle)
  const defaultNewSlot = { day: "", start_time: "00:00", end_time: "00:00" };
  const [newSlotData, setNewSlotData] = useState(defaultNewSlot);

  useEffect(() => {
    const fetchAvailabilities = async () => {
      if (isOpen && room) {
        setIsLoading(true);
        setShowAllSlots(false);
        try {
          const token = localStorage.getItem('accessToken');
          if (!token) { toast.error("Authentication required."); return; }
          const response = await axios.get(`/rooms/${room.id}/availabilities`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          const sortedAvailabilities = (response.data.availabilities ||[]).sort((a: AvailabilitySlot, b: AvailabilitySlot) => 
                daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day) || a.start_time.localeCompare(b.start_time)
            );
          setAvailabilities(sortedAvailabilities);
        } catch (error) {
          toast.error("Failed to fetch availability.");
          console.error("Fetch availability error:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchAvailabilities();
  }, [isOpen, room]);

  const handleInputChange = (field: 'day' | 'start_time' | 'end_time', value: string) => {
    setNewSlotData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddNewSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;
    if (!newSlotData.day) {
        toast.error("Please select a day.");
        return;
    }
    if (newSlotData.start_time >= newSlotData.end_time) {
        toast.error("End time must be after start time.");
        return;
    }

    setIsProcessing(true);
    try {
      const token = localStorage.getItem('accessToken');
      const payload = { 
        availabilities: [{
            ...newSlotData,
            start_time: `${newSlotData.start_time}:00`,
            end_time: `${newSlotData.end_time}:00`,
        }] 
      };
      const response = await axios.post(`/rooms/${room.id}/availabilities`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const createdSlots: AvailabilitySlot[] = response.data.availabilities;
      setAvailabilities(prev => [...prev, ...createdSlots].sort((a, b) => daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day) || a.start_time.localeCompare(b.start_time)));
      setNewSlotData(defaultNewSlot);
      toast.success("New availability slot added!");
    } catch (error: any) {
        if (error.response?.status === 422) {
            const errors = error.response.data.errors;
            if (errors && errors['availabilities.0.day']) {
                toast.error(errors['availabilities.0.day'][0]);
            } else {
                toast.error("Invalid data provided. Please check the time format and day.");
            }
        } else {
            toast.error("Failed to add new slot. Please try again.");
            console.error("Add slot error:", error);
        }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSlot = async (availabilityId: number) => {
    setIsProcessing(true);
    try {
        const token = localStorage.getItem('accessToken');
        await axios.delete(`/availabilities/${availabilityId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setAvailabilities(prev => prev.filter(slot => slot.id !== availabilityId));
        toast.success("Availability slot deleted.");
    } catch (error) {
        toast.error("Failed to delete slot.");
    } finally {
        setIsProcessing(false);
    }
  };

  const visibleAvailabilities = showAllSlots ? availabilities : availabilities.slice(0, 5);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        
        {/* HEADER */}
        <div className="px-6 py-5 border-b bg-muted/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CalendarDays className="h-5 w-5 text-primary" />
              Manage Availability for {room?.roomNumber}
            </DialogTitle>
            <DialogDescription className="pt-1">
              Configure the operational hours and specific time slots when this room is available.
            </DialogDescription>
          </DialogHeader>
        </div>
        
        {/* SCROLLABLE BODY */}
        <div className="flex-1 px-6 py-4 space-y-8 overflow-y-auto min-h-0">
            
            {/* ADD NEW SLOT FORM */}
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <PlusCircle className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground">Add New Time Slot</h3>
                </div>
                
                <form onSubmit={handleAddNewSlot} className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="space-y-1.5 flex-1 w-full">
                        <Label htmlFor="day" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Day</Label>
                        <Select value={newSlotData.day} onValueChange={(value) => handleInputChange('day', value)}>
                            <SelectTrigger id="day" className="bg-background"><SelectValue placeholder="Select day" /></SelectTrigger>
                            <SelectContent>
                                {daysOfWeek.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5 flex-1 w-full">
                        <Label htmlFor="start_time" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Start Time</Label>
                        <div className="relative">
                           <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                           <Input id="start_time" type="time" className="pl-9 bg-background" value={newSlotData.start_time} onChange={(e) => handleInputChange('start_time', e.target.value)} required />
                        </div>
                    </div>

                    <div className="pb-2 hidden sm:block">
                        <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                    </div>

                    <div className="space-y-1.5 flex-1 w-full">
                        <Label htmlFor="end_time" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">End Time</Label>
                        <div className="relative">
                           <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                           <Input id="end_time" type="time" className="pl-9 bg-background" value={newSlotData.end_time} onChange={(e) => handleInputChange('end_time', e.target.value)} required />
                        </div>
                    </div>

                    <Button type="submit" disabled={isProcessing} className="w-full sm:w-auto h-10 px-6 shrink-0">
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Slot"}
                    </Button>
                </form>
            </div>

            {/* EXISTING SLOTS TABLE */}
            <div className="space-y-3">
                <h3 className="font-semibold px-1">Current Availability</h3>
                
                <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                            <p className="text-sm">Fetching availability data...</p>
                        </div>
                    ) : availabilities.length > 0 ? (
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-semibold ">Day</TableHead>
                                    <TableHead className="font-semibold ">Time Duration</TableHead>
                                    <TableHead className="text-right font-semibold ">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleAvailabilities.map(slot => (
                                    <TableRow key={slot.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-medium">{slot.day}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <span className="text-foreground">{formatTimeTo12Hour(slot.start_time)}</span>
                                                <ArrowRight className="h-3.5 w-3.5 opacity-50" />
                                                <span className="text-foreground">{formatTimeTo12Hour(slot.end_time)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleDeleteSlot(slot.id)} 
                                                disabled={isProcessing}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            {availabilities.length > 5 && (
                                <TableFooter className="bg-transparent border-t">
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={3} className="p-0">
                                            <Button 
                                                variant="ghost" 
                                                className="w-full rounded-none h-12 text-primary hover:text-primary hover:bg-primary/5"
                                                onClick={() => setShowAllSlots(prev => !prev)}
                                            >
                                                {showAllSlots ? 'Show less' : `View ${availabilities.length - 5} more slots`}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                            )}
                        </Table>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground bg-muted/10">
                            <CalendarX className="h-12 w-12 mb-3 text-muted-foreground/30" />
                            <p className="text-base font-medium text-foreground">No schedules set</p>
                            <p className="text-sm mt-1">This room doesn't have any availability slots yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* FOOTER */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/10 sm:justify-end">
            <DialogClose asChild>
                <Button type="button" variant="outline" className="min-w-[100px]">Close</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}