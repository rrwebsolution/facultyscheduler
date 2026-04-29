import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Info, Search, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import type { Faculty, Subject } from './type';
import { toast } from 'sonner';
import { FacultyCardSkeleton } from './components/card/FacultyCardSkeleton';
import { AssignSubjectDialog } from './components/AssignSubjectDialog';
import { ViewAssignedSubjectsDialog } from './components/ViewAssignedSubjectsDialog';
import { FacultyCard } from './components/card/FacultyCard';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchFaculties as fetchFacultiesAction, fetchSubjects as fetchSubjectsAction } from '@/store/slices/dataCacheSlice';


function MainFacultyLoading() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const faculties = useAppSelector((state) => state.dataCache.faculties) as Faculty[];
    const allSubjects = useAppSelector((state) => state.dataCache.subjects) as Subject[];
    const facultiesStatus = useAppSelector((state) => state.dataCache.facultiesStatus);
    const subjectsStatus = useAppSelector((state) => state.dataCache.subjectsStatus);
    const [subjectsForModal, setSubjectsForModal] = useState<Subject[]>([]);
    const [facultyQuery, setFacultyQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // State for Assign Subject Dialog
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);

    // New State for View Assigned Subjects Dialog
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [facultyForViewModal, setFacultyForViewModal] = useState<Faculty | null>(null);


    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const token = localStorage.getItem('accessToken');
                if (!token) {
                    toast.error('You must be logged in.');
                    navigate('/user-login', { replace: true });
                    return;
                }
                const tasks: Promise<unknown>[] = [];
                if (facultiesStatus === 'idle') tasks.push(dispatch(fetchFacultiesAction(false)).unwrap());
                if (subjectsStatus === 'idle') tasks.push(dispatch(fetchSubjectsAction(false)).unwrap());
                if (tasks.length > 0) await Promise.all(tasks);

            } catch (error) {
                console.error("Error fetching data:", error);
                const message = (error as any)?.response?.data?.message || (error as Error)?.message || '';
                if (String(message).toLowerCase().includes('authentication required')) {
                    toast.error('Authentication required.');
                    navigate('/user-login', { replace: true });
                    return;
                }
                toast.error('Failed to retrieve data from the server.');
            }
        };
        fetchInitialData();
    }, [dispatch, facultiesStatus, subjectsStatus, navigate]);

    const isLoading = facultiesStatus === 'loading' || subjectsStatus === 'loading' || (facultiesStatus === 'idle' && subjectsStatus === 'idle');
    const isBusy = isLoading || isRefreshing;

    const filteredFaculties = faculties.filter(f =>
        f.name.toLowerCase().includes(facultyQuery.toLowerCase()) ||
        f.expertise.some(e => e.toLowerCase().includes(facultyQuery.toLowerCase()))
    );

    // Handlers for Assigning Subjects
    const handleOpenAssignModal = (faculty: Faculty) => {
        // Normalize and tokenize expertise terms (remove short/common words)
        const facultyExpertise = faculty.expertise
            .map(e => (e || '').toLowerCase().trim())
            .filter(Boolean)
            .flatMap(e => e.split(/\s+|[,;/]+/).map(t => t.trim()))
            .filter(t => t.length > 2);

        if (!facultyExpertise.length) {
            // If faculty has no expertise listed, pass an empty array so the dialog
            // can decide what to show (we avoid forcing all subjects).
            setSubjectsForModal([]);
        } else {
            const relevantSubjects = allSubjects.filter(subject => {
                const subjectText = `${subject.des_title ?? ''} ${subject.subject_code ?? ''} ${(subject as any).pre_requisite ?? ''}`.toLowerCase();
                // Match if ANY expertise token appears in the subject text
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

    // New Handlers for Viewing Subjects
    const handleOpenViewModal = (faculty: Faculty) => {
        setFacultyForViewModal(faculty);
        setIsViewModalOpen(true);
    };

    const handleCloseViewModal = () => {
        setIsViewModalOpen(false);
        setFacultyForViewModal(null);
    };

    // --- UPDATED HANDLER HERE ---
    const handleAssignSubject = (
        facultyId: number, 
        subjectId: number, 
        schedules: { type: 'LEC' | 'LAB'; day: string; time: string; roomId: number }[]
    ) => {
        console.log("Assigning Subject:", { facultyId, subjectId, schedules });
        
        // Example: If you need to refresh data immediately after assignment,
        // you can call a refresh function here or trigger a state update.
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
        <>
            <AnimatePresence>
                {isAssignModalOpen && selectedFaculty && (
                    <AssignSubjectDialog
                        isOpen={isAssignModalOpen}
                        onClose={handleCloseAssignModal}
                        faculty={selectedFaculty}
                        availableSubjects={subjectsForModal}
                        onAssign={handleAssignSubject} // Now signatures match
                    />
                )}
                {isViewModalOpen && facultyForViewModal && (
                    <ViewAssignedSubjectsDialog
                        isOpen={isViewModalOpen}
                        onClose={handleCloseViewModal}
                        faculty={facultyForViewModal}
                    />
                )}
            </AnimatePresence>
            
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Faculty Loading</h1>
                    <p className="text-muted-foreground mt-3">
                        Assign subjects to faculty based on expertise and availability.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Refresh data"
                    aria-label="Refresh data"
                >
                    <RefreshCw size={18} className={isBusy ? 'animate-spin' : ''} />
                    <span className="text-sm font-medium">Refresh data</span>
                </button>
            </header>

            <div className="bg-card p-4 md:p-6 rounded-xl shadow-sm border border-border">
                <div className="flex justify-start mb-8">
                    <div className="relative w-full md:max-w-lg">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                        <Input
                            placeholder="Search by faculty name or expertise..."
                            value={facultyQuery}
                            onChange={(e) => setFacultyQuery(e.target.value)}
                            className="pl-12 h-12 rounded-full text-base"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <FacultyCardSkeleton key={index} />
                        ))}
                    </div>
                ) : filteredFaculties.length > 0 ? (
                    <FacultyCard
                        data={filteredFaculties}
                        onAssignClick={handleOpenAssignModal}
                        onViewSubjectsClick={handleOpenViewModal}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground bg-muted/50 rounded-lg border-2 border-dashed">
                        <Info size={40} className="mb-4 text-primary" />
                        <h3 className="text-xl font-semibold text-foreground">No Faculty Found</h3>
                        <p>Your search for "{facultyQuery}" did not match any faculty profiles.</p>
                    </div>
                )}
            </div>
        </>
    );
}

export default MainFacultyLoading;
