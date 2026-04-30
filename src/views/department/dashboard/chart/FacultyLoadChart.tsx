// src/components/dashboard/FacultyLoadChart.tsx

import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { ApiFacultyLoad } from "../dashboard";

interface FacultyLoadChartProps {
    facultyLoadData: ApiFacultyLoad[];
}

export const FacultyLoadChart = ({ facultyLoadData }: FacultyLoadChartProps) => {
    // Default limit nga 20 hours (Pwede nimo ma-usab base sa inyong logic)
    const MAX_LOAD = 20; 

    return (
        <div className="bg-card p-6 rounded-xl border shadow-sm">
            <div className="mb-6 flex items-center gap-2">
                <BarChart3 className="text-muted-foreground" size={20} />
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    Faculty Load
                </h3>
            </div>
            
            <div className="space-y-5">
                {facultyLoadData.length > 0 ? (
                    facultyLoadData.map((faculty, idx) => {
                        const loadPercentage = Math.min(100, (faculty.load / MAX_LOAD) * 100);
                        
                        // Kung over-loaded (lapas sa MAX_LOAD), pwede nato himoong red ang text/bar warning
                        const isOverloaded = faculty.load > MAX_LOAD;

                        return (
                            <motion.div 
                                key={faculty.name} 
                                initial={{ opacity: 0, x: 10 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                transition={{ delay: 0.1 + idx * 0.05 }}
                            >
                                <div className="flex justify-between items-center mb-2 text-sm">
                                    <span className="font-medium text-foreground truncate pr-2">
                                        {faculty.name}
                                    </span>
                                    <span className={`font-mono text-xs ${isOverloaded ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                        {faculty.load}h <span className="opacity-50">/ {MAX_LOAD}h</span>
                                    </span>
                                </div>
                                
                                {/* Assuming you are using Shadcn UI's Progress component */}
                                <Progress 
                                    value={loadPercentage} 
                                    className={`h-2 ${isOverloaded ? 'bg-destructive/20 [&>div]:bg-destructive' : ''}`} 
                                />
                            </motion.div>
                        );
                    })
                ) : (
                    <div className="text-sm text-center text-muted-foreground py-4">
                        No faculty data available.
                    </div>
                )}
            </div>
        </div>
    );
};