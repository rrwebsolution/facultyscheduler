import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { AlertCircle } from 'lucide-react';
import type { Subject } from '../types';
import { toast } from 'sonner'; // Opsyonal, pero mas nindot tan-awon kaysa alert()

// FIX 1: I-update ang type definition para sa onSave
type SubjectFormProps = {
   isOpen: boolean;
    onClose: () => void;
    // onSave may be async (returns a Promise) — the modal will await it and show a loading state
    onSave: (subjectData: Subject, isEditing: boolean) => Promise<void> | void;
    initialData: Subject | null;
    programId: number;
    semesterName: string;
    semesterId?: number;
};

type SubjectError = {
    unitError: string | null;
    hourError: string | null;
};

export function SubjectFormModal(props: SubjectFormProps) {
    const { isOpen, onClose, onSave, initialData } = props;
    // programId, semesterName, semesterId are available on props if needed: props.programId, props.semesterName, props.semesterId
    const [subject, setSubject] = useState<Subject>({
        id: 0,
        code: '', name: '', unitsTotal: 0, unitsLec: 0, unitsLab: 0,
        hoursTotal: 0, hoursLec: 0, hoursLab: 0, prerequisite: ''
    });
    const [errors, setErrors] = useState<SubjectError | null>(null);

    // Automatic calculation of total units and hours
    useEffect(() => {
        const newUnitsTotal = (Number(subject.unitsLec) || 0) + (Number(subject.unitsLab) || 0);
        const newHoursTotal = (Number(subject.hoursLec) || 0) + (Number(subject.hoursLab) || 0);
        setSubject(s => ({ ...s, unitsTotal: newUnitsTotal, hoursTotal: newHoursTotal }));
    }, [subject.unitsLec, subject.unitsLab, subject.hoursLec, subject.hoursLab]);

    // Validation logic (dili na kinahanglan, kay automatic na ang total)
    // Apan pwede magpabilin kung gusto nimo i-manual override ang Total
    useEffect(() => {
        const lecUnits = Number(subject.unitsLec) || 0;
        const labUnits = Number(subject.unitsLab) || 0;
        const totalUnits = Number(subject.unitsTotal) || 0;
        const unitError = (lecUnits + labUnits) > totalUnits ? "Lec + Lab units cannot exceed Total." : null;

        const lecHours = Number(subject.hoursLec) || 0;
        const labHours = Number(subject.hoursLab) || 0;
        const totalHours = Number(subject.hoursTotal) || 0;
        const hourError = (lecHours + labHours) > totalHours ? "Lec + Lab hours cannot exceed Total." : null;

        if (unitError || hourError) {
            setErrors({ unitError, hourError });
        } else {
            setErrors(null);
        }
    }, [subject]);

    useEffect(() => {
        if (isOpen) {
            setSubject(initialData || {
                id: 0,
                code: '', name: '', unitsTotal: 0, unitsLec: 0, unitsLab: 0,
                hoursTotal: 0, hoursLec: 0, hoursLab: 0, prerequisite: ''
            });
        }
    }, [isOpen, initialData]);

    const handleChange = (field: keyof Subject, value: string | number) => {
        setSubject(s => ({ ...s, [field]: value }));
    };
    const handleNumberChange = (field: keyof Subject, value: string) => {
        const numValue = Number(value);
        handleChange(field, numValue >= 0 ? numValue : 0);
    };

    // FIX 2: I-update ang handleSubmit para ipasa ang `isEditing` boolean
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (errors) {
            toast.error("Please fix the validation errors before saving.");
            return;
        }
        const isEditing = !!initialData;
        setIsSaving(true);
        try {
            // Await the parent save handler (may be async)
            await onSave(subject, isEditing);
            // Close modal on success
            onClose();
        } catch (err:any) {
            console.error('Subject save failed:', err);
            toast.error("The subject code has already been taken");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{initialData ? `Edit Subject: ${initialData.code}` : 'Add New Subject'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="py-4">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Course Code *</Label>
                                {/* Allow editing the course code even when editing an existing subject */}
                                <Input id="code" value={subject.code} onChange={e => handleChange('code', e.target.value)} placeholder="e.g. CS101" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="prerequisite">Pre-requisite</Label>
                                <Input id="prerequisite" value={subject.prerequisite} onChange={e => handleChange('prerequisite', e.target.value)} placeholder="e.g. CS100 or None" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Descriptive Title *</Label>
                            <Input id="name" value={subject.name} onChange={e => handleChange('name', e.target.value)} placeholder="e.g. Introduction to Programming" required />
                        </div>

                        <div className="space-y-2 pt-2">
                            <Label className="font-semibold">Unit Allocation</Label>
                            <div className={`grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30 ${errors?.unitError ? 'border-destructive' : ''}`}>
                                <div className="space-y-1">
                                    <Label htmlFor="unitsTotal">Total</Label>
                                    {/* Gi-disable kay automatic na ang computation */}
                                    <Input id="unitsTotal" type="number" value={subject.unitsTotal || ''} placeholder="Auto-calculated" disabled readOnly />
                                </div>
                                <div className="space-y-1"><Label htmlFor="unitsLec">Lec</Label><Input id="unitsLec" type="number" value={subject.unitsLec || ''} placeholder="0" onChange={e => handleNumberChange('unitsLec', e.target.value)} /></div>
                                <div className="space-y-1"><Label htmlFor="unitsLab">Lab</Label><Input id="unitsLab" type="number" value={subject.unitsLab || ''} placeholder="0" onChange={e => handleNumberChange('unitsLab', e.target.value)} /></div>
                            </div>
                            {errors?.unitError && <p className="text-destructive text-sm flex items-center gap-2 mt-2"><AlertCircle size={16}/>{errors.unitError}</p>}
                        </div>

                        <div className="space-y-2 pt-2">
                            <Label className="font-semibold">Hour Allocation</Label>
                            <div className={`grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30 ${errors?.hourError ? 'border-destructive' : ''}`}>
                                <div className="space-y-1">
                                    <Label htmlFor="hoursTotal">Total</Label>
                                    {/* Gi-disable kay automatic na ang computation */}
                                    <Input id="hoursTotal" type="number" value={subject.hoursTotal || ''} placeholder="Auto-calculated" disabled readOnly />
                                </div>
                                <div className="space-y-1"><Label htmlFor="hoursLec">Lec</Label><Input id="hoursLec" type="number" value={subject.hoursLec || ''} placeholder="0" onChange={e => handleNumberChange('hoursLec', e.target.value)} /></div>
                                <div className="space-y-1"><Label htmlFor="hoursLab">Lab</Label><Input id="hoursLab" type="number" value={subject.hoursLab || ''} placeholder="0" onChange={e => handleNumberChange('hoursLab', e.target.value)} /></div>
                            </div>
                            {errors?.hourError && <p className="text-destructive text-sm flex items-center gap-2 mt-2"><AlertCircle size={16}/>{errors.hourError}</p>}
                        </div>
                    </div>
                    <DialogFooter className="mt-8 pt-4 border-t">
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
                        <Button type="submit" disabled={!!errors || isSaving}>{isSaving ? 'Saving...' : (initialData ? 'Save Changes' : 'Save Subject')}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
