// src/pages/Curriculum/modals/SemesterFormModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableFooter } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Subject, Semester } from '../types';
import axios from '@/plugin/axios';

type SemesterFormProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave?: (data: { name: string; semester: Semester }) => void;
    programId: number;
};

type EditableSubject = Omit<Subject, 'unitsLec' | 'unitsLab' | 'hoursLec' | 'hoursLab'> & {
    unitsLec: number | '';
    unitsLab: number | '';
    hoursLec: number | '';
    hoursLab: number | '';
};

const initialSubjectState: EditableSubject = { 
    id: 0, code: '', name: '', 
    unitsTotal: 0, unitsLec: '', unitsLab: '', 
    hoursTotal: 0, hoursLec: '', hoursLab: '', 
    prerequisite: '' 
};

const yearLevelOptions = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const semesterOptions = ["1st Semester", "2nd Semester", "Summer"];

export function SemesterFormModal({ isOpen, onClose, onSave, programId }: SemesterFormProps) {
    const [yearLevel, setYearLevel] = useState('');
    const [semester, setSemester] = useState('');
    const [subjects, setSubjects] = useState<EditableSubject[]>([initialSubjectState]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const updatedSubjects = subjects.map(s => ({
            ...s,
            unitsTotal: (Number(s.unitsLec) || 0) + (Number(s.unitsLab) || 0),
            hoursTotal: (Number(s.hoursLec) || 0) + (Number(s.hoursLab) || 0)
        }));
        if (JSON.stringify(updatedSubjects) !== JSON.stringify(subjects)) {
            setSubjects(updatedSubjects);
        }
    }, [subjects]);

    const totals = useMemo(() => {
        return subjects.reduce((acc, subject) => {
            acc.totalUnits += Number(subject.unitsTotal) || 0;
            acc.totalLecUnits += Number(subject.unitsLec) || 0;
            acc.totalLabUnits += Number(subject.unitsLab) || 0;
            acc.totalHours += Number(subject.hoursTotal) || 0;
            acc.totalLecHours += Number(subject.hoursLec) || 0;
            acc.totalLabHours += Number(subject.hoursLab) || 0;
            return acc;
        }, { totalUnits: 0, totalLecUnits: 0, totalLabUnits: 0, totalHours: 0, totalLecHours: 0, totalLabHours: 0 });
    }, [subjects]);

    const handleAddSubjectRow = () => setSubjects(prev => [...prev, { ...initialSubjectState }]);
    const handleRemoveSubjectRow = (index: number) => setSubjects(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
    const handleSubjectChange = (index: number, field: keyof EditableSubject, value: string) => setSubjects(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!yearLevel || !semester) { toast.error("Please select a year level and semester."); return; }
        if (subjects.some(s => !s.code.trim() || !s.name.trim())) { toast.error("Please fill out all subject codes and titles."); return; }
        setIsSaving(true);
        try {
            const token = localStorage.getItem('accessToken');
            if (!token) { toast.error("Authentication required."); setIsSaving(false); return; }
            const payload = {
                program_id: programId, year_level: yearLevel, semester_level: semester,
                subjects: subjects.map(s => ({
                    subject_code: s.code, des_title: s.name, total_units: s.unitsTotal,
                    lec_units: Number(s.unitsLec) || 0, lab_units: Number(s.unitsLab) || 0,
                    total_hrs: s.hoursTotal, total_lec_hrs: Number(s.hoursLec) || 0,
                    total_lab_hrs: Number(s.hoursLab) || 0, pre_requisite: s.prerequisite || null
                }))
            };
            const response = await axios.post('/semester-with-subjects', payload, { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.status === 201 && response.data.semester) {
                toast.success("Semester and subjects added successfully!");
                const newApiSemester = response.data.semester;
                const semesterName = `${newApiSemester.year_level}, ${newApiSemester.semester_level}`;
                const newSemesterForUI: Semester = {
                    id: newApiSemester.id, isActive: newApiSemester.status === 1,
                    startDate: newApiSemester.start_date, endDate: newApiSemester.end_date,
                    subjects: (newApiSemester.subjects || []).map((sub: any): Subject => ({
                        id: sub.id, code: sub.subject_code, name: sub.des_title,
                        unitsTotal: sub.total_units, unitsLec: sub.lec_units, unitsLab: sub.lab_units,
                        hoursTotal: sub.total_hrs, hoursLec: sub.total_lec_hrs, hoursLab: sub.total_lab_hrs,
                        prerequisite: sub.pre_requisite || 'None'
                    }))
                };
                if (onSave) onSave({ name: semesterName, semester: newSemesterForUI });
                onClose();
            }
        } catch (error: any) { toast.error(error.response?.data?.error || 'Failed to save. Please try again.'); } 
        finally { setIsSaving(false); }
    };

    useEffect(() => {
        if (isOpen) {
            setYearLevel('');
            setSemester('');
            setSubjects([initialSubjectState]);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <TooltipProvider>
                <DialogContent className="max-w-7xl h-[95vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Add New Semester and Subjects</DialogTitle>
                        <DialogDescription>Add subjects in bulk for a new semester. Totals are calculated automatically.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="flex-grow flex flex-col min-h-0 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div className="space-y-2">
                                <Label htmlFor="yearLevel" className="text-base">Year Level</Label>
                                <Select value={yearLevel} onValueChange={setYearLevel} required><SelectTrigger id="yearLevel"><SelectValue placeholder="Select a year level" /></SelectTrigger><SelectContent>{yearLevelOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="semester" className="text-base">Semester</Label>
                                <Select value={semester} onValueChange={setSemester} required><SelectTrigger id="semester"><SelectValue placeholder="Select a semester" /></SelectTrigger><SelectContent>{semesterOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                            </div>
                        </div>
                        <div className="flex-grow overflow-auto border rounded-lg">
                            <Table className="min-w-[1200px]">
                                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead rowSpan={2} className="align-middle text-center border-r">Course Code</TableHead>
                                        <TableHead rowSpan={2} className="align-middle text-center border-r w-[350px]">Descriptive Title</TableHead>
                                        <TableHead colSpan={3} className="text-center border-r">Units</TableHead>
                                        <TableHead colSpan={3} className="text-center border-r">Hours per week</TableHead>
                                        <TableHead rowSpan={2} className="align-middle text-center border-r">Pre-requisite</TableHead>
                                        <TableHead rowSpan={2} className="align-middle w-[50px]"></TableHead>
                                    </TableRow>
                                    <TableRow>
                                        <TableHead className="text-center border-r">Total</TableHead><TableHead className="text-center border-r">Lec</TableHead><TableHead className="text-center border-r">Lab</TableHead>
                                        <TableHead className="text-center border-r">Total</TableHead><TableHead className="text-center border-r">Lec</TableHead><TableHead className="text-center border-r">Lab</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {subjects.map((s, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="w-[150px]"><Input required className='uppercase' placeholder="e.g. CS101" value={s.code} onChange={(e) => handleSubjectChange(index, 'code', e.target.value)} /></TableCell>
                                            <TableCell><Input required placeholder="e.g. Intro to Programming" value={s.name} onChange={(e) => handleSubjectChange(index, 'name', e.target.value)} /></TableCell>
                                            <TableCell><Tooltip><TooltipTrigger asChild><Input value={s.unitsTotal || ''} placeholder="Auto" readOnly className="text-center font-bold bg-muted/50 cursor-not-allowed" /></TooltipTrigger><TooltipContent>Auto-calculated</TooltipContent></Tooltip></TableCell>
                                            <TableCell><Input min='0' type="number" placeholder="0" value={s.unitsLec} onChange={(e) => handleSubjectChange(index, 'unitsLec', e.target.value)} className="text-center" /></TableCell>
                                            <TableCell><Input min='0' type="number" placeholder="0" value={s.unitsLab} onChange={(e) => handleSubjectChange(index, 'unitsLab', e.target.value)} className="text-center" /></TableCell>
                                            <TableCell><Tooltip><TooltipTrigger asChild><Input value={s.hoursTotal || ''} placeholder="Auto" readOnly className="text-center font-bold bg-muted/50 cursor-not-allowed" /></TooltipTrigger><TooltipContent>Auto-calculated</TooltipContent></Tooltip></TableCell>
                                            <TableCell><Input min='0' type="number" placeholder="0" value={s.hoursLec} onChange={(e) => handleSubjectChange(index, 'hoursLec', e.target.value)} className="text-center" /></TableCell>
                                            <TableCell><Input min='0' type="number" placeholder="0" value={s.hoursLab} onChange={(e) => handleSubjectChange(index, 'hoursLab', e.target.value)} className="text-center" /></TableCell>
                                            <TableCell className="w-[150px]"><Input placeholder="None" value={s.prerequisite} onChange={(e) => handleSubjectChange(index, 'prerequisite', e.target.value)} /></TableCell>
                                            <TableCell className="text-center"><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveSubjectRow(index)} disabled={subjects.length <= 1} className="text-destructive h-8 w-8 shrink-0 disabled:opacity-50"><Trash2 size={16} /></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter className="sticky bottom-0 bg-muted/80 backdrop-blur-sm">
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-right font-bold text-lg">SEMESTER TOTALS</TableCell>
                                        <TableCell className="text-center font-bold text-lg text-primary">{totals.totalUnits}</TableCell>
                                        <TableCell className="text-center font-semibold">{totals.totalLecUnits}</TableCell><TableCell className="text-center font-semibold">{totals.totalLabUnits}</TableCell>
                                        <TableCell className="text-center font-bold text-lg text-primary">{totals.totalHours}</TableCell>
                                        <TableCell className="text-center font-semibold">{totals.totalLecHours}</TableCell><TableCell className="text-center font-semibold">{totals.totalLabHours}</TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                        <Button type="button" variant="outline" onClick={handleAddSubjectRow} className="mt-4 w-full sm:w-auto"><Plus size={16} className="mr-2" /> Add Subject Row</Button>
                        <DialogFooter className="mt-5 pt-4 border-t">
                            <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSaving}>{isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Curriculum"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </TooltipProvider>
        </Dialog>
    );
}
