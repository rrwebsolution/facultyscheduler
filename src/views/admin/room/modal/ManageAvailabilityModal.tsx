// src/components/classroom/modal/ManageAvailabilityModal.tsx

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2, PlusCircle, ServerCrash } from "lucide-react";
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
          
          const sortedAvailabilities = (response.data.availabilities || []).sort((a: AvailabilitySlot, b: AvailabilitySlot) => 
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Manage Availability for {room?.roomNumber}</DialogTitle>
          <DialogDescription>
            View, add, or delete the available time slots for this room.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6 overflow-y-auto min-h-0 pr-1">
            <div>
                <h3 className="font-semibold mb-2">Existing Slots</h3>
                <div className="border rounded-lg">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-24 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fetching data...</div>
                    ) : availabilities.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Day</TableHead>
                                    <TableHead>Start Time</TableHead>
                                    <TableHead>End Time</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleAvailabilities.map(slot => (
                                    <TableRow key={slot.id}>
                                        <TableCell>{slot.day}</TableCell>
                                        <TableCell>{formatTimeTo12Hour(slot.start_time)}</TableCell>
                                        <TableCell>{formatTimeTo12Hour(slot.end_time)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteSlot(slot.id)} disabled={isProcessing}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            {availabilities.length > 5 && (
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center">
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                className="text-sm font-medium text-primary cursor-pointer hover:underline"
                                                onClick={() => setShowAllSlots(prev => !prev)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setShowAllSlots(prev => !prev);
                                                    }
                                                }}
                                            >
                                                {showAllSlots ? 'Show less slots' : `See more slots (${availabilities.length - 5} more)`}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                            )}
                        </Table>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
                            <ServerCrash className="h-6 w-6 mb-2" />
                            <p>No availability slots found for this room.</p>
                        </div>
                    )}
                </div>
            </div>

            <div>
                <h3 className="font-semibold mb-2">Add New Slot</h3>
                <form onSubmit={handleAddNewSlot} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end p-4 border rounded-lg bg-muted/50">
                    <div className="space-y-1">
                        <Label htmlFor="day">Day</Label>
                        <Select value={newSlotData.day} onValueChange={(value) => handleInputChange('day', value)}>
                            <SelectTrigger id="day"><SelectValue placeholder="Select day" /></SelectTrigger>
                            <SelectContent>
                                {daysOfWeek.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="start_time">Start Time</Label>
                        <Input id="start_time" type="time" value={newSlotData.start_time} onChange={(e) => handleInputChange('start_time', e.target.value)} required />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="end_time">End Time</Label>
                        <Input id="end_time" type="time" value={newSlotData.end_time} onChange={(e) => handleInputChange('end_time', e.target.value)} required />
                    </div>
                    <Button type="submit" disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Add Slot
                    </Button>
                </form>
            </div>
        </div>

        <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline">Close</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
