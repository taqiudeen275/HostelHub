"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, User, Building, Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { authApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminGlobalSettingsPage() {
  const { user, refreshUser } = useAuth();
  
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    business_name: "",
    whatsapp_number: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        business_name: user.hostel_admin_profile?.business_name || "",
        whatsapp_number: user.hostel_admin_profile?.whatsapp_number || "",
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Parallel update to me endpoint and admin-profile endpoint
      await Promise.all([
        authApi.updateMe({
          first_name: formData.first_name,
          last_name: formData.last_name,
        }),
        authApi.updateAdminProfile({
          business_name: formData.business_name,
          whatsapp_number: formData.whatsapp_number,
        }),
      ]);
      
      await refreshUser();
      toast.success("Profile updated successfully.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Global Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal account and business details.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Personal Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Personal Details
            </CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                placeholder="Doe"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Phone Number (Read-only)</Label>
              <Input
                value={user.phone}
                disabled
                className="bg-muted text-muted-foreground"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Your phone number is used for login and cannot be changed.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Business Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" /> Business Details
            </CardTitle>
            <CardDescription>
              Information about your hostel management business.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="business_name">Business/Company Name</Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={handleChange}
                placeholder="e.g. Acme Properties Ltd"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="whatsapp_number">Business WhatsApp Number</Label>
              <Input
                id="whatsapp_number"
                value={formData.whatsapp_number}
                onChange={handleChange}
                placeholder="+233 24 000 0000"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Used for general business inquiries across your portfolio.
              </p>
            </div>
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
