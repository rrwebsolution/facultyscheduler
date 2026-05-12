// src/components/classroom/modal/ViewScheduleModal.tsx
import React, { useEffect, useState } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight, MapPin, CalendarX, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Room } from '../classroom';
import axios from '../../../../plugin/axios';

interface RoomScheduleEntry {
    schedule_id: number;
    year_level: number;
    section: string;
    subject_code: string;
    des_title: string;
    type: string;
    day: string;
    start_time: string;
    end_time: string;
    faculty_name: string;
}

type Props = {
    isOpen: boolean;
    onClose: () => void;
    room: Room | null;
    scheduleData?: unknown; // kept for backwards-compat, not used
}

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const formatTime12Hour = (time: string): string => {
    if (!time) return "";
    const clean = time.length > 5 ? time.substring(0, 5) : time;
    const [hourStr, minuteStr] = clean.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    const minuteFormatted = minute < 10 ? `0${minute}` : minute;
    return `${hour}:${minuteFormatted} ${ampm}`;
};

const TYPE_COLORS: Record<string, string> = {
    LEC: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    LAB: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
};

const ViewScheduleModal: React.FC<Props> = ({ isOpen, onClose, room }) => {
    const [schedules, setSchedules] = useState<RoomScheduleEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !room) return;

        const fetchRoomSchedules = async () => {
            setIsLoading(true);
            setError(null);
            setSchedules([]);
            try {
                const token = localStorage.getItem('accessToken');
                const response = await axios.get(`/schedules/room/${room.id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (response.data.success) {
                    const sorted = (response.data.schedules as RoomScheduleEntry[]).sort((a, b) => {
                        const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
                        if (dayDiff !== 0) return dayDiff;
                        return a.start_time.localeCompare(b.start_time);
                    });
                    setSchedules(sorted);
                } else {
                    setError(response.data.message || 'Failed to load schedules.');
                }
            } catch (err: any) {
                setError(err?.response?.data?.message || 'An error occurred while fetching schedules.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchRoomSchedules();
    }, [isOpen, room]);

    if (!room) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
                
                {/* HEADER */}
                <div className="px-6 py-5 border-b bg-muted/10">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-lg">
                                <MapPin className="h-5 w-5 text-primary" />
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="flex items-center gap-3 text-xl">
                                    Schedule for {room.roomNumber}
                                    <Badge variant="outline" className="bg-background text-[10px] tracking-wider uppercase font-semibold text-muted-foreground border-muted-foreground/30">
                                        {room.type} Room
                                    </Badge>
                                </DialogTitle>
                                <DialogDescription>
                                    Overview of all classes currently assigned to this room.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div className="flex-1 px-6 py-6 overflow-y-auto min-h-0 bg-muted/5">
                    <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                        {isLoading ? (
                            <div className="p-6 space-y-4">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-4 border-b border-border/50 pb-4 last:border-0 last:pb-0">
                                        <Skeleton className="h-5 w-24 shrink-0" />
                                        <Skeleton className="h-5 w-40 shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-3 w-1/2" />
                                        </div>
                                        <Skeleton className="h-5 w-24 shrink-0" />
                                        <Skeleton className="h-6 w-16 rounded-full shrink-0" />
                                    </div>
                                ))}
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center h-48 text-destructive bg-destructive/5">
                                <Info className="h-8 w-8 mb-2 opacity-80" />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        ) : schedules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-muted/10">
                                <CalendarX className="h-12 w-12 mb-4 text-muted-foreground/30" />
                                <p className="text-base font-semibold text-foreground">No Scheduled Classes</p>
                                <p className="text-sm mt-1 text-muted-foreground/80">This room is completely free.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-[120px] font-semibold">Day</TableHead>
                                        <TableHead className="w-[200px] font-semibold">Time</TableHead>
                                        <TableHead className="font-semibold">Subject</TableHead>
                                        <TableHead className="w-[120px] font-semibold">Section</TableHead>
                                        <TableHead className="font-semibold">Faculty</TableHead>
                                        <TableHead className="text-center font-semibold w-[100px]">Type</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {schedules.map((sch) => (
                                        <TableRow key={sch.schedule_id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-semibold text-foreground">
                                                {sch.day}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                                    <span className="font-medium text-foreground">{formatTime12Hour(sch.start_time)}</span>
                                                    <ArrowRight className="w-3.5 h-3.5 opacity-50" />
                                                    <span className="font-medium text-foreground">{formatTime12Hour(sch.end_time)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground text-sm tracking-tight">{sch.subject_code}</span>
                                                    <span className="text-xs text-muted-foreground line-clamp-1" title={sch.des_title}>
                                                        {sch.des_title}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-xs font-medium border">
                                                    {sch.year_level}Y - {sch.section}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm font-medium text-foreground">{sch.faculty_name}</span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge
                                                    className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider border ${TYPE_COLORS[sch.type?.toUpperCase()] ?? 'bg-slate-500/10 text-slate-600 border-slate-500/20'}`}
                                                    variant="outline"
                                                >
                                                    {sch.type}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>

                {/* FOOTER */}
                <DialogFooter className="px-6 py-4 border-t bg-muted/10 sm:justify-between items-center gap-4">
                    <p className="text-xs text-muted-foreground w-full sm:w-auto text-center sm:text-left">
                        Showing total of {schedules.length} class{schedules.length !== 1 ? 'es' : ''}.
                    </p>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" className="min-w-[100px]">Close</Button>
                    </DialogClose>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    );
};

export default ViewScheduleModal;