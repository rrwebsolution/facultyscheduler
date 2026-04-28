import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Calendar, Archive, Activity, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import axios from '../../../plugin/axios';

import { ProgramCard } from './components/ProgramCard';
import { SkeletonProgramCard } from './components/SkeletonProgramCard';
import { CurriculumDetailModal } from './modals/CurriculumDetailModal';
import { ProgramFormModal } from './modals/ProgramFormModal';
import { SemesterFormModal } from './modals/SemesterFormModal';
import { SemesterRenameModal } from './modals/SemesterRenameModal';
import { SubjectFormModal } from './modals/SubjectFormModal';
import { SemesterStatusModal } from './modals/SemesterStatusModal';
import type { Subject, Program, Semester } from './types';

function Curriculum({ readOnly = false }: { readOnly?: boolean }) {
    const [programs, setPrograms] = useState<Program[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [yearFilter, setYearFilter] = useState('All Years');
    const [statusFilter, setStatusFilter] = useState('Active');
    const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);

    const [isRefreshing, setIsRefreshing] = useState(false);

    const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
    const [editingProgram, setEditingProgram] = useState<Program | null>(null);
    
    const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
    const [isSemesterRenameModalOpen, setIsSemesterRenameModalOpen] = useState(false);
    const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
    
    const [refreshSemestersKey, setRefreshSemestersKey] = useState(0);
    
    const [updatedSubjectData, setUpdatedSubjectData] = useState<{ semesterName: string; subject: Subject } | null>(null);
    const [newSemesterData, setNewSemesterData] = useState<{ name: string; semester: Semester } | null>(null);
    const [updatedSemesterData, setUpdatedSemesterData] = useState<{ name: string; semester: Partial<Semester>; newName?: string } | null>(null);

    const [editingSubjectInfo, setEditingSubjectInfo] = useState<{ semester: string; semesterId?: number; subject: Subject | null } | null>(null);
    const [renamingSemester, setRenamingSemester] = useState<{ id: number | null; name: string | null }>({ id: null, name: null });

    const navigate = useNavigate();

    // --- 1. STATE FOR SEMESTER STATUS MODAL (Corrected) ---
    // This state object now holds all data required by the SemesterStatusModal.
    const [semesterStatusContext, setSemesterStatusContext] = useState<{
        name: string;
        semester: Semester;
        effectiveYear: string;
    } | null>(null);

    const fetchPrograms = useCallback(async (showLoading = true) => {
        if(showLoading) setIsLoading(true);
        const token = localStorage.getItem('accessToken');
        if (!token) { toast.error("Authentication required."); setIsLoading(false); navigate('/facultyscheduler/user-login'); return; }
        try {
            const response = await axios.get('/program', { headers: { 'Authorization': `Bearer ${token}` } });
            const programList: any[] = Array.isArray(response.data.programs) ? response.data.programs : Object.values(response.data.programs || {});
            
            // --- FIX IS APPLIED HERE ---
            const transformedPrograms: Program[] = programList.map((program: any) => ({
                id: program.id,
                // Use `|| ''` to provide a fallback empty string if the API value is null
                name: program.program_name || '', 
                abbreviation: program.abbreviation || '',
                // --- END OF FIX ---
                effectiveYear: `${program.year_from}-${program.year_to}`,
                total_subjects: program.total_subjects || 0, 
                total_units: program.total_units || 0,
                isActive: program.status === 0,
                semesters: program.semesters ? Object.entries(program.semesters).reduce((acc, [key, value]: [string, any]) => {
                    acc[key] = {
                        id: value.id,
                        subjects: (value.subjects || []).map((s: any) => ({
                            id: s.id, 
                            code: s.subject_code, 
                            name: s.des_title, 
                            unitsTotal: s.total_units, 
                            unitsLec: s.lec_units, 
                            unitsLab: s.lab_units,
                            hoursTotal: s.total_hrs, 
                            hoursLec: s.total_lec_hrs, 
                            hoursLab: s.total_lab_hrs, 
                            prerequisite: s.pre_requisite || ''
                        })),
                        isActive: value.status === 1,
                        startDate: value.start_date, 
                        endDate: value.end_date
                    };
                    return acc;
                }, {} as { [key: string]: Semester }) : {},
                subjects: program.subjects || {}
            }));
            setPrograms(transformedPrograms);
        } catch (error: any) { 
            toast.error("Failed to fetch programs."); 
        } finally { 
            if(showLoading) setIsLoading(false); 
        }
    }, [navigate]);

    useEffect(() => { fetchPrograms(true); }, [fetchPrograms]);
    useEffect(() => { if (updatedSubjectData) setUpdatedSubjectData(null); }, [updatedSubjectData]);
    useEffect(() => { if (newSemesterData) setNewSemesterData(null); }, [newSemesterData]);
    useEffect(() => { if (updatedSemesterData) setUpdatedSemesterData(null); }, [updatedSemesterData]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchPrograms(true);
        setIsRefreshing(false);
    };

    // --- 2. HANDLER FUNCTION (Corrected) ---
    // This now accepts `effectiveYear` and saves it to the state, triggering the modal.
    const handleOpenSemesterStatus = (semesterName: string, semesterData: Semester, effectiveYear: string) => {
        setSemesterStatusContext({
            name: semesterName,
            semester: semesterData,
            effectiveYear: effectiveYear
        });
    };

    const handleEditSemester = (semesterId: number, semesterName: string) => { setRenamingSemester({ id: semesterId, name: semesterName }); setIsSemesterRenameModalOpen(true); };
    const handleSaveProgram = () => { fetchPrograms(false); setIsProgramModalOpen(false); };
    const handleAddProgram = () => { setEditingProgram(null); setIsProgramModalOpen(true); };
    const handleEditProgram = (program: Program) => { setEditingProgram(program); setIsProgramModalOpen(true); };

    const [confirmDialog, setConfirmDialog] = useState<any>(null);
    const [confirmProcessing, setConfirmProcessing] = useState(false);

    const handleArchiveProgram = (programId: number) => {
        setConfirmDialog({
            open: true, title: 'Archive Program',
            description: 'This will move the program to the archives and make it inactive.',
            confirmText: 'Yes, archive it!', confirmVariant: 'destructive',
            onConfirm: async () => {
                const token = localStorage.getItem('accessToken');
                if (!token) { toast.error('Authentication required.'); return; }
                try {
                    const res = await axios.post(`/archive-program/${programId}`, {}, { headers: { 'Authorization': `Bearer ${token}` } });
                    toast.success(res.data?.message || 'Program archived successfully.');
                    await fetchPrograms(false);
                } catch (error) { toast.error('Failed to archive program.'); }
            }
        });
    };

    const handleRestoreProgram = (programId: number) => {
        setConfirmDialog({
            open: true, title: 'Restore Program',
            description: 'This will make the program active again.',
            confirmText: 'Yes, restore it!', confirmVariant: 'default',
            onConfirm: async () => {
                const token = localStorage.getItem('accessToken');
                if (!token) { toast.error('Authentication required.'); return; }
                try {
                    await axios.post(`/restore-program/${programId}`, {}, { headers: { 'Authorization': `Bearer ${token}` } });
                    toast.success('Program restored successfully.');
                    await fetchPrograms(false);
                } catch (error) { toast.error('Failed to restore program.'); }
            }
        });
    };

    const handleAddSubject = (semester: string, semesterId?: number) => { setEditingSubjectInfo({ semester, semesterId, subject: null }); setIsSubjectModalOpen(true); };
    const handleEditSubject = (semester: string, subject: Subject) => {
        const semesterId = selectedProgram?.semesters?.[semester]?.id;
        setEditingSubjectInfo({ semester, semesterId, subject }); setIsSubjectModalOpen(true);
    };
    
    const handleDeleteSubject = (_semesterName: string, subjectId?: number) => {
        if (!subjectId) { toast.error('Could not find subject ID to delete.'); return; }
        setConfirmDialog({
            open: true, title: 'Delete Subject',
            description: `This will permanently delete this subject. This action cannot be reverted.`,
            confirmText: 'Yes, delete it!', confirmVariant: 'destructive',
            onConfirm: async () => {
                const token = localStorage.getItem('accessToken');
                if (!token) { toast.error('Authentication required.'); return; }
                try {
                    await axios.delete(`/subjects/${subjectId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                    toast.success('Subject deleted successfully!');
                    setRefreshSemestersKey(k => k + 1);
                    await fetchPrograms(false);
                } catch (error) { toast.error('Failed to delete subject.'); }
            }
        });
    };

    const handleSubjectModalSave = async (semesterName: string, semesterIdParam: number | undefined, subjectData: Subject, isEditing: boolean) => {
        if (!selectedProgram) { toast.error('No program selected.'); return; }
        const token = localStorage.getItem('accessToken');
        if (!token) { toast.error('Authentication required.'); return; }
        try {
            const semesterId = semesterIdParam ?? selectedProgram?.semesters?.[semesterName]?.id;
            if (!isEditing && !semesterId) { toast.error('Semester ID not found.'); return; }
            const payload = {
                subject_code: subjectData.code, des_title: subjectData.name,
                total_units: subjectData.unitsTotal, lec_units: subjectData.unitsLec, lab_units: subjectData.unitsLab,
                total_hrs: subjectData.hoursTotal, total_lec_hrs: subjectData.hoursLec, total_lab_hrs: subjectData.hoursLab,
                pre_requisite: subjectData.prerequisite || null
            };
            let response;
            if (isEditing) {
                if (!subjectData.id) { toast.error('Subject ID missing for update.'); return; }
                response = await axios.put(`/subjects/${subjectData.id}`, payload, { headers: { 'Authorization': `Bearer ${token}` } });
                toast.success('Subject updated successfully.');
            } else {
                response = await axios.post(`/semesters/${semesterId}/subjects`, payload, { headers: { 'Authorization': `Bearer ${token}` } });
                toast.success('Subject added successfully.');
            }
            if (response.data?.subject) {
                const returnedSubject: Subject = {
                    id: response.data.subject.id, code: response.data.subject.subject_code, name: response.data.subject.des_title,
                    unitsTotal: response.data.subject.total_units, unitsLec: response.data.subject.lec_units, unitsLab: response.data.subject.lab_units,
                    hoursTotal: response.data.subject.total_hrs, hoursLec: response.data.subject.total_lec_hrs, hoursLab: response.data.subject.total_lab_hrs,
                    prerequisite: response.data.subject.pre_requisite || 'None'
                };
                setUpdatedSubjectData({ semesterName, subject: returnedSubject });
            } else { setRefreshSemestersKey(k => k + 1); }
            await fetchPrograms(false);
        } catch (error: any) { toast.error("The subject code has already been taken"); }
    };
    
    const handleBulkSemesterSave = (data: { name: string; semester: Semester }) => {
        setNewSemesterData(data);
        fetchPrograms(false);
    };

    const handleSemesterStatusUpdate = (semesterName: string, updatedData: Partial<Semester>) => {
        setUpdatedSemesterData({ name: semesterName, semester: updatedData });
        setSemesterStatusContext(null); // Close modal on success
    };

    const handleSemesterRename = (oldName: string, newName: string) => {
        setUpdatedSemesterData({ name: oldName, semester: {}, newName: newName });
    };

    const effectiveYears = useMemo(() => {
        const years = new Set(programs.map(p => p.effectiveYear));
        return ['All Years', ...Array.from(years).sort((a, b) => b.localeCompare(a))];
    }, [programs]);

    const filteredPrograms = useMemo(() => {
        return programs
            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.abbreviation.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(p => yearFilter === 'All Years' || p.effectiveYear === yearFilter)
            .filter(p => {
                if (statusFilter === 'All') return true;
                return statusFilter === 'Active' ? p.isActive : !p.isActive;
            });
    }, [programs, searchTerm, yearFilter, statusFilter]);

    return (
        <>
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Curriculum Management</h1>
                    <p className="text-muted-foreground mt-2">Manage academic programs, semesters, and their subjects.</p>
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Refresh data"
                    aria-label="Refresh data"
                >
                    <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
            </header>
            <div className="bg-card p-4 md:p-6 rounded-lg shadow-sm border border-border mb-8">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                        <Input type="text" placeholder="Search program..." className="pl-10 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <Select value={yearFilter} onValueChange={setYearFilter}><SelectTrigger className="w-full sm:w-auto md:w-[180px]"><Calendar className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Filter by A.Y." /></SelectTrigger><SelectContent>{effectiveYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent></Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-auto md:w-[180px]"><Activity className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Filter by Status" /></SelectTrigger><SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select>
                        {!readOnly && <Button onClick={handleAddProgram} className="w-full sm:w-auto"><Plus size={16} className="mr-2" /> Add Program</Button>}
                    </div>
                </div>
            </div>
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{Array.from({ length: 3 }).map((_, i) => (<SkeletonProgramCard key={i} />))}</div>
            ) : (
                <AnimatePresence>
                    {filteredPrograms.length > 0 ? (
                        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredPrograms.map((program, i) => (
                                <ProgramCard
                                    key={program.id}
                                    program={program}
                                    index={i}
                                    onEdit={readOnly ? () => {} : handleEditProgram}
                                    onArchive={readOnly ? () => {} : handleArchiveProgram}
                                    onRestore={readOnly ? () => {} : handleRestoreProgram}
                                    onManage={() => setSelectedProgram(program)}
                                    readOnly={readOnly}
                                />
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20 text-muted-foreground"><Archive size={56} className="mx-auto mb-4" /><h4 className="font-semibold text-xl text-foreground">No Programs Found</h4><p>Try adjusting your filters or add a new program.</p></motion.div>
                    )}
                </AnimatePresence>
            )}

            <ProgramFormModal isOpen={isProgramModalOpen} onClose={() => setIsProgramModalOpen(false)} onSave={handleSaveProgram} initialData={editingProgram} />
            {confirmDialog && (<Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(null)}><DialogContent><DialogHeader><DialogTitle>{confirmDialog.title}</DialogTitle>{confirmDialog.description && <DialogDescription>{confirmDialog.description}</DialogDescription>}</DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline" disabled={confirmProcessing}>Cancel</Button></DialogClose><Button onClick={async () => { if (!confirmDialog?.onConfirm) return; setConfirmProcessing(true); try { await confirmDialog.onConfirm(); } finally { setConfirmProcessing(false); setConfirmDialog(null); } }} disabled={confirmProcessing} variant={confirmDialog.confirmVariant}>{confirmProcessing ? 'Processing...' : (confirmDialog.confirmText || 'Confirm')}</Button></DialogFooter></DialogContent></Dialog>)}
                    {selectedProgram && (
                        <CurriculumDetailModal
                            isOpen={!!selectedProgram}
                            onClose={() => setSelectedProgram(null)}
                            program={selectedProgram}
                            onAddSemester={() => setIsSemesterModalOpen(true)}
                            onEditSemester={handleEditSemester}
                            onDeleteSemester={() => {}}
                            onAddSubject={handleAddSubject}
                            onEditSubject={handleEditSubject}
                            onDeleteSubject={handleDeleteSubject}
                            onSetSemesterStatus={handleOpenSemesterStatus}
                            refreshKey={refreshSemestersKey}
                            updatedSubjectData={updatedSubjectData}
                            newSemesterData={newSemesterData}
                            updatedSemesterData={updatedSemesterData}
                            readOnly={readOnly}
                        />
                    )}
            {!readOnly && <SemesterFormModal isOpen={isSemesterModalOpen} onClose={() => setIsSemesterModalOpen(false)} onSave={handleBulkSemesterSave} programId={selectedProgram ? selectedProgram.id : 0} />}
            {!readOnly && <SemesterRenameModal isOpen={isSemesterRenameModalOpen} onClose={() => setIsSemesterRenameModalOpen(false)} onSaveSuccess={handleSemesterRename} semesterId={renamingSemester.id} initialData={renamingSemester.name || ''} />}
            {!readOnly && editingSubjectInfo && (<SubjectFormModal isOpen={isSubjectModalOpen} onClose={() => setIsSubjectModalOpen(false)} onSave={(subjectData, isEditing) => handleSubjectModalSave(editingSubjectInfo.semester, editingSubjectInfo.semesterId, subjectData, isEditing)} initialData={editingSubjectInfo.subject} programId={selectedProgram?.id ?? 0} semesterName={editingSubjectInfo.semester || ''} semesterId={editingSubjectInfo.semesterId} />)}
            
            {/* --- 3. MODAL INVOCATION (Corrected) --- */}
            {/* This now uses the new context state and passes effectiveYear as a prop. */}
            {semesterStatusContext && (
                <SemesterStatusModal
                    isOpen={!!semesterStatusContext}
                    onClose={() => setSemesterStatusContext(null)}
                    onSaveSuccess={handleSemesterStatusUpdate}
                    semesterId={semesterStatusContext.semester?.id || null}
                    semesterName={semesterStatusContext.name || ''}
                    initialData={semesterStatusContext.semester || null}
                    effectiveYear={semesterStatusContext.effectiveYear}
                />
            )}
        </>
    );
}

export default Curriculum;