import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Settings, Calendar, Clock, Menu, X, PanelLeftClose, PanelLeftOpen, Sun, Moon, Laptop, ChevronDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@/components/themeProvider';
import axios from '../../../plugin/axios'; // Siguraduhing sakto ang path sa imong axios instance

interface HeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (isCollapsed: boolean) => void;
}

const Header = ({ isSidebarOpen, setIsSidebarOpen, isSidebarCollapsed, setIsSidebarCollapsed }: HeaderProps) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const { theme, setTheme } = useTheme();
  const profileDropdownRef = useRef<HTMLDivElement | null>(null);
  const themeDropdownRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000); // Update every minute
    return () => clearInterval(t);
  }, []);

  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { name: 'Admin', email: 'admin@example.com' };
  const profileSrc = user?.profile_picture
    ? `${(import.meta.env.VITE_URL || '').replace(/\/$/, '')}/${user.profile_picture}`
    : `https://i.pravatar.cc/150?u=${user.email}`;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) setIsProfileOpen(false);
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) setIsThemeOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    const token = localStorage.getItem('accessToken');
    if (!token) {
        // Kung walay token, limpyohan lang ang frontend
        localStorage.removeItem('user');
        navigate('/user-login');
        setIsLoggingOut(false);
        return;
    }

    try {
        // Maningkamot nga i-invalidate ang token sa server
        await axios.post('/logout', {}, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        toast.success('You have been logged out successfully.');
    } catch (error) {
        console.error("Logout failed on server:", error);
        // Bisan og naay error (sama sa 401), i-inform lang ang user ug ipadayon ang pag-logout sa frontend
        toast.error("Could not contact server, logging out locally.");
    } finally {
        // Kini nga block kay mu-run pirmi, successful man o failed ang API call
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setIsProfileOpen(false);
        navigate('/user-login');
        setIsLoggingOut(false);
    }
  };

  const dropdownVariants: Variants = {
    hidden: { opacity: 0, y: -10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: "easeOut" as const } },
    exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15, ease: "easeIn" as const } }
  };

  return (
    <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 rounded-md text-foreground" aria-label="Toggle Sidebar">
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:flex p-2 rounded-md text-muted-foreground hover:text-foreground" aria-label="Toggle Sidebar Collapse">
            {isSidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden md:flex flex-row items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="w-4 h-4" />{now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="w-4 h-4" />{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
          </div>

          <div className="relative" ref={themeDropdownRef}>
            <button onClick={() => { setIsThemeOpen(p => !p); setIsProfileOpen(false); }} className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </button>
            <AnimatePresence>
              {isThemeOpen && (
                <motion.div variants={dropdownVariants} initial="hidden" animate="visible" exit="exit" className="absolute right-0 mt-2 w-36 bg-popover rounded-md shadow-lg border z-50">
                   <div className="p-1">
                     <button onClick={() => { setTheme('light'); setIsThemeOpen(false); }} className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm text-popover-foreground hover:bg-muted ${theme === 'light' ? 'bg-muted' : ''}`}><Sun size={14} /> Light</button>
                     <button onClick={() => { setTheme('dark'); setIsThemeOpen(false); }} className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm text-popover-foreground hover:bg-muted ${theme === 'dark' ? 'bg-muted' : ''}`}><Moon size={14} /> Dark</button>
                     <button onClick={() => { setTheme('system'); setIsThemeOpen(false); }} className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm text-popover-foreground hover:bg-muted ${theme === 'system' ? 'bg-muted' : ''}`}><Laptop size={14} /> System</button>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <span className="h-6 w-px bg-border hidden sm:inline-block"></span>

          <div className="relative" ref={profileDropdownRef}>
            <button onClick={() => { setIsProfileOpen(p => !p); setIsThemeOpen(false); }} className="flex items-center gap-2 rounded-full p-1 pl-3 pr-2 hover:bg-muted transition-colors">
              <div className="hidden sm:flex flex-col items-end">
                <span className="font-semibold text-sm text-foreground uppercase">{user.name}</span>
                <span className="text-xs text-muted-foreground">Administrator</span>
              </div>
              <img src={profileSrc} alt="Profile" className="w-9 h-9 rounded-full border-2 border-border"/>
              <motion.div animate={{ rotate: isProfileOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={16} className="text-muted-foreground" />
              </motion.div>
            </button>
            <AnimatePresence>
              {isProfileOpen && (
                <motion.div variants={dropdownVariants} initial="hidden" animate="visible" exit="exit" className="absolute right-0 mt-2 w-60 bg-popover rounded-md shadow-lg border z-50">
                  <div className="flex items-center gap-3 p-3 border-b border-border">
                    <img src={profileSrc} alt="Profile" className="w-10 h-10 rounded-full"/>
                    <div>
                      <p className="font-semibold text-sm text-popover-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="p-1">
                    <Link to="/admin/profile" onClick={() => setIsProfileOpen(false)} className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm text-popover-foreground hover:bg-muted"><User size={14} /> Profile</Link>
                    <Link to="/admin/settings" onClick={() => setIsProfileOpen(false)} className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm text-popover-foreground hover:bg-muted"><Settings size={14} /> Settings</Link>
                    <div className="h-px bg-border my-1" />
                    <button onClick={handleLogout} disabled={isLoggingOut} className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm text-destructive hover:bg-destructive/10 disabled:opacity-60 disabled:cursor-not-allowed">
                      {isLoggingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                      {isLoggingOut ? 'Logging out...' : 'Logout'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
