import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, Search, RefreshCw, Users, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchFaculties as fetchFacultiesAction, fetchSubjects as fetchSubjectsAction } from '@/store/slices/dataCacheSlice';
import { toast } from 'sonner';

import { FacultyCard } from './components/card/FacultyCard';
import { AssignSubjectDialog } from './components/AssignSubjectDialog';
import { ViewAssignedSubjectsDialog } from './components/ViewAssignedSubjectsDialog';
import { FacultyCardSkeleton } from './components/card/FacultyCardSkeleton';
import type { Faculty, Subject } from './type';

function MainFacultyLoading() {
    const dispatch = useAppDispatch();
    const faculties = useAppSelector((state) => state.dataCache.faculties) as Faculty[];
    const allSubjects = useAppSelector((state) => state.dataCache.subjects) as Subject[];
    const facultiesStatus = useAppSelector((state) => state.dataCache.facultiesStatus);
    const subjectsStatus = useAppSelector((state) => state.dataCache.subjectsStatus);
    
    const[subjectsForModal, setSubjectsForModal] = useState<Subject[]>([]);
    const [facultyQuery, setFacultyQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // State for Assign Subject Dialog
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const[selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);

    // New State for View Assigned Subjects Dialog
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const[facultyForViewModal, setFacultyForViewModal] = useState<Faculty | null>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const token = localStorage.getItem('accessToken');
                if (!token) {
                    toast.error('You must be logged in.');
                    return;
                }
                const tasks: Promise<unknown>[] =[];
                if (facultiesStatus === 'idle') tasks.push(dispatch(fetchFacultiesAction(false)).unwrap());
                if (subjectsStatus === 'idle') tasks.push(dispatch(fetchSubjectsAction(false)).unwrap());
                if (tasks.length > 0) await Promise.all(tasks);

            } catch (error) {
                console.error("Error fetching data:", error);
                toast.error('Failed to retrieve data from the server.');
            }
        };
        fetchInitialData();
    }, [dispatch, facultiesStatus, subjectsStatus]);

    const isLoading = facultiesStatus === 'loading' || subjectsStatus === 'loading' || (facultiesStatus === 'idle' && subjectsStatus === 'idle');
    const isBusy = isLoading || isRefreshing;

    const filteredFaculties = faculties.filter(f =>
        f.name.toLowerCase().includes(facultyQuery.toLowerCase()) ||
        f.expertise.some(e => e.toLowerCase().includes(facultyQuery.toLowerCase()))
    );
    const totalFaculty = faculties.length;
    const totalVisible = filteredFaculties.length;

    const handleOpenAssignModal = (faculty: Faculty) => {
        const facultyExpertise = faculty.expertise
            .map(e => (e || '').toLowerCase().trim())
            .filter(Boolean)
            .flatMap(e => e.split(/\s+|[,;/]+/).map(t => t.trim()))
            .filter(t => t.length > 2);

        if (!facultyExpertise.length) {
            setSubjectsForModal([]);
        } else {
            const relevantSubjects = allSubjects.filter(subject => {
                const subjectText = `${(subject as any).des_title ?? ''} ${(subject as any).subject_code ?? ''} ${(subject as any).pre_requisite ?? ''}`.toLowerCase();
                return facultyExpertise.some(exp => subjectText.includes(exp));
            });
            setSubjectsForModal(relevantSubjects);
        }
        setSelectedFaculty(faculty);
        setIsAssignModalOpen(true);
    };

    const handleCloseAssignModal = () => {
        setIsAssignModalOpen(false);
        setSelectedFaculty(null);
        setSubjectsForModal([]);
    };

    const handleOpenViewModal = (faculty: Faculty) => {
        setFacultyForViewModal(faculty);
        setIsViewModalOpen(true);
    };

    const handleCloseViewModal = () => {
        setIsViewModalOpen(false);
        setFacultyForViewModal(null);
    };

    const handleAssignSubject = (
        facultyId: number, 
        subjectId: number, 
        schedules: { type: 'LEC' | 'LAB'; day: string; time: string; roomId: number }[]
    ) => {
        console.log("Assigning Subject:", { facultyId, subjectId, schedules });
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                dispatch(fetchFacultiesAction(true)).unwrap(),
                dispatch(fetchSubjectsAction(true)).unwrap(),
            ]);
            toast.success('Faculty loading data has been updated.');
        } catch (error) {
            console.error("Refresh failed:", error);
            toast.error('Failed to refresh faculty loading data.');
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6">
            <AnimatePresence>
                {isAssignModalOpen && selectedFaculty && (
                    <AssignSubjectDialog
                        isOpen={isAssignModalOpen}
                        onClose={handleCloseAssignModal}
                        faculty={selectedFaculty as any}
                        availableSubjects={subjectsForModal as any}
                        onAssign={handleAssignSubject}
                    />
                )}
                {isViewModalOpen && facultyForViewModal && (
                    <ViewAssignedSubjectsDialog
                        isOpen={isViewModalOpen}
                        onClose={handleCloseViewModal}
                        faculty={facultyForViewModal as any}
                    />
                )}
            </AnimatePresence>
            
            {/* ENHANCED HEADER */}
            <header className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 md:p-8 shadow-sm">
                {/* Subtle background glow */}
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
                
                <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                            <Sparkles size={14} />
                            Department Panel
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Faculty Loading</h1>
                            <p className="mt-2 max-w-2xl text-muted-foreground text-sm md:text-base">
                                Manage and assign subjects to faculty members efficiently based on their specific expertise and schedule availability.
                            </p>
                        </div>
                    </div>

                    {/* Stats & Controls Area */}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        {/* Unified Stats Card */}
                        <div className="flex w-full sm:w-auto bg-background rounded-xl border border-border/60 shadow-sm overflow-hidden divide-x divide-border/60">
                            <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors">
                                <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-500/20">
                                    <Users size={16} className="text-sky-600 dark:text-sky-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none mb-1">Total</p>
                                    <p className="font-bold text-foreground leading-none">{totalFaculty}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors">
                                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
                                    <Info size={16} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none mb-1">Visible</p>
                                    <p className="font-bold text-foreground leading-none">{totalVisible}</p>
                                </div>
                            </div>
                        </div>

                        {/* Modernized Refresh Button */}
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isBusy}
                            className="flex h-12 w-full sm:w-12 items-center justify-center rounded-xl border border-border/60 bg-background text-muted-foreground shadow-sm hover:text-foreground hover:bg-accent hover:border-accent-foreground/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                            title="Refresh data"
                            aria-label="Refresh data"
                        >
                            <RefreshCw size={18} className={`${isBusy ? 'animate-spin text-primary' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                            <span className="sm:hidden ml-2 font-medium">Refresh Data</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ENHANCED CONTENT AREA */}
            <div className="space-y-6">
                {/* Search Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full md:max-w-md group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                            <Search size={18} />
                        </div>
                        <Input
                            placeholder="Search by faculty name or expertise..."
                            value={facultyQuery}
                            onChange={(e) => setFacultyQuery(e.target.value)}
                            className="pl-10 h-11 w-full rounded-xl bg-card border-border/60 hover:bg-accent/50 focus:bg-background transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Main List Box */}
                <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 md:p-6 min-h-[400px]">
                    {isLoading ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <FacultyCardSkeleton key={index} />
                            ))}
                        </div>
                    ) : filteredFaculties.length > 0 ? (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <FacultyCard
                                data={filteredFaculties}
                                onAssignClick={handleOpenAssignModal}
                                onViewSubjectsClick={handleOpenViewModal}
                            />
                        </motion.div>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center h-full py-16 text-center"
                        >
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4 ring-8 ring-background">
                                <Search size={32} className="text-muted-foreground/50" />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground tracking-tight">No faculty members found</h3>
                            <p className="text-muted-foreground mt-2 max-w-sm">
                                We couldn't find anyone matching <span className="font-medium text-foreground">"{facultyQuery}"</span>. Try tweaking your search terms.
                            </p>
                            <button
                                onClick={() => setFacultyQuery('')}
                                className="mt-6 text-sm font-medium text-primary hover:underline underline-offset-4"
                            >
                                Clear search
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MainFacultyLoading;