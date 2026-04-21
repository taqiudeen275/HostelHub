"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminHostelsApi, Amenity } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, Save, Check } from "lucide-react";
import Link from "next/link";

export default function CreateHostelPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amenities, setAmenities] = useState<Amenity[]>([]);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [genderPolicy, setGenderPolicy] = useState<"MALE" | "FEMALE" | "MIXED">("MIXED");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<Set<number>>(new Set());

  useEffect(() => {
    adminHostelsApi.getAmenities().then(setAmenities).catch(console.error);
  }, []);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !address || !phone) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setStep(2);
  };

  const toggleAmenity = (id: number) => {
    const newSet = new Set(selectedAmenities);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedAmenities(newSet);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await adminHostelsApi.create({
        name,
        description,
        address_text: address,
        latitude: null,
        longitude: null,
        gender_policy: genderPolicy,
        owner_contact_phone: phone,
        owner_contact_whatsapp: whatsapp || null,
        amenity_ids: Array.from(selectedAmenities)
      });
      toast.success("Hostel created successfully and is pending approval.");
      router.push("/admin/hostels");
    } catch (err: any) {
      toast.error(err.message || "Failed to create hostel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/hostels" className="p-2 border rounded-md hover:bg-muted text-muted-foreground w-10 h-10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Add New Hostel</h1>
          <p className="text-sm text-muted-foreground">Step {step} of 2</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8">
        {step === 1 && (
          <form onSubmit={handleNext} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-medium mb-1">Hostel Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Unity Hall Annex"
                className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description *</label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the hostel, its vibe, and key selling points..."
                className="w-full flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Address *</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Tech Junction, behind the generic mall"
                className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Gender Policy *</label>
                <select
                  value={genderPolicy}
                  onChange={(e) => setGenderPolicy(e.target.value as any)}
                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="MIXED">Mixed</option>
                  <option value="MALE">Male Only</option>
                  <option value="FEMALE">Female Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Contact Phone *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+233..."
                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">WhatsApp Number (Optional)</label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+233..."
                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-6 rounded-md font-medium transition-colors"
              >
                Next Step
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-4">
              <h3 className="text-lg font-medium">Select Amenities</h3>
              <p className="text-sm text-muted-foreground">What features does this entire hostel provide? (You can add room-specific features later)</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {amenities.map(amenity => {
                const isSelected = selectedAmenities.has(amenity.id);
                return (
                  <button
                    key={amenity.id}
                    onClick={() => toggleAmenity(amenity.id)}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all relative ${
                      isSelected 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' 
                        : 'border-transparent bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 flex bg-indigo-600 text-white rounded-full p-0.5 shadow-sm">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                    <span className="text-sm font-medium mt-2">{amenity.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-2 border bg-white hover:bg-gray-50 h-10 px-6 rounded-md font-medium transition-colors"
                disabled={isSubmitting}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-6 rounded-md font-medium transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Submit Hostel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
