"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building, Info, Loader2, Phone, MapPin, Save } from "lucide-react";

import { adminHostelsApi, type Amenity, type CreateHostelPayload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export default function HostelSettingsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [allAmenities, setAllAmenities] = useState<Amenity[]>([]);
  const [hostelStatus, setHostelStatus] = useState<string>("");

  const [formData, setFormData] = useState<Partial<CreateHostelPayload>>({
    name: "",
    description: "",
    address_text: "",
    gender_policy: "MIXED",
    owner_contact_phone: "",
    owner_contact_whatsapp: "",
    amenity_ids: [],
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [hostel, amenitiesRes] = await Promise.all([
          adminHostelsApi.get(id),
          adminHostelsApi.getAmenities(),
        ]);
        
        setAllAmenities(amenitiesRes);
        setHostelStatus(hostel.status);

        setFormData({
          name: hostel.name,
          description: hostel.description,
          address_text: hostel.address_text,
          gender_policy: hostel.gender_policy,
          owner_contact_phone: hostel.owner_contact_phone || "",
          owner_contact_whatsapp: hostel.owner_contact_whatsapp || "",
          amenity_ids: hostel.amenities.map((a) => (typeof a === "number" ? a : a.id)),
        });
      } catch (err) {
        toast.error("Could not load hostel settings.");
        router.push("/admin/hostels");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const toggleAmenity = (amenityId: number, checked: boolean) => {
    setFormData((prev) => {
      const currentIds = prev.amenity_ids || [];
      if (checked) {
        return { ...prev, amenity_ids: [...currentIds, amenityId] };
      } else {
        return { ...prev, amenity_ids: currentIds.filter((id) => id !== amenityId) };
      }
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await adminHostelsApi.update(id, formData);
      toast.success("Hostel settings updated successfully.");
      
      // If the hostel was APPROVED and core fields changed, it might be PENDING now
      // Re-fetch to update status indicator
      const updated = await adminHostelsApi.get(id);
      setHostelStatus(updated.status);
      if (updated.status === "PENDING" && hostelStatus === "APPROVED") {
        toast.info("Your hostel has been sent back for review due to core profile changes.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to update hostel settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hostel Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update your property's public profile and contact details.
        </p>
      </div>

      {hostelStatus === "APPROVED" && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-300 flex gap-3 items-start">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            <strong>Note:</strong> Your hostel is currently <strong>APPROVED</strong>. Changing core fields (Name, Address, or Contact Phone) will automatically pause your listing and place it back into the review queue for moderation.
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" /> Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Hostel Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g. Evandy Hostel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={handleChange}
                required
                placeholder="Describe your property..."
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender_policy">Gender Policy</Label>
              <Select
                value={formData.gender_policy}
                onValueChange={(val: any) => setFormData((prev) => ({ ...prev, gender_policy: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select policy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MIXED">Mixed (Male & Female)</SelectItem>
                  <SelectItem value="MALE">Male Only</SelectItem>
                  <SelectItem value="FEMALE">Female Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Location & Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" /> Location & Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address_text">Street Address</Label>
              <Input
                id="address_text"
                value={formData.address_text}
                onChange={handleChange}
                required
                placeholder="e.g. 123 KNUST Road, Ayeduase"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner_contact_phone">Primary Phone (For Students)</Label>
                <Input
                  id="owner_contact_phone"
                  value={formData.owner_contact_phone}
                  onChange={handleChange}
                  required
                  placeholder="+233 24 000 0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner_contact_whatsapp">WhatsApp Number (Optional)</Label>
                <Input
                  id="owner_contact_whatsapp"
                  value={formData.owner_contact_whatsapp}
                  onChange={handleChange}
                  placeholder="+233 24 000 0000"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Amenities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Amenities</CardTitle>
            <CardDescription>Select all the amenities available at your property.</CardDescription>
          </CardHeader>
          <CardContent>
            {allAmenities.length === 0 ? (
              <div className="text-sm text-muted-foreground">Loading amenities...</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
                {allAmenities.map((amenity) => (
                  <div key={amenity.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`amenity-${amenity.id}`}
                      checked={formData.amenity_ids?.includes(amenity.id) || false}
                      onCheckedChange={(checked) => toggleAmenity(amenity.id, checked as boolean)}
                    />
                    <Label
                      htmlFor={`amenity-${amenity.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {amenity.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
