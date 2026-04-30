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

    const fetchPrograms = useCallback(async (showLoading = true, forceRefresh = false) => {
        if(showLoading) setIsLoading(true);
        const token = localStorage.getItem('accessToken');
        if (!token) { toast.error("Authentication required."); setIsLoading(false); navigate('/user-login'); return; }
        try {
            const response = await axios.get('/program', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: forceRefresh ? { _ts: Date.now() } : undefined
            });
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
        setRefreshSemestersKey(k => k + 1);
        await fetchPrograms(true, true);
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

    const curriculumStats = useMemo(() => {
        const activePrograms = filteredPrograms.filter(p => p.isActive).length;
        const inactivePrograms = filteredPrograms.length - activePrograms;
        const totalSubjects = filteredPrograms.reduce((sum, p) => sum + (Number(p.total_subjects) || 0), 0);
        const totalUnits = filteredPrograms.reduce((sum, p) => sum + (Number(p.total_units) || 0), 0);
        const totalSemesters = filteredPrograms.reduce((sum, p) => sum + Object.keys(p.semesters || {}).length, 0);
        const activeSemesters = filteredPrograms.reduce((sum, p) => {
            const sems = Object.values(p.semesters || {}) as Semester[];
            return sum + sems.filter(s => s?.isActive).length;
        }, 0);

        const bySubjects = [...filteredPrograms]
            .sort((a, b) => (b.total_subjects || 0) - (a.total_subjects || 0))
            .slice(0, 5);
        const byUnits = [...filteredPrograms]
            .sort((a, b) => (b.total_units || 0) - (a.total_units || 0))
            .slice(0, 5);

        const maxSubjects = Math.max(1, ...bySubjects.map(p => Number(p.total_subjects) || 0));
        const maxUnits = Math.max(1, ...byUnits.map(p => Number(p.total_units) || 0));

        return {
            activePrograms,
            inactivePrograms,
            totalSubjects,
            totalUnits,
            totalSemesters,
            activeSemesters,
            bySubjects,
            byUnits,
            maxSubjects,
            maxUnits,
        };
    }, [filteredPrograms]);

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
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Refresh data"
                    aria-label="Refresh data"
                >
                    <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    <span className="text-sm font-medium">Refresh data</span>
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

            <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Programs</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{filteredPrograms.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {curriculumStats.activePrograms} active, {curriculumStats.inactivePrograms} inactive
                    </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Subjects and Units</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{curriculumStats.totalSubjects} subjects</p>
                    <p className="text-xs text-muted-foreground mt-1">{curriculumStats.totalUnits} total units</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Semesters</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{curriculumStats.totalSemesters}</p>
                    <p className="text-xs text-muted-foreground mt-1">{curriculumStats.activeSemesters} currently active</p>
                </div>
            </div>

            <div className="mb-8 grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Top Programs by Subject Count</h3>
                    <div className="space-y-3">
                        {curriculumStats.bySubjects.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No data to display.</p>
                        ) : (
                            curriculumStats.bySubjects.map((program) => {
                                const value = Number(program.total_subjects) || 0;
                                const width = (value / curriculumStats.maxSubjects) * 100;
                                return (
                                    <div key={`subjects-${program.id}`}>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-medium text-foreground">{program.abbreviation || program.name}</span>
                                            <span className="text-muted-foreground">{value}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${width}%` }} />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Top Programs by Total Units</h3>
                    <div className="space-y-3">
                        {curriculumStats.byUnits.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No data to display.</p>
                        ) : (
                            curriculumStats.byUnits.map((program) => {
                                const value = Number(program.total_units) || 0;
                                const width = (value / curriculumStats.maxUnits) * 100;
                                return (
                                    <div key={`units-${program.id}`}>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-medium text-foreground">{program.abbreviation || program.name}</span>
                                            <span className="text-muted-foreground">{value}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${width}%` }} />
                                        </div>
                                    </div>
                                );
                            })
                        )}
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
