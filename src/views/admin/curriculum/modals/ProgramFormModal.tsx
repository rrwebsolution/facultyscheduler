import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { Program } from '../types';
import { toast } from 'sonner';
import axios from '../../../../plugin/axios';
import { isAxiosError } from 'axios';

type ProgramFormProps = { isOpen: boolean; onClose: () => void; onSave: (program: Program) => void; initialData: Program | null; };

const generateYearOptions = () => {
    // Start the dropdown options from 2015 up to currentYear + 5
    const startYear = 2015;
    const currentYear = new Date().getFullYear();
    const endYear = currentYear + 5;
    const years: string[] = [];
    for (let y = startYear; y <= endYear; y++) {
        years.push(String(y));
    }
    return years; // ascending order from 2015 -> endYear
};
const yearOptions = generateYearOptions();

export function ProgramFormModal({ isOpen, onClose, onSave, initialData }: ProgramFormProps) {
    const [name, setName] = useState('');
    const [abbreviation, setAbbreviation] = useState('');
    const [startYear, setStartYear] = useState('');
    const [endYear, setEndYear] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setAbbreviation(initialData.abbreviation);
            const [sYear = '', eYear = ''] = initialData.effectiveYear.split('-');
            setStartYear(sYear);
            setEndYear(eYear);
        } else {
            setName('');
            setAbbreviation('');
            const currentYear = new Date().getFullYear();
            setStartYear(String(currentYear));
            setEndYear(String(currentYear + 1));
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const programData = { program_name: name, abbreviation, year_from: startYear, year_to: endYear };
        const token = localStorage.getItem('accessToken');
        if (!token) { toast.error("Authentication required."); setIsLoading(false); return; }
        
        const headers = { 'Authorization': `Bearer ${token}` };

        try {
            const isEditing = !!initialData;
            const url = isEditing ? `/edit-program/${initialData.id}` : '/add-program';
            const method = isEditing ? 'post' : 'post';
            
            const response = await axios[method](url, programData, { headers });
            toast.success(response.data.message || 'Program saved successfully!');
            
            const savedProgramAPI = response.data.program;
            const subjectsObj = savedProgramAPI.subjects || (initialData as any)?.subjects || {};
            const totalSubjects = typeof savedProgramAPI.total_subjects === 'number' ? savedProgramAPI.total_subjects : Object.keys(subjectsObj).length;
            const totalUnits = typeof savedProgramAPI.total_units === 'number' ? savedProgramAPI.total_units : ((initialData as any)?.total_units ?? 0);

            const resultProgram: Program = {
                id: savedProgramAPI.id,
                name: savedProgramAPI.program_name,
                abbreviation: savedProgramAPI.abbreviation,
                effectiveYear: `${savedProgramAPI.year_from}-${savedProgramAPI.year_to}`,
                semesters: savedProgramAPI.semesters || (initialData as any)?.semesters || {},
                subjects: subjectsObj,
                total_subjects: totalSubjects,
                total_units: totalUnits,
                isActive: savedProgramAPI.isActive ?? savedProgramAPI.is_active ?? (initialData as any)?.isActive ?? true
            };
            onSave(resultProgram);
            onClose();
        } catch (error) {
            
            // FIX: I-check kung ang error kay AxiosError sa dili pa i-access ang .response
            if (isAxiosError(error) && error.response) {
                if (error.response.status === 401) {
                    toast.error("Your session has expired. Please log in again.");
                    return;
                }

                const responseData = error.response.data;
                const errors = responseData.errors;

                if (errors && typeof errors === 'object' && Object.keys(errors).length > 0) {
                    // Kuhaon ang pinakaunang error message gikan sa validation
                    const firstErrorKey = Object.keys(errors)[0];
                    const firstErrorMessage = errors[firstErrorKey]?.[0];
                    toast.error(firstErrorMessage || "A validation error occurred.");
                } else if (responseData && typeof responseData.message === 'string') {
                    // Kung general message lang ang naa sa API response
                    toast.error(responseData.message);
                } else {
                    toast.error("An unknown API error occurred.");
                }
            } else {
                // Kung dili kini Axios error (e.g., network issue)
                toast.error("Failed to connect to the server. Please check your connection.");
                console.error("Non-Axios error:", error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartYearChange = (selectedYear: string) => {
        setStartYear(selectedYear);
        setEndYear(String(Number(selectedYear) + 1));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader><DialogTitle>{initialData ? 'Edit Program' : 'Add New Program'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="progName">Program Name</Label>
                        <Input id="progName" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Bachelor of Science..." required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="progAbbr">Abbreviation</Label>
                        <Input id="progAbbr" value={abbreviation} onChange={e => setAbbreviation(e.target.value)} placeholder="e.g., BSIT" required />
                    </div>
                    <div className="space-y-2">
                        <Label>Effectivity A.Y.</Label>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                            <Select value={startYear} onValueChange={handleStartYearChange} required>
                                <SelectTrigger><SelectValue placeholder="Start Year" /></SelectTrigger>
                                <SelectContent>{yearOptions.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
                            </Select>
                            <span className="text-muted-foreground">-</span>
                            <Select value={endYear} onValueChange={setEndYear} required>
                                <SelectTrigger><SelectValue placeholder="End Year" /></SelectTrigger>
                                <SelectContent>{yearOptions.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className='pt-4'>
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : (initialData ? 'Save Changes' : 'Save Program')}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}