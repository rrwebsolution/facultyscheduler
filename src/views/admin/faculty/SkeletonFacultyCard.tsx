import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

export const SkeletonFacultyCard = () => (
  <TableRow>
    {/* 1. Faculty Member (Name/Designation) */}
    <TableCell>
      <div className="flex items-center gap-4">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </TableCell>
    
    {/* 2. Department */}
    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
    
    {/* 3. Expertise */}
    <TableCell>
        <div className="flex gap-2">
             <Skeleton className="h-5 w-20 rounded-full" />
             <Skeleton className="h-5 w-20 rounded-full" />
        </div>
    </TableCell>
    
    {/* 4. Teaching Load (t_load_units) */}
    <TableCell className="text-center"><Skeleton className="h-4 w-10 mx-auto" /></TableCell> 
    
    {/* 5. Deload (deload_units) */}
    <TableCell className="text-center"><Skeleton className="h-4 w-10 mx-auto" /></TableCell> 
    
    {/* 6. Overload (overload_units) */}
    <TableCell className="text-center"><Skeleton className="h-4 w-10 mx-auto" /></TableCell> 

    {/* 7. Availability Monitor */}
    <TableCell>
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </TableCell>
    
    {/* 8. Status */}
    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
    
    {/* 9. Actions */}
    <TableCell>
        <div className="flex justify-end items-center gap-1">
            {/* Action Buttons */}
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
        </div>
    </TableCell>
  </TableRow>
);
