import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerApi } from "@/app/services/customerApi";

import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { FieldError } from "@/app/components/shared/FieldError";
import { toast } from "sonner";
import { Loader2, Plus, Building2, UserRound, MapPin, Stethoscope, Search, Check, ChevronRight } from "lucide-react";
import { cn } from "@/app/helpers/utils";
import { ScrollArea } from "@/app/components/ui/scroll-area";

interface CustomerMedicalReferenceProps {
  title?: string;
  hospitalId: string;
  setHospitalId: (val: string) => void;
  doctorId: string;
  setDoctorId: (val: string) => void;
  referenceNumber: string;
  setReferenceNumber: (val: string) => void;
}

export function CustomerMedicalReference({
  title = "Medical Reference Details",
  hospitalId,
  setHospitalId,
  doctorId,
  setDoctorId,
  referenceNumber,
  setReferenceNumber,
}: CustomerMedicalReferenceProps) {
  const queryClient = useQueryClient();

  const [activeView, setActiveView] = useState<"main" | "select_hospital" | "add_hospital" | "select_doctor" | "add_doctor">("main");

  const [newHospitalName, setNewHospitalName] = useState("");
  const [newHospitalCity, setNewHospitalCity] = useState("");

  const [newDoctorName, setNewDoctorName] = useState("");
  const [newDoctorSpec, setNewDoctorSpec] = useState("");
  
  const [hospitalSearch, setHospitalSearch] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");

  const [hospitalFieldErrors, setHospitalFieldErrors] = useState<Record<string, string>>({});
  const [doctorFieldErrors, setDoctorFieldErrors] = useState<Record<string, string>>({});

  const clearHospitalFieldError = (key: string) => {
    setHospitalFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearDoctorFieldError = (key: string) => {
    setDoctorFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const { data: hospitals = [], isLoading: loadingHospitals } = useQuery({
    queryKey: ["hospitals"],
    queryFn: () => customerApi.searchHospitals(""),
  });

  const { data: doctors = [], isLoading: loadingDoctors } = useQuery({
    queryKey: ["doctors", hospitalId],
    queryFn: () => customerApi.searchDoctors(hospitalId || undefined, ""),
    enabled: !!hospitalId,
  });

  const selectedHospital = useMemo(() => hospitals.find(h => h.id === hospitalId), [hospitals, hospitalId]);
  const selectedDoctor = useMemo(() => doctors.find(d => d.id === doctorId), [doctors, doctorId]);

  const filteredHospitals = useMemo(() => {
    if (!hospitalSearch.trim()) return hospitals;
    const term = hospitalSearch.toLowerCase();
    return hospitals.filter(h => h.name.toLowerCase().includes(term) || h.city?.toLowerCase().includes(term));
  }, [hospitals, hospitalSearch]);

  const filteredDoctors = useMemo(() => {
    if (!doctorSearch.trim()) return doctors;
    const term = doctorSearch.toLowerCase();
    return doctors.filter(d => d.fullName.toLowerCase().includes(term) || d.specialization?.toLowerCase().includes(term));
  }, [doctors, doctorSearch]);

  const createHospitalMut = useMutation({
    mutationFn: () => customerApi.createHospital({ name: newHospitalName, city: newHospitalCity }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
      setHospitalId(res.id);
      setActiveView("main");
      setNewHospitalName("");
      setNewHospitalCity("");
      toast.success("Hospital added successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create hospital"),
  });

  const handleCreateHospital = () => {
    if (!newHospitalName.trim()) {
      setHospitalFieldErrors({ name: "Please enter the hospital name." });
      toast.error("Please fill in the required fields.");
      return;
    }
    setHospitalFieldErrors({});
    createHospitalMut.mutate();
  };

  const createDoctorMut = useMutation({
    mutationFn: () => customerApi.createDoctor({
      hospitalId,
      fullName: newDoctorName,
      specialization: newDoctorSpec,
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      setDoctorId(res.id);
      setActiveView("main");
      setNewDoctorName("");
      setNewDoctorSpec("");
      toast.success("Doctor added successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create doctor"),
  });

  const handleCreateDoctor = () => {
    if (!hospitalId) {
      toast.error("Please select a hospital first.");
      return;
    }
    if (!newDoctorName.trim()) {
      setDoctorFieldErrors({ name: "Please enter the doctor's full name." });
      toast.error("Please fill in the required fields.");
      return;
    }
    setDoctorFieldErrors({});
    createDoctorMut.mutate();
  };

  // --- Main View ---
  if (activeView === "main") {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-lg font-bold text-slate-900">{title}</p>
          <p className="text-sm text-slate-500">
            Select or add the hospital and doctor details for your prescription.
          </p>
          <p className="text-xs text-slate-500">
            Fields marked <span className="text-destructive">*</span> are required.
          </p>
        </div>

        <div className="space-y-4">
          {/* Hospital Selection Card */}
          <div className="space-y-2">
            <Label required className="text-sm font-semibold text-slate-700 ml-1">1. Hospital / Clinic</Label>
            <div 
              onClick={() => setActiveView("select_hospital")}
              className={cn(
                "group relative overflow-hidden rounded-2xl border transition-all cursor-pointer hover:shadow-md",
                selectedHospital ? "bg-white border-blue-200" : "bg-slate-50/50 border-dashed border-slate-300 hover:bg-slate-50 hover:border-blue-300"
              )}
            >
              <div className="flex items-center p-4">
                <div className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
                  selectedHospital ? "bg-blue-100 text-blue-600" : "bg-white text-slate-400 border border-slate-200 group-hover:text-blue-500"
                )}>
                  {selectedHospital ? <Building2 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                </div>
                
                <div className="ml-4 flex-1">
                  {selectedHospital ? (
                    <>
                      <p className="font-semibold text-slate-900">{selectedHospital.name}</p>
                      {selectedHospital.city && (
                        <p className="text-sm text-slate-500 flex items-center mt-0.5">
                          <MapPin className="mr-1 h-3.5 w-3.5" />
                          {selectedHospital.city}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-slate-700 group-hover:text-blue-700 transition-colors">Select a Hospital</p>
                      <p className="text-sm text-slate-500 mt-0.5">Click to search or add new</p>
                    </>
                  )}
                </div>
                
                <Button variant="ghost" size="icon" className="shrink-0 text-slate-400 group-hover:text-blue-600 rounded-full h-8 w-8 pointer-events-none">
                  {selectedHospital ? <ChevronRight className="h-5 w-5" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Doctor Selection Card */}
          <div className="space-y-2">
            <Label required className="text-sm font-semibold text-slate-700 ml-1">2. Doctor</Label>
            <div 
              onClick={() => {
                if (!hospitalId) {
                  toast.error("Please select a hospital first.");
                  return;
                }
                setActiveView("select_doctor");
              }}
              className={cn(
                "group relative overflow-hidden rounded-2xl border transition-all cursor-pointer hover:shadow-md",
                !hospitalId ? "opacity-60 cursor-not-allowed bg-slate-50 border-slate-200" : 
                selectedDoctor ? "bg-white border-blue-200" : "bg-slate-50/50 border-dashed border-slate-300 hover:bg-slate-50 hover:border-blue-300"
              )}
            >
              <div className="flex items-center p-4">
                <div className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
                  selectedDoctor ? "bg-emerald-100 text-emerald-600" : "bg-white text-slate-400 border border-slate-200 group-hover:text-blue-500"
                )}>
                  {selectedDoctor ? <UserRound className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                </div>
                
                <div className="ml-4 flex-1">
                  {selectedDoctor ? (
                    <>
                      <p className="font-semibold text-slate-900">{selectedDoctor.fullName}</p>
                      {selectedDoctor.specialization && (
                        <p className="text-sm text-slate-500 flex items-center mt-0.5">
                          <Stethoscope className="mr-1 h-3.5 w-3.5" />
                          {selectedDoctor.specialization}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-slate-700 group-hover:text-blue-700 transition-colors">Select a Doctor</p>
                      <p className="text-sm text-slate-500 mt-0.5">{hospitalId ? "Click to search or add new" : "Select hospital first"}</p>
                    </>
                  )}
                </div>
                
                <Button variant="ghost" size="icon" className="shrink-0 text-slate-400 group-hover:text-blue-600 rounded-full h-8 w-8 pointer-events-none">
                  {selectedDoctor ? <ChevronRight className="h-5 w-5" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="space-y-2 pt-2">
            <Label className="text-sm font-semibold text-slate-700 ml-1">3. Reference Number (Optional)</Label>
            <Input 
              className="bg-white/80 border-slate-200 rounded-xl h-11 px-4 shadow-sm focus-visible:ring-blue-500/30 transition-all" 
              placeholder="e.g. REF-12345" 
              value={referenceNumber} 
              onChange={e => setReferenceNumber(e.target.value)} 
            />
          </div>
        </div>
      </div>
    );
  }

  // --- Select Hospital View ---
  if (activeView === "select_hospital") {
    return (
      <div className="space-y-4 flex flex-col h-full max-h-[500px]">
        <div className="flex items-center justify-between pb-2 border-b">
          <p className="text-lg font-bold text-slate-900">Select Hospital</p>
          <Button variant="ghost" size="sm" onClick={() => setActiveView("main")}>Back</Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input 
            className="pl-9 h-11 rounded-xl bg-slate-50 border-slate-200" 
            placeholder="Search hospitals by name or city..." 
            value={hospitalSearch}
            onChange={(e) => setHospitalSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-1 -mx-2 px-2 h-[300px]">
          {loadingHospitals ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500 space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <p className="text-sm">Loading hospitals...</p>
            </div>
          ) : filteredHospitals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center space-y-3 px-4">
              <Building2 className="h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">No hospitals found matching "{hospitalSearch}"</p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {filteredHospitals.map((h) => (
                <div 
                  key={h.id}
                  onClick={() => {
                    setHospitalId(h.id);
                    setDoctorId(""); // Reset doctor
                    setActiveView("main");
                  }}
                  className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-blue-100 hover:bg-blue-50/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100/50 flex items-center justify-center text-blue-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{h.name}</p>
                      {h.city && <p className="text-xs text-slate-500 flex items-center mt-0.5"><MapPin className="mr-1 h-3 w-3" />{h.city}</p>}
                    </div>
                  </div>
                  {hospitalId === h.id && <Check className="h-5 w-5 text-blue-600" />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="pt-3 border-t">
          <Button 
            variant="outline" 
            className="w-full h-11 rounded-xl border-dashed border-blue-200 text-blue-700 bg-blue-50/30 hover:bg-blue-50 hover:border-blue-300"
            onClick={() => {
              setNewHospitalName(hospitalSearch);
              setHospitalFieldErrors({});
              setActiveView("add_hospital");
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add a New Hospital
          </Button>
        </div>
      </div>
    );
  }

  // --- Add Hospital View ---
  if (activeView === "add_hospital") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b">
          <p className="text-lg font-bold text-slate-900">Add New Hospital</p>
          <Button variant="ghost" size="sm" onClick={() => setActiveView("select_hospital")}>Back</Button>
        </div>

        <p className="text-xs text-slate-500">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100/50 space-y-4 shadow-sm">
          <div className="space-y-2">
            <Label required className="text-sm font-semibold text-slate-800">Hospital Name</Label>
            <Input 
              className={cn(
                "bg-white border-white/40 shadow-sm h-11 rounded-xl focus-visible:ring-blue-500/30",
                hospitalFieldErrors.name ? "border-destructive" : ""
              )}
              placeholder="e.g. Apollo General Hospital" 
              value={newHospitalName} 
              onChange={e => {
                setNewHospitalName(e.target.value);
                clearHospitalFieldError("name");
              }} 
              autoFocus
            />
            <FieldError message={hospitalFieldErrors.name} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-800">City (Optional)</Label>
            <Input 
              className="bg-white border-white/40 shadow-sm h-11 rounded-xl focus-visible:ring-blue-500/30" 
              placeholder="e.g. Mumbai" 
              value={newHospitalCity} 
              onChange={e => setNewHospitalCity(e.target.value)} 
            />
          </div>
        </div>

        <Button 
          size="lg" 
          className="w-full h-12 rounded-xl text-base bg-blue-600 hover:bg-blue-700 shadow-sm transition-all hover:shadow-md" 
          onClick={handleCreateHospital} 
          disabled={createHospitalMut.isPending}
        >
          {createHospitalMut.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Building2 className="h-5 w-5 mr-2" />} 
          Save & Select Hospital
        </Button>
      </div>
    );
  }

  // --- Select Doctor View ---
  if (activeView === "select_doctor") {
    return (
      <div className="space-y-4 flex flex-col h-full max-h-[500px]">
        <div className="flex items-center justify-between pb-2 border-b">
          <p className="text-lg font-bold text-slate-900">Select Doctor</p>
          <Button variant="ghost" size="sm" onClick={() => setActiveView("main")}>Back</Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input 
            className="pl-9 h-11 rounded-xl bg-slate-50 border-slate-200" 
            placeholder="Search doctors by name or specialization..." 
            value={doctorSearch}
            onChange={(e) => setDoctorSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-1 -mx-2 px-2 h-[300px]">
          {loadingDoctors ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500 space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <p className="text-sm">Loading doctors...</p>
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center space-y-3 px-4">
              <UserRound className="h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">No doctors found matching "{doctorSearch}"</p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {filteredDoctors.map((d) => (
                <div 
                  key={d.id}
                  onClick={() => {
                    setDoctorId(d.id);
                    setActiveView("main");
                  }}
                  className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-emerald-100 hover:bg-emerald-50/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-100/50 flex items-center justify-center text-emerald-600">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{d.fullName}</p>
                      {d.specialization && <p className="text-xs text-slate-500 flex items-center mt-0.5"><Stethoscope className="mr-1 h-3 w-3" />{d.specialization}</p>}
                    </div>
                  </div>
                  {doctorId === d.id && <Check className="h-5 w-5 text-emerald-600" />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="pt-3 border-t">
          <Button 
            variant="outline" 
            className="w-full h-11 rounded-xl border-dashed border-emerald-200 text-emerald-700 bg-emerald-50/30 hover:bg-emerald-50 hover:border-emerald-300"
            onClick={() => {
              setNewDoctorName(doctorSearch);
              setDoctorFieldErrors({});
              setActiveView("add_doctor");
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add a New Doctor
          </Button>
        </div>
      </div>
    );
  }

  // --- Add Doctor View ---
  if (activeView === "add_doctor") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b">
          <p className="text-lg font-bold text-slate-900">Add New Doctor</p>
          <Button variant="ghost" size="sm" onClick={() => setActiveView("select_doctor")}>Back</Button>
        </div>

        <p className="text-xs text-slate-500">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-100/50 space-y-4 shadow-sm">
          <div className="space-y-2">
            <Label required className="text-sm font-semibold text-slate-800">Doctor Full Name</Label>
            <Input 
              className={cn(
                "bg-white border-white/40 shadow-sm h-11 rounded-xl focus-visible:ring-emerald-500/30",
                doctorFieldErrors.name ? "border-destructive" : ""
              )}
              placeholder="e.g. Dr. Jane Smith" 
              value={newDoctorName} 
              onChange={e => {
                setNewDoctorName(e.target.value);
                clearDoctorFieldError("name");
              }} 
              autoFocus
            />
            <FieldError message={doctorFieldErrors.name} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-800">Specialization (Optional)</Label>
            <Input 
              className="bg-white border-white/40 shadow-sm h-11 rounded-xl focus-visible:ring-emerald-500/30" 
              placeholder="e.g. Cardiologist" 
              value={newDoctorSpec} 
              onChange={e => setNewDoctorSpec(e.target.value)} 
            />
          </div>
        </div>

        <Button 
          size="lg" 
          className="w-full h-12 rounded-xl text-base bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all hover:shadow-md" 
          onClick={handleCreateDoctor} 
          disabled={createDoctorMut.isPending}
        >
          {createDoctorMut.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <UserRound className="h-5 w-5 mr-2" />} 
          Save & Select Doctor
        </Button>
      </div>
    );
  }

  return null;
}
