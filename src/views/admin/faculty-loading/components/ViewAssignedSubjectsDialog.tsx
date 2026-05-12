import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; 
import { User, BookOpen, Clock, CalendarDays } from "lucide-react"; 
import type { Faculty } from "../type"; 
import { FacultyLoadedSchedule } from "./FacultyLoadedSchedule";

interface ViewAssignedSubjectsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  faculty: Faculty | null;
}

export function ViewAssignedSubjectsDialog({ isOpen, onClose, faculty }: ViewAssignedSubjectsDialogProps) {
  
  const [totalSubjects, setTotalSubjects] = useState<number>(0);

  if (!faculty) return null;

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const getProfileSrc = (pic: string | null | undefined) => {
     if (!pic) return '';
     const picture = pic ?? ''; 
     if (picture.startsWith('http') || picture.startsWith('data:')) return picture;
     return `${import.meta.env.VITE_URL}/${picture}`; 
  };

  // Receives number of UNIQUE subjects from FacultyLoadedSchedule
  const handleDataLoaded = (uniqueSubjectCount: number) => {
    setTotalSubjects(uniqueSubjectCount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden border-0 shadow-2xl bg-background">
        
        {/* PREMIUM HEADER */}
        <div className="relative border-b overflow-hidden bg-gradient-to-b from-muted/50 to-background px-6 py-8">
          {/* Decorative background blur */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          
          <DialogHeader className="relative z-10 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
               
               {/* Avatar Container */}
               <div className="relative shrink-0">
                   <Avatar className="h-24 w-24 border-4 border-background shadow-xl ring-1 ring-border/50">
                      <AvatarImage 
                          src={getProfileSrc(faculty.profile_picture)} 
                          alt={faculty.name} 
                          className="object-cover"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-bold tracking-wider">
                          {getInitials(faculty.name)}
                      </AvatarFallback>
                   </Avatar>
                   {/* Online/Active Indicator */}
                   <span className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-emerald-500 border-4 border-background shadow-sm" title="Active Faculty" />
               </div>
               
               {/* Profile Info */}
               <div className="space-y-3">
                  <DialogTitle className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                      {faculty.name}
                  </DialogTitle>
                  
                  {/* Badges Row */}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                      {/* Role Badge */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium transition-colors hover:bg-blue-500/20">
                          <User className="h-3.5 w-3.5" />
                          Faculty Member
                      </span>
                      
                      {/* Schedule Tag */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium transition-colors hover:bg-primary/20">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Schedule Overview
                      </span>
                      
                      {/* Subjects Count Badge */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium transition-colors hover:bg-amber-500/20">
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>{totalSubjects} Unique Subject{totalSubjects !== 1 ? "s" : ""}</span>
                      </span>
                  </div>
               </div>
            </div>
          </DialogHeader>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-hidden bg-muted/10 relative">
           {/* Inner shadow at the top for depth */}
           <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black/5 to-transparent z-10 pointer-events-none opacity-50 dark:opacity-100" />
           
           <FacultyLoadedSchedule 
                facultyId={faculty.id} 
                onDataLoaded={handleDataLoaded}
           />
        </div>

        {/* FOOTER */}
        <DialogFooter className="px-6 py-4 border-t bg-background flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0 opacity-70" />
                <span className="text-xs italic">
                    * Schedule is subject to modifications by the department head.
                </span>
            </div>
            <DialogClose asChild>
                <Button variant="outline" className="px-8 min-w-[120px] transition-all hover:bg-muted">
                  Close
                </Button>
            </DialogClose>
        </DialogFooter>
        
      </DialogContent>
    </Dialog>
  );
}