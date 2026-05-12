import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Briefcase, Mail, Save, Sparkles, Upload, UserRound, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
// Assuming Faculty type is now simplified to only the necessary fields
import type { Faculty } from "../table/FacultyTable"; 

import { toast } from "sonner";
import axios from "../../../../plugin/axios";
import { isAxiosError } from "axios";

interface FacultyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (faculty: Faculty) => void;
  initialData: Faculty | null;
  expertiseOptions: string[];
}

const expertiseColorPalette = [
    { bg: "bg-blue-100", text: "text-blue-800" }, { bg: "bg-emerald-100", text: "text-emerald-800" },
    { bg: "bg-amber-100", text: "text-amber-800" }, { bg: "bg-rose-100", text: "text-rose-800" },
    { bg: "bg-indigo-100", text: "text-indigo-800" }, { bg: "bg-cyan-100", text: "text-cyan-800" },
];

function getStringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function FacultyFormModal({ isOpen, onClose, onSave, initialData, expertiseOptions }: FacultyFormModalProps) {
  
  // NOTE: Status field is explicitly removed from the FormData type
  type FacultyFormData = Omit<Faculty, "id" | "role" | "status"> & {
    avatar?: string;
    deload_units: number | string;
    teaching_load_units: number | string;
    overload_units: number | string;
    t_load_units: number | string;
  };

  const [formData, setFormData] = useState<FacultyFormData>({
    name: "",
    email: "",
    designation: "",
    department: "",
    expertise: [],
    // status: "Active", // REMOVED: Status
    avatar: "",
    profile_picture: "",
    deload_units: 0,
    teaching_load_units: 0,
    overload_units: 0,
    t_load_units: 0,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [availableExpertise, setAvailableExpertise] = useState<string[]>(expertiseOptions);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [newExpertiseInput, setNewExpertiseInput] = useState("");

  useEffect(() => {
    const fetchDepartments = async () => {
        setIsLoadingDepartments(true);
        const token = localStorage.getItem('accessToken');
        if (!token) { toast.error("Authentication required."); setIsLoadingDepartments(false); return; }
        try {
            const response = await axios.get('/department-program', { headers: { 'Authorization': `Bearer ${token}` } });
            const programList: any[] = Array.isArray(response.data.programs) ? response.data.programs : Object.values(response.data.programs || {});
            const departmentNames = [...new Set(programList.map(p => p.program_name))];
            setDepartmentOptions(departmentNames.sort());
        } catch (error) {
            toast.error("Failed to fetch departments.");
        } finally {
            setIsLoadingDepartments(false);
        }
    };
    if (isOpen) { fetchDepartments(); }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      // Coerce existing number fields back to number state, if they exist
      const initialLoadData = {
          deload_units: initialData.deload_units || 0,
          teaching_load_units: initialData.t_load_units || 0,
          overload_units: initialData.overload_units || 0,
          t_load_units: initialData.t_load_units || 0,
      };
      
      // Manually omitting 'status' for type compatibility
      const { status, ...restOfInitialData } = initialData; 

      setFormData({ ...restOfInitialData as Omit<Faculty, "id" | "role" | "status">, ...initialLoadData });
      setImagePreview(initialData.profile_picture || null);
      setAvailableExpertise(expertiseOptions.filter(opt => !initialData.expertise.includes(opt)));
    } else {
      const defaultAvatar = `https://avatar.iran.liara.run/public/${Math.floor(Math.random() * 100)}`;
      setFormData({
        name: "",
        designation: "",
        expertise: [],
        department: "",
        email: "",
        // status: "Active", // REMOVED: Status
        avatar: defaultAvatar,
        profile_picture: "",
        deload_units: 0,
        teaching_load_units: 0,
        overload_units: 0,
        t_load_units: 0,
      });
      setImagePreview(defaultAvatar);
      setAvailableExpertise(expertiseOptions);
    }
    setNewExpertiseInput(""); 
  }, [initialData, isOpen, expertiseOptions]);

  // --- UPDATED handleChange ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let finalValue: string | number = value;
    
    if (['deload_units', 'teaching_load_units', 'overload_units'].includes(name)) {
        let numericValue = Number(value);
        
        if (value === '') {
             finalValue = '';
        } else {
             finalValue = numericValue < 0 ? 0 : numericValue;
        }
    }
    setFormData((prev) => ({ 
        ...prev, 
        [name]: finalValue,
        // Also update t_load_units if teaching_load_units is changed, as they are used interchangeably
        ...(name === 'teaching_load_units' ? { t_load_units: finalValue === '' ? 0 : Number(finalValue) } : {})
    }));
  };
  // --- END UPDATED handleChange ---

  const handleSelectChange = (name: "department" | "designation", value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setImagePreview(URL.createObjectURL(file)); }
  };
  
  const handleSelectExpertise = (expertise: string) => {
    const expertiseToProcess = expertise.trim();
    if (expertiseToProcess && !formData.expertise.includes(expertiseToProcess)) {
      setFormData((prev) => ({ ...prev, expertise: [...prev.expertise, expertiseToProcess].sort() }));
      
      if(availableExpertise.includes(expertiseToProcess)) {
          setAvailableExpertise((prev) => prev.filter((exp) => exp !== expertiseToProcess));
      }
    }
    setNewExpertiseInput("");
  };

  const handleRemoveExpertise = (expertiseToRemove: string) => {
    setFormData((prev) => ({ ...prev, expertise: prev.expertise.filter((exp) => exp !== expertiseToRemove) }));
    if (expertiseOptions.includes(expertiseToRemove) && !availableExpertise.includes(expertiseToRemove)) {
      setAvailableExpertise((prev) => [...prev, expertiseToRemove].sort());
    }
  };

  // Filter logic for suggestions (now without the .slice(0, 5) limit)
  const filteredExpertise = availableExpertise
      .filter(exp => exp.toLowerCase().includes(newExpertiseInput.toLowerCase()))
      .sort();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    let roleValue: number;
    switch (formData.designation) {
        case "Dean": roleValue = 0; break;
        case "Program Head": roleValue = 1; break;
        case "Faculty": roleValue = 2; break;
        default: toast.error("Invalid designation."); setIsLoading(false); return;
    }
    
    // Coerce string fields to number, treating empty string as 0
    const deload = Number(formData.deload_units) || 0;
    const teachingLoad = Number(formData.teaching_load_units) || 0;
    const overload = Number(formData.overload_units) || 0;


    const dataToSend = new FormData();
    dataToSend.append('name', formData.name);
    dataToSend.append('email', formData.email);
    dataToSend.append('role', String(roleValue));
    dataToSend.append('designation', formData.designation);
    dataToSend.append('department', formData.department);
    dataToSend.append('deload_units', String(deload));
    dataToSend.append('t_load_units', String(teachingLoad));
    dataToSend.append('overload_units', String(overload));
    formData.expertise.forEach(exp => dataToSend.append('expertise[]', exp));

    const avatarInput = document.getElementById('avatar-file') as HTMLInputElement;
    if (avatarInput?.files?.[0]) { dataToSend.append('avatar', avatarInput.files[0]); }
    
    const token = localStorage.getItem('accessToken');
    if (!token) { toast.error("Authentication required."); setIsLoading(false); return; }
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' };

    try {
        const isEditing = !!initialData;
        const url = isEditing ? `/faculties/${initialData.id}` : '/faculties';
        if (isEditing) { dataToSend.append('_method', 'PUT'); }
        
        const response = await axios.post(url, dataToSend, { headers });
        toast.success(response.data.message || 'Faculty saved successfully!');
        
        const savedApiData = response.data.faculty;
        // Cast the final result to the Faculty interface expected by onSave
        const resultFaculty: Faculty = {
            id: savedApiData.id,
            name: savedApiData.user?.name || 'N/A',
            email: savedApiData.user?.email || 'N/A',
            role: savedApiData.user?.role,
            designation: savedApiData.designation || '',
            department: savedApiData.department || '',
            // NOTE: Must ensure the Faculty interface is compatible with this save structure
            status: "Active", // Assuming new/updated faculty are always Active in the permanent deletion context
            profile_picture: savedApiData.profile_picture ? `${import.meta.env.VITE_URL}/${savedApiData.profile_picture}` : `https://avatar.iran.liara.run/public/boy?username=${(savedApiData.user?.name || '').replace(/\s/g, '')}`,
            expertise: savedApiData.expertises?.map((exp: any) => exp.list_of_expertise) || [],
            deload_units: savedApiData.deload_units || 0,
            t_load_units: savedApiData.t_load_units || 0,
            overload_units: savedApiData.overload_units || 0,
        };
        onSave(resultFaculty);
        onClose();
    } catch (error: unknown) {
        if (isAxiosError(error) && error.response) {
            const errors = error.response.data.errors as Record<string, string[]>;
            if (errors) {
                const firstError = Object.values(errors)[0][0];
                toast.error(firstError);
            } else {
                toast.error(error.response.data.message || "An error occurred.");
            }
        } else {
            toast.error("Failed to connect to the server.");
        }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-border bg-muted/30 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{initialData ? "Edit Faculty" : "Add New Faculty"}</DialogTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Update faculty profile, department, expertise, and load units.</p>
                </div>
              </div>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 px-5 py-5 sm:px-6">
              <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <button type="button" onClick={() => imagePreview && setIsPreviewModalOpen(true)} className="mx-auto rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:cursor-not-allowed sm:mx-0" disabled={!imagePreview} title="Click to preview image">
                      <img src={imagePreview || 'https://via.placeholder.com/80'} alt="Profile Preview" className="h-24 w-24 rounded-full border-4 border-background object-cover shadow-md ring-1 ring-border transition-opacity hover:opacity-85"/>
                    </button>
                    <div className="min-w-0 flex-1 space-y-2">
                        <Label className="text-sm font-semibold text-foreground">Profile Picture</Label>
                        <div className="relative">
                          <Upload className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input id="avatar-file" type="file" accept="image/png, image/jpeg" onChange={handleImageChange} className="h-11 cursor-pointer pl-10 text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"/>
                        </div>
                        <p className="text-xs text-muted-foreground">PNG or JPG. Max 2MB.</p>
                    </div>
                  </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Faculty Information</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="name">Full Name</Label><Input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="Enter full name" required className="h-11" /></div>
                  
                  <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input 
                          id="email" 
                          name="email" 
                          type="text"
                          value={formData.email} 
                          onChange={handleChange} 
                          placeholder="Enter email address"
                          required 
                          pattern="[a-zA-Z0-9._%+-ñÑ]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
                          title="Please enter a valid email address. The 'ñ' character is allowed."
                          className="h-11 pl-10"
                      />
                      </div>
                  </div>
                  
                  <div className="space-y-2">
                      <Label htmlFor="designation">Designation</Label>
                      <Select value={formData.designation} onValueChange={(value) => handleSelectChange("designation", value)} required>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Select a designation" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="Dean">Dean</SelectItem>
                              <SelectItem value="Program Head">Program Head</SelectItem>
                              <SelectItem value="Faculty">Faculty</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Select value={formData.department} onValueChange={(v) => handleSelectChange("department", v)} required>
                          <SelectTrigger disabled={isLoadingDepartments} className="h-11">
                              <SelectValue placeholder={isLoadingDepartments ? "Loading..." : "Select a department"} />
                          </SelectTrigger>
                          <SelectContent>
                              {departmentOptions.length > 0 ? (
                                  departmentOptions.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))
                              ) : (
                                  <div className="p-4 text-center text-sm text-muted-foreground">{isLoadingDepartments ? "Loading..." : "No departments."}</div>
                              )}
                          </SelectContent>
                      </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Load Units</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* UPDATED: Value set to String(value) to display 0 */}
                  <div className="space-y-2"><Label htmlFor="deload_units">Deload Units</Label><Input id="deload_units" name="deload_units" type="number" min={0} value={String(formData.deload_units)} onChange={handleChange} placeholder="0" className="h-11" /></div>
                  
                  <div className="space-y-2">
                      <Label htmlFor="teaching_load_units">Teaching Load</Label>
                      {/* UPDATED: Value set to String(value) to display 0 */}
                      <Input id="teaching_load_units" name="teaching_load_units" type="number" min={0} value={String(formData.teaching_load_units)} onChange={handleChange} placeholder="e.g. 18" className="h-11" />
                  </div>
                  
                  {/* UPDATED: Value set to String(value) to display 0 */}
                  <div className="space-y-2"><Label htmlFor="overload_units">Overload Units</Label><Input id="overload_units" name="overload_units" type="number" min={0} value={String(formData.overload_units)} onChange={handleChange} placeholder="0" className="h-11" /></div>
                </div>
              </div>
              
              {/* UPDATED EXPERTISE FIELD (Token/Tag Input with Autocomplete/Suggestions) */}
              <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <Label htmlFor="expertise-input" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Expertise</Label>
                  </div>
                  <div className="space-y-2">
                      <Command className="overflow-hidden rounded-xl border border-input shadow-sm">
                        {formData.expertise.length > 0 && (
                          <div className="flex flex-wrap gap-2 border-b border-input bg-muted/30 p-3">
                            {formData.expertise.map((exp) => {
                              const colorIndex = getStringHash(exp) % expertiseColorPalette.length;
                              const color = expertiseColorPalette[colorIndex];
                              return (
                                <Badge key={exp} className={`rounded-full px-2.5 py-1 font-medium ${color.bg} ${color.text}`}>
                                  {exp}
                                  <button type="button" onClick={() => handleRemoveExpertise(exp)} className="ml-1.5 rounded-full p-0.5" aria-label={`Remove ${exp}`}>
                                    <X size={14} />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                        <CommandInput
                          placeholder="Search or add expertise..."
                          value={newExpertiseInput}
                          onValueChange={setNewExpertiseInput}
                        />
                        <CommandList className="max-h-48">
                          <CommandEmpty>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                              onClick={() => handleSelectExpertise(newExpertiseInput)}
                              disabled={!newExpertiseInput.trim()}
                            >
                              Add new: {newExpertiseInput.trim() || "Type expertise first"}
                            </button>
                          </CommandEmpty>
                          <CommandGroup heading="Available Expertise">
                            {filteredExpertise.map((exp) => (
                              <CommandItem key={exp} value={exp} onSelect={() => handleSelectExpertise(exp)}>
                                {exp}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                  </div>
              </div>
              
              <DialogFooter className="sticky bottom-0 -mx-5 mt-8 border-t border-border bg-background/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
                <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading} className="h-10 w-full sm:w-auto">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isLoading} className="h-10 w-full gap-2 shadow-sm sm:w-auto">
                  <Save className="h-4 w-4" />
                  {isLoading ? 'Saving...' : (initialData ? 'Save Changes' : 'Save Faculty')}
                </Button>
              </DialogFooter>
          </form>
          </DialogContent>
      </Dialog>
      
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="sm:max-w-lg p-2 bg-transparent border-none shadow-none">
          <img src={imagePreview || ''} alt="Profile Preview Large" className="w-full h-auto rounded-lg object-contain max-h-[80vh]" />
        </DialogContent>
      </Dialog>
    </>
  );
}
