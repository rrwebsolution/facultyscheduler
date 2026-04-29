import { useEffect, useState } from 'react';
import { User, Mail, Phone, MapPin, Users, BookOpen, Building2, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from '../../../../plugin/axios';

// Reusable component para sa stat card
const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) => (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/80 flex items-center gap-5">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-slate-500 text-sm font-medium">{label}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
    </div>
);

// Reusable component para sa information item
const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string; }) => (
    <div className="flex items-center gap-4">
        <div className="w-10 h-10 flex-shrink-0 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
           {icon}
        </div>
        <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="font-semibold text-slate-700">{value}</p>
        </div>
    </div>
);


function ProfilePage() {
    const navigate = useNavigate();
    const userString = localStorage.getItem('user');
    const user = userString ? JSON.parse(userString) : { name: 'Admin', email: 'admin@facultyscheduler.com' };
    const [isLoading, setIsLoading] = useState(true);
    const [facultiesManaged, setFacultiesManaged] = useState(0);
    const [totalCourses, setTotalCourses] = useState(0);
    const [roomsAvailable, setRoomsAvailable] = useState(0);
    const profileSrc = user?.profile_picture
        ? `${(import.meta.env.VITE_URL || '').replace(/\/$/, '')}/${user.profile_picture}`
        : `https://i.pravatar.cc/150?u=${user.email}`;
    const contactPhone = user?.phone || user?.contact_number || 'Not set';
    const contactLocation = user?.location || user?.address || 'Not set';

    useEffect(() => {
        const fetchProfileStats = async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                const [facultiesRes, subjectsRes, roomsRes] = await Promise.all([
                    axios.get('/faculties', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('/get-subjects', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('/rooms', { headers: { Authorization: `Bearer ${token}` } }),
                ]);

                const activeFaculties = facultiesRes?.data?.faculties || [];
                const subjects = subjectsRes?.data?.subject || [];
                const rooms = roomsRes?.data?.rooms || [];

                setFacultiesManaged(Array.isArray(activeFaculties) ? activeFaculties.length : 0);
                setTotalCourses(Array.isArray(subjects) ? subjects.length : 0);
                setRoomsAvailable(Array.isArray(rooms) ? rooms.length : 0);
            } catch (error) {
                // Keep UI usable with fallback zero values.
                setFacultiesManaged(0);
                setTotalCourses(0);
                setRoomsAvailable(0);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfileStats();
    }, []);

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* --- Profile Banner --- */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden">
                <div className="h-40 bg-gradient-to-r from-slate-800 to-slate-900" />
                <div className="p-6">
                    <div className="flex items-end -mt-20">
                        <img 
                            src={profileSrc} 
                            alt="Admin Profile"
                            className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md"
                        />
                        <div className="ml-6">
                            <h1 className="text-3xl font-bold text-slate-800">{user.name}</h1>
                            <p className="text-slate-500 font-medium">Administrator</p>
                        </div>
                        <button onClick={() => navigate('../settings')} className="ml-auto px-5 py-2.5 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition flex items-center gap-2">
                           <Edit size={16} /> Edit Profile
                        </button>
                    </div>
                </div>
            </div>
            
            {/* --- Stats Grid --- */}
            <div className="grid grid-cols-3 md:grid-cols-1 gap-6">
                <StatCard icon={<Users size={28} className="text-white"/>} label="Faculties Managed" value={isLoading ? '--' : facultiesManaged} color="bg-sky-500" />
                <StatCard icon={<BookOpen size={28} className="text-white"/>} label="Total Courses" value={isLoading ? '--' : totalCourses} color="bg-emerald-500" />
                <StatCard icon={<Building2 size={28} className="text-white"/>} label="Rooms Available" value={isLoading ? '--' : roomsAvailable} color="bg-amber-500" />
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* --- Left Column: About and Contact --- */}
                <div className="lg:col-span-1 space-y-8">
                     <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/80">
                        <h3 className="text-xl font-bold text-slate-800 mb-5">About</h3>
                        <p className="text-slate-600 text-sm">
                            System administrator responsible for managing faculty schedules, course data, and overall system integrity. Ensuring a smooth and efficient scheduling process for the institution.
                        </p>
                     </div>
                     <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/80">
                        <h3 className="text-xl font-bold text-slate-800 mb-5">Contact Information</h3>
                        <div className="space-y-4">
                            <InfoItem icon={<User size={20} />} label="Full Name" value={user.name} />
                            <InfoItem icon={<Mail size={20} />} label="Email Address" value={user.email} />
                            <InfoItem icon={<Phone size={20} />} label="Phone" value={contactPhone} />
                            <InfoItem icon={<MapPin size={20} />} label="Location" value={contactLocation} />
                        </div>
                     </div>
                </div>
            </div>
        </div>
    );
}

export default ProfilePage;
