// src/pages/Curriculum/modals/CurriculumDetailModal.tsx

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer"; // Assuming you have a Drawer component from your UI library
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Edit, Trash2, Plus, SlidersHorizontal, CalendarDays, BookOpenCheck, RefreshCw } from 'lucide-react';
import { type Program, type Subject, type Semester, professionalElectives } from '../types';
import type { JSX } from "react";
import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from '../../../../plugin/axios';
import { toast } from 'sonner';


interface CurriculumDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    program: Program;
    onAddSemester: () => void;
    onEditSemester: (semesterId: number, semesterName: string) => void;
    onDeleteSemester: (semesterName: string) => void;
    onAddSubject: (semester: string, semesterId?: number) => void;
    onEditSubject: (semester: string, subject: Subject) => void;
    onDeleteSubject: (semesterName: string, subjectId?: number) => void;
    onSetSemesterStatus: (semesterName: string, semesterData: Semester, effectiveYear: string) => void;
    refreshKey?: number;
    updatedSubjectData?: { semesterName: string; subject: Subject } | null;
    newSemesterData?: { name: string; semester: Semester } | null;
    updatedSemesterData?: { name: string; semester: Partial<Semester>; newName?: string } | null;
    readOnly?: boolean;
}

const sortSemesterKeys = (a: string, b: string): number => {
    const [yearA, semA] = a.split(', ');
    const [yearB, semB] = b.split(', ');
    const yearNumA = parseInt(yearA);
    const yearNumB = parseInt(yearB);
    if (yearNumA !== yearNumB) return yearNumA - yearNumB;
    if (semA?.includes('Summer')) return 1;
    if (semB?.includes('Summer')) return -1;
    if (semA?.includes('1st')) return -1;
    if (semB?.includes('1st')) return 1;
    return 0;
};

const semestersCacheStore: Record<number, { data: { [key: string]: Semester }; refreshKey?: number }> = {};

export function CurriculumDetailModal({
    isOpen, onClose, program, onAddSemester, onEditSemester,
    onAddSubject, onEditSubject, onDeleteSubject, onSetSemesterStatus,
    refreshKey, updatedSubjectData, newSemesterData, updatedSemesterData, readOnly = false
}: CurriculumDetailModalProps): JSX.Element {
    const [semesters, setSemesters] = useState<{ [key: string]: Semester }>({});
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedElective, setSelectedElective] = useState<Subject | null>(null);

    const handleViewElectives = (subject: Subject) => {
        setSelectedElective(subject);
        setIsDrawerOpen(true);
    };

    const fetchSemestersFromApi = useCallback(async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
        const token = localStorage.getItem('accessToken');
        if (!token) {
            toast.error('Authentication required.');
            if (showLoader) setIsLoading(false);
            return;
        }
        try {
            const response = await axios.get('/semester-with-subjects', {
                params: { program_id: program.id, _ts: Date.now() },
                headers: { Authorization: `Bearer ${token}` }
            });
            const apiSemesters: any[] = Array.isArray(response.data.semesters) ? response.data.semesters : [];
            const programSemesters: { [key: string]: Semester } = {};
            apiSemesters.forEach(apiSem => {
                const key = `${apiSem.year_level}, ${apiSem.semester_level}`;
                programSemesters[key] = {
                    id: apiSem.id,
                    subjects: (apiSem.subjects || []).map((sub: any): Subject => ({
                        id: sub.id, code: sub.subject_code, name: sub.des_title,
                        unitsTotal: sub.total_units, unitsLec: sub.lec_units, unitsLab: sub.lab_units,
                        hoursTotal: sub.total_hrs, hoursLec: sub.total_lec_hrs, hoursLab: sub.total_lab_hrs,
                        prerequisite: sub.pre_requisite || 'None'
                    })),
                    isActive: apiSem.status === 1,
                    startDate: apiSem.start_date, endDate: apiSem.end_date
                };
            });
            setSemesters(programSemesters);
            semestersCacheStore[program.id] = { data: programSemesters, refreshKey };
        } catch (error) {
            toast.error('Failed to load semester data.');
        } finally {
            if (showLoader) setIsLoading(false);
        }
    }, [program.id, refreshKey]);

    const handleRefreshData = async () => {
        setIsRefreshing(true);
        await fetchSemestersFromApi(true);
        setIsRefreshing(false);
    };

    useEffect(() => {
        if (!isOpen) return;
        const cached = semestersCacheStore[program.id];
        const hasProgramSemesters = Object.keys(program.semesters || {}).length > 0;
        const shouldForceRefresh = cached && cached.refreshKey !== refreshKey;

        if (cached && !shouldForceRefresh) {
            setSemesters(cached.data);
            return;
        }

        const sourceSemesters = hasProgramSemesters ? program.semesters : {};
        if (hasProgramSemesters && !shouldForceRefresh) {
            setSemesters(sourceSemesters);
            semestersCacheStore[program.id] = { data: sourceSemesters, refreshKey };
            setIsLoading(false);
            return;
        }

        fetchSemestersFromApi(true);
    }, [isOpen, program.id, program.semesters, refreshKey, fetchSemestersFromApi]);

    useEffect(() => {
        if (updatedSubjectData) {
            const { semesterName, subject } = updatedSubjectData;
            setSemesters(prev => {
                const newSemesters = JSON.parse(JSON.stringify(prev));
                const targetSemester = newSemesters[semesterName];
                if (targetSemester) {
                    const subjectIndex = targetSemester.subjects.findIndex((s: Subject) => s.id === subject.id);
                    if (subjectIndex !== -1) targetSemester.subjects[subjectIndex] = subject;
                    else targetSemester.subjects.push(subject);
                }
                semestersCacheStore[program.id] = { data: newSemesters, refreshKey };
                return newSemesters;
            });
        }
    }, [program.id, refreshKey, updatedSubjectData]);

    useEffect(() => {
        if (newSemesterData) {
            const { name, semester } = newSemesterData;
            setSemesters(prev => {
                const next = { ...prev, [name]: semester };
                semestersCacheStore[program.id] = { data: next, refreshKey };
                return next;
            });
        }
    }, [newSemesterData, program.id, refreshKey]);
    
    useEffect(() => {
        if (updatedSemesterData) {
            const { name, semester, newName } = updatedSemesterData;
            setSemesters(prev => {
                const newSemesters = { ...prev };
                const targetSemester = newSemesters[name];
                if (!targetSemester) return prev;
                if (newName && newName !== name) {
                    newSemesters[newName] = { ...targetSemester, ...semester };
                    delete newSemesters[name];
                } else {
                    newSemesters[name] = { ...targetSemester, ...semester };
                }
                semestersCacheStore[program.id] = { data: newSemesters, refreshKey };
                return newSemesters;
            });
        }
    }, [program.id, refreshKey, updatedSemesterData]);

    const sortedSemesters = useMemo(() => {
        return Object.entries(semesters).sort(([keyA], [keyB]) => sortSemesterKeys(keyA, keyB));
    }, [semesters]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-7xl h-[95vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-4 bg-muted/50 border-b rounded-t-lg">
                    <DialogTitle className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">{program.name}<span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">{program.abbreviation}</span></DialogTitle>
                    <DialogDescription className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />Academic Year of Effectivity: {program.effectiveYear}</DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto px-6 py-2 space-y-6">
                    <div className="flex justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={handleRefreshData} disabled={isRefreshing || isLoading}>
                            <RefreshCw size={14} className={`mr-2 ${(isRefreshing || isLoading) ? 'animate-spin' : ''}`} />
                            Refresh Data
                        </Button>
                    </div>
                    {isLoading ? ( <div className="space-y-6">{[1, 2].map(i => (<div key={i} className="bg-card border rounded-xl p-4 animate-pulse"><div className="h-6 bg-muted/60 rounded w-1/3 mb-4" /><div className="h-48 bg-muted/30 rounded" /></div>))}</div>) 
                    : sortedSemesters.length === 0 ? (<div className="text-center py-20 text-muted-foreground flex flex-col items-center justify-center h-full"><Layers size={56} className="mx-auto mb-4" /><h4 className="font-semibold text-xl text-foreground">No Semesters Found</h4><p className="max-w-md mx-auto mt-2 text-sm">This curriculum is empty.</p></div>) 
                    : (sortedSemesters.map(([semesterName, semesterData]) => (
                            <div key={semesterName} className={`group/semester border rounded-xl overflow-hidden shadow-sm transition-opacity ${!semesterData.isActive ? 'opacity-70 bg-muted/20' : 'bg-card'}`}>
                                <div className="flex justify-between items-center p-4 bg-muted/30 border-b">
                                    <div className="flex items-center gap-3"><h4 className="text-lg font-semibold text-foreground">{semesterName}</h4><Badge variant={semesterData.isActive ? 'default' : 'destructive'}>{semesterData.isActive ? 'Active' : 'Inactive'}</Badge></div>
                                    {!readOnly && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover/semester:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" title="Set Status & Dates" className="h-8 w-8 text-muted-foreground" onClick={() => onSetSemesterStatus(semesterName, semesterData, program.effectiveYear)}><SlidersHorizontal size={16}/></Button>
                                            <Button variant="ghost" size="icon" title="Rename Semester" className="h-8 w-8 text-green-500 hover:text-green-500" onClick={() => onEditSemester(semesterData.id, semesterName)}><Edit size={16}/></Button>
                                        </div>
                                    )}
                                </div>
                                <div className="overflow-x-auto">
                                    <Table className="min-w-[1200px]">
                                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                            <TableRow>
                                                <TableHead rowSpan={2} className="align-middle text-center border-r">Course Code</TableHead>
                                                <TableHead rowSpan={2} className="align-middle text-center border-r w-[350px]">Descriptive Title</TableHead>
                                                <TableHead colSpan={3} className="text-center border-r">Units</TableHead>
                                                <TableHead colSpan={3} className="text-center border-r">Hours per week</TableHead>
                                                <TableHead rowSpan={2} className="align-middle text-center border-r">Pre-requisite</TableHead>
                                                <TableHead rowSpan={2} className="align-middle w-[100px] text-center">Actions</TableHead>
                                            </TableRow>
                                            <TableRow>
                                                <TableHead className="text-center border-r">Total</TableHead><TableHead className="text-center border-r">Lec</TableHead><TableHead className="text-center border-r">Lab</TableHead>
                                                <TableHead className="text-center border-r">Total</TableHead><TableHead className="text-center border-r">Lec</TableHead><TableHead className="text-center border-r">Lab</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {semesterData.subjects.length > 0 ? semesterData.subjects.map((subject) => {
                                                const isProfessionalElective = subject.name.toUpperCase().startsWith("PROFESSIONAL ELECTIVE") && subject.code.toUpperCase().startsWith("ELECTIVE");
                                                return (
                                                    <TableRow key={subject.id || subject.code}>
                                                        <TableCell className="w-[150px] font-semibold uppercase text-center">{subject.code}</TableCell>
                                                        <TableCell>
                                                            {isProfessionalElective ? (
                                                                <Button 
                                                                    variant="link" 
                                                                    className="text-left p-0 h-auto font-normal text-base text-blue-600 hover:underline" 
                                                                    onClick={() => handleViewElectives(subject)}
                                                                >
                                                                    {subject.name}
                                                                </Button>
                                                            ) : (
                                                                subject.name
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold text-primary">{subject.unitsTotal}</TableCell>
                                                        <TableCell className="text-center">{subject.unitsLec}</TableCell>
                                                        <TableCell className="text-center">{subject.unitsLab}</TableCell>
                                                        <TableCell className="text-center font-bold text-primary">{subject.hoursTotal}</TableCell>
                                                        <TableCell className="text-center">{subject.hoursLec}</TableCell>
                                                        <TableCell className="text-center">{subject.hoursLab}</TableCell>
                                                        <TableCell className="w-[150px] text-center">{subject.prerequisite}</TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex justify-end items-center gap-1">
                                                                {!readOnly && <>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-500" onClick={() => onEditSubject(semesterName, subject)}><Edit size={16} /></Button>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDeleteSubject(semesterName, subject.id)}><Trash2 size={16} /></Button>
                                                                </>}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }) : (<TableRow><TableCell colSpan={10} className="text-center h-24 text-muted-foreground">No subjects added for this semester.</TableCell></TableRow>)}
                                        </TableBody>
                                        <TableFooter className="sticky bottom-0 bg-muted/80 backdrop-blur-sm">
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-right font-bold text-lg">SEMESTER TOTALS</TableCell>
                                                <TableCell className="text-center font-bold text-lg text-primary">{semesterData.subjects.reduce((t, s) => t + (Number(s.unitsTotal) || 0), 0)}</TableCell>
                                                <TableCell className="text-center font-semibold">{semesterData.subjects.reduce((t, s) => t + (Number(s.unitsLec) || 0), 0)}</TableCell>
                                                <TableCell className="text-center font-semibold">{semesterData.subjects.reduce((t, s) => t + (Number(s.unitsLab) || 0), 0)}</TableCell>
                                                <TableCell className="text-center font-bold text-lg text-primary">{semesterData.subjects.reduce((t, s) => t + (Number(s.hoursTotal) || 0), 0)}</TableCell>
                                                <TableCell className="text-center font-semibold">{semesterData.subjects.reduce((t, s) => t + (Number(s.hoursLec) || 0), 0)}</TableCell>
                                                <TableCell className="text-center font-semibold">{semesterData.subjects.reduce((t, s) => t + (Number(s.hoursLab) || 0), 0)}</TableCell>
                                                <TableCell colSpan={2}></TableCell>
                                            </TableRow>
                                        </TableFooter>
                                    </Table>
                                </div>
                                {!readOnly && <div className="p-2 border-t"><Button onClick={() => onAddSubject(semesterName, semesterData.id)} variant="link"><Plus size={16} className="mr-1"/> Add Subject</Button></div>}
                            </div>
                        ))
                    )}
                </div>
                <DialogFooter className="mt-auto p-6 bg-gray-50 border-t rounded-b-lg flex flex-col md:flex-row md:justify-end gap-2">
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={onAddSemester} className="flex items-center gap-2"><Layers size={16}/> Add Year/Semester</Button>
                </DialogFooter>
            </DialogContent>

            {/* REDESIGNED DRAWER FOR ELECTIVES VIEW (NON-CLICKABLE) */}
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <DrawerContent className="p-0">
                    {/* Sticky, attractive header */}
                    <DrawerHeader className="text-left px-5 py-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-20">
                        <div className="flex items-start justify-between">
                            <div>
                                <DrawerTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                                    <BookOpenCheck className="h-5 w-5 text-primary" />
                                    {selectedElective?.name || "Elective Subjects"}
                                </DrawerTitle>
                                <DrawerDescription className="text-sm mt-1 text-muted-foreground">
                                    List of subjects that can be taken for this elective slot. (Read-only view)
                                </DrawerDescription>
                            </div>
                            <Badge variant="outline" className="text-xs font-semibold py-1 px-3 mt-1 text-primary border-primary">
                                {professionalElectives.length} Options
                            </Badge>
                        </div>
                        {/* Current placeholder subject details */}
                        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                            <span className="font-medium text-primary">Placeholder Code:</span> {selectedElective?.code}
                            <span className="ml-4 font-medium text-primary">Units Required:</span> {selectedElective?.unitsTotal}
                        </div>
                    </DrawerHeader>

                    <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
                        <Table className="min-w-[720px]">
                            {/* Improved Table Header with better styling */}
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow className="[&>th]:py-3 [&>th]:text-xs [&>th]:text-white [&>th]:font-bold [&>th]:uppercase">
                                    <TableHead className="w-[120px]">Code</TableHead>
                                    <TableHead className="w-[400px]">Descriptive Title</TableHead>
                                    <TableHead className="text-right w-[80px]">Units</TableHead>
                                    <TableHead className="w-[180px]">Instructional Type</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {professionalElectives.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            No elective subjects available.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    professionalElectives.map((subject) => (
                                        <TableRow
                                            key={subject.code}
                                            className="transition-colors [&>td]:py-3 text-sm" 
                                        >
                                            <TableCell className="font-semibold text-foreground">{subject.code}</TableCell>
                                            <TableCell title={subject.name} className="font-medium text-wrap">
                                                {subject.name}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums font-bold text-primary">{subject.units}</TableCell>
                                            <TableCell>
                                                {/* Using Badge for instructional type for better visual appeal */}
                                                <Badge variant="secondary" className="capitalize text-xs font-medium">
                                                    {subject.instructional.replace('integrated lec/lab', 'Lec/Lab').replace('lecture only', 'Lecture')}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                            {/* Improved Table Footer with sticky blur effect */}
                            {professionalElectives.length > 0 && (
                                <TableFooter className="bg-muted/60 sticky bottom-0 z-10 backdrop-blur-sm">
                                    <TableRow className="[&>td]:py-3">
                                        <TableCell colSpan={2} className="text-right font-bold text-base">
                                            Total Units Available
                                        </TableCell>
                                        <TableCell className="text-right font-extrabold text-xl text-primary">
                                            {professionalElectives.reduce((t, s) => t + (Number(s.units) || 0), 0)}
                                        </TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableFooter>
                            )}
                        </Table>
                    </div>

                    {/* Sticky Footer */}
                    <DrawerFooter className="px-5 py-3 border-t bg-background/95 backdrop-blur-sm sticky bottom-0 z-20 flex justify-center">
                        <DrawerClose asChild>
                            <Button variant="outline" size="sm" className="w-full max-w-xs">Close View</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </Dialog>
    );
}
