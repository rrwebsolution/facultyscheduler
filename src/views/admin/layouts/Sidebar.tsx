import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Building2, FileText, LayoutDashboardIcon, LogOut, Users, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import axios from "../../../plugin/axios";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  isCollapsed: boolean;
}

function Sidebar({ isOpen, setIsOpen, isCollapsed }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const navLinks = [
    { href: "/admin/user-dashboard", label: "Dashboard", icon: <LayoutDashboardIcon size={20} /> },
    { href: "/admin/curriculum-management", label: "Curriculum", icon: <BookOpen size={20} /> },
    { href: "/admin/faculty", label: "Faculty", icon: <Users size={20} /> },
    // { href: "/admin/faculty-loading", label: "Faculty Loading", icon: <Calendar size={20} /> },
    { href: "/admin/room", label: "Classroom", icon: <Building2 size={20} /> },
    { href: "/admin/reports", label: "Reports", icon: <FileText size={20} /> },
  ];

  const isRouteActive = (pathname: string, href: string) => {
    const cleanPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const cleanHref = href.endsWith('/') && href.length > 1 ? href.slice(0, -1) : href;
    return cleanPath === cleanHref;
  };

  const handleSidebarLogout = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        localStorage.removeItem('user');
        navigate('/user-login');
        return;
    }
    try {
        await axios.post('/logout', {}, { headers: { 'Authorization': `Bearer ${token}` } });
        toast.success('You have been logged out.');
    } catch (error) {
        console.error("Logout failed on server:", error);
        toast.error("Logout failed, clearing session locally.");
    } finally {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        navigate('/user-login');
    }
  };

  useEffect(() => {
    if (isMobile && isOpen) setIsOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isMobile]);

  useEffect(() => {
    document.body.style.overflow = (isMobile && isOpen) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen, isMobile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setIsOpen]);
  
  const sidebarVariants = {
    expanded: { width: "256px", translateX: "0%" },
    collapsed: { width: "72px", translateX: "0%" },
    open: { width: "256px", translateX: "0%" },
    closed: { width: "256px", translateX: "-100%" },
  };

  const getAnimationState = () => isMobile ? (isOpen ? "open" : "closed") : (isCollapsed ? "collapsed" : "expanded");
  const hideText = !isMobile && isCollapsed;

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        variants={sidebarVariants}
        initial={false}
        animate={getAnimationState()}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="fixed inset-y-0 left-0 bg-gradient-to-b from-gray-900 to-purple-900 shadow-xl z-40 flex flex-col"
      >
        <button onClick={() => setIsOpen(false)} className="absolute top-3 right-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 md:hidden" aria-label="Close sidebar">
            <X size={22} />
        </button>
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-white/10 shrink-0">
            <Link to="/admin/user-dashboard" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-fuchsia-600 to-violet-600 rounded-lg flex items-center justify-center text-xl font-bold text-white shadow-lg shrink-0">FS</div>
              <AnimatePresence>
                {!hideText && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><h3 className="font-bold text-lg text-white whitespace-nowrap">Admin Panel</h3></motion.div>}
              </AnimatePresence>
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-4">
            <ul className="w-full flex flex-col gap-1">
              {navLinks.map((link) => {
                const active = isRouteActive(location.pathname, link.href);
                return (
                  <li key={link.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link to={link.href} className={`flex items-center gap-3 p-3 rounded-lg text-base transition ${active ? "bg-white/10 font-medium text-white shadow" : "text-gray-300 hover:bg-white/5 hover:text-white"} ${hideText ? 'justify-center' : ''}`}>
                          <div className="shrink-0">{link.icon}</div>
                          <AnimatePresence>
                            {!hideText && <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto', transition: { delay: 0.1 } }} exit={{ opacity: 0, width: 0 }} className="whitespace-nowrap overflow-hidden">{link.label}</motion.span>}
                          </AnimatePresence>
                        </Link>
                      </TooltipTrigger>
                      {hideText && <TooltipContent side="right" className="bg-gray-800 text-white border-gray-700">{link.label}</TooltipContent>}
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="px-2 py-4 mt-auto border-t border-white/10 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={handleSidebarLogout} className={`flex items-center gap-3 w-full p-3 rounded-lg text-gray-300 hover:bg-red-500/80 hover:text-white transition-all ${hideText ? 'justify-center' : ''}`}>
                  <div className="shrink-0"><LogOut size={20} /></div>
                  <AnimatePresence>
                    {!hideText && <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto', transition: { delay: 0.1 } }} exit={{ opacity: 0, width: 0 }} className="whitespace-nowrap overflow-hidden">Logout</motion.span>}
                  </AnimatePresence>
                </button>
              </TooltipTrigger>
              {hideText && <TooltipContent side="right" className="bg-gray-800 text-white border-gray-700">Logout</TooltipContent>}
            </Tooltip>
          </div>
        </div>
      </motion.aside>
      {isOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsOpen(false)} aria-hidden="true" />}
    </TooltipProvider>
  );
}

export default Sidebar;