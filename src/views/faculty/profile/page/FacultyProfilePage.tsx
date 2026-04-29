import { Mail, Phone, MapPin, Users, BookOpen, Clock, Edit, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

// Reusable component para sa course item
const CourseItem = ({ code, title, schedule, color }: { code: string; title: string; schedule: string; color: string }) => (
    <div className="flex items-start gap-4">
        <div className={`w-2 h-14 mt-1 rounded-full ${color}`}></div>
        <div>
            <p className="font-bold text-slate-800">{code}: <span className="font-medium">{title}</span></p>
            <p className="text-sm text-slate-500">{schedule}</p>
        </div>
    </div>
);


function FacultyProfilePage() {
    const navigate = useNavigate();
    const facultyString = localStorage.getItem('user'); // Assuming user is the faculty
    const faculty = facultyString ? JSON.parse(facultyString) : { name: 'Dr. Evelyn Reed', email: 'e.reed@university.edu' };
    const profileSrc = faculty?.profile_picture
        ? `${(import.meta.env.VITE_URL || '').replace(/\/$/, '')}/${faculty.profile_picture}`
        : `https://i.pravatar.cc/150?u=${faculty.email}`;

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* --- Profile Banner --- */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden">
                <div className="h-40 bg-gradient-to-r from-indigo-500 to-purple-600" />
                <div className="p-6">
                    <div className="flex items-end -mt-20">
                        <img 
                            src={profileSrc} 
                            alt="Faculty Profile"
                            className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md"
                        />
                        <div className="ml-6">
                            <h1 className="text-3xl font-bold text-slate-800">{faculty.name}</h1>
                            <p className="text-slate-500 font-medium">Associate Professor, College of Information Technology</p>
                        </div>
                        <button onClick={() => navigate('/faculty/settings')} className="ml-auto px-5 py-2.5 bg-slate-700 text-white font-semibold rounded-lg shadow-md hover:bg-slate-800 transition flex items-center gap-2">
                           <Edit size={16} /> Edit Profile
                        </button>
                    </div>
                </div>
            </div>
            
            {/* --- Stats Grid --- */}
            <div className="grid grid-cols-3 md:grid-cols-1 lg:grid-cols-3 gap-6">
                <StatCard icon={<BookOpen size={28} className="text-white"/>} label="Active Courses" value={5} color="bg-sky-500" />
                <StatCard icon={<Users size={28} className="text-white"/>} label="Total Students" value={182} color="bg-emerald-500" />
                <StatCard icon={<Clock size={28} className="text-white"/>} label="Office Hours" value={"1-3 PM, MWF"} color="bg-amber-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* --- Left Column: About and Contact --- */}
                <div className="lg:col-span-1 space-y-8">
                     <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/80">
                        <h3 className="text-xl font-bold text-slate-800 mb-5">About Me</h3>
                        <p className="text-slate-600 text-sm">
                           Dedicated educator and researcher with over 10 years of experience in web development and data science. Passionate about mentoring the next generation of tech innovators.
                        </p>
                     </div>
                     <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/80">
                        <h3 className="text-xl font-bold text-slate-800 mb-5">Contact Information</h3>
                        <div className="space-y-4">
                            <InfoItem icon={<Mail size={20} />} label="Email Address" value={faculty.email} />
                            <InfoItem icon={<Phone size={20} />} label="Phone" value="+1 (555) 987-6543" />
                            <InfoItem icon={<MapPin size={20} />} label="Office Location" value="IT Building, Room 305" />
                        </div>
                     </div>
                </div>

                {/* --- Right Column: Courses and Activity --- */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/80">
                        <h3 className="text-xl font-bold text-slate-800 mb-5">Currently Teaching</h3>
                        <div className="space-y-5">
                            <CourseItem code="IT-321" title="Advanced Web Development" schedule="MWF, 8:30 AM - 10:00 AM" color="bg-sky-500"/>
                            <CourseItem code="CS-101" title="Intro to Programming" schedule="TTh, 10:00 AM - 11:30 AM" color="bg-emerald-500"/>
                            <CourseItem code="IT-412" title="Project Management" schedule="MWF, 1:00 PM - 2:30 PM" color="bg-amber-500"/>
                            <CourseItem code="DS-202" title="Data Structures" schedule="TTh, 3:00 PM - 4:30 PM" color="bg-rose-500"/>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/80">
                        <h3 className="text-xl font-bold text-slate-800 mb-5">Recent Announcements</h3>
                         <ol className="relative border-l border-slate-200 space-y-6">                  
                            <li className="ml-6">            
                                <span className="absolute flex items-center justify-center w-6 h-6 bg-indigo-200 rounded-full -left-3 ring-4 ring-white">
                                    <Megaphone size={14} className="text-indigo-700"/>
                                </span>
                                <h4 className="flex items-center mb-1 text-md font-semibold text-slate-900">Finals Schedule Posted</h4>
                                <time className="block mb-2 text-xs font-normal leading-none text-slate-400">Announced 2 days ago</time>
                            </li>
                             <li className="ml-6">
                                <span className="absolute flex items-center justify-center w-6 h-6 bg-indigo-200 rounded-full -left-3 ring-4 ring-white">
                                    <Megaphone size={14} className="text-indigo-700"/>
                                </span>
                                <h4 className="flex items-center mb-1 text-md font-semibold text-slate-900">Project Submission Link Now Available</h4>
                                <time className="block mb-2 text-xs font-normal leading-none text-slate-400">Announced last week</time>
                            </li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FacultyProfilePage;
