"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Filter,
  Loader2,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import {
  type Amenity,
  type Hostel,
  adminHostelsApi,
  publicHostelsApi,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { HostelCard } from "@/components/hostels/hostel-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const GENDER_OPTIONS = [
  { value: "ALL", label: "Any" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "MIXED", label: "Mixed" },
];

const SORT_OPTIONS = [
  { value: "-created_at", label: "Newest" },
  { value: "created_at", label: "Oldest" },
];

export default function PublicHostelsPage() {
  const { isAuthenticated, user } = useAuth();

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [genderFilter, setGenderFilter] = useState("ALL");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<number[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("-created_at");

  useEffect(() => {
    adminHostelsApi.getAmenities().then(setAmenities).catch(() => {});
  }, []);

  const fetchHostels = useCallback(async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (genderFilter !== "ALL") qs.set("gender_policy", genderFilter);
      if (minPrice) qs.set("min_price", minPrice);
      if (maxPrice) qs.set("max_price", maxPrice);
      if (search) qs.set("search", search);
      if (ordering) qs.set("ordering", ordering);
      selectedAmenities.forEach((id) => qs.append("amenities", String(id)));

      const res = await publicHostelsApi.list(Object.fromEntries(qs));
      setHostels(res.results);
    } catch {
      toast.error("Failed to load hostels");
    } finally {
      setIsLoading(false);
    }
  }, [genderFilter, minPrice, maxPrice, selectedAmenities, search, ordering]);

  useEffect(() => {
    fetchHostels();
  }, [fetchHostels]);

  const toggleAmenity = (id: number) =>
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const clearAll = () => {
    setGenderFilter("ALL");
    setMinPrice("");
    setMaxPrice("");
    setSelectedAmenities([]);
    setSearch("");
    setSearchInput("");
    setOrdering("-created_at");
  };

  const activeFilterCount =
    (genderFilter !== "ALL" ? 1 : 0) +
    (minPrice || maxPrice ? 1 : 0) +
    selectedAmenities.length;

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (search) {
      chips.push({
        key: "search",
        label: `"${search}"`,
        onRemove: () => {
          setSearch("");
          setSearchInput("");
        },
      });
    }
    if (genderFilter !== "ALL") {
      chips.push({
        key: "gender",
        label:
          GENDER_OPTIONS.find((g) => g.value === genderFilter)?.label ??
          genderFilter,
        onRemove: () => setGenderFilter("ALL"),
      });
    }
    if (minPrice || maxPrice) {
      chips.push({
        key: "price",
        label: `GH₵ ${minPrice || 0} – ${maxPrice || "∞"}`,
        onRemove: () => {
          setMinPrice("");
          setMaxPrice("");
        },
      });
    }
    selectedAmenities.forEach((id) => {
      const a = amenities.find((x) => x.id === id);
      if (!a) return;
      chips.push({
        key: `amenity-${id}`,
        label: a.name,
        onRemove: () => toggleAmenity(id),
      });
    });
    return chips;
  }, [search, genderFilter, minPrice, maxPrice, selectedAmenities, amenities]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top chrome */}
      <TopChrome isAuthenticated={isAuthenticated} userRole={user?.role} />

      {/* Search + filters bar (sticky) */}
      <div className="sticky top-14 z-30 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSearch(searchInput);
              }}
              placeholder="Search hostels by name or location"
              className="w-full h-10 pl-10 pr-3 rounded-lg bg-muted ring-1 ring-transparent focus:bg-background focus:ring-primary/40 focus:outline-none text-sm transition-all"
            />
          </div>

          <button
            onClick={() => setDrawerOpen(true)}
            className="h-10 px-3 sm:px-4 flex items-center gap-2 rounded-lg ring-1 ring-border bg-card hover:bg-muted text-foreground text-sm font-medium transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="default" className="h-5 min-w-5 px-1 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <select
              value={ordering}
              onChange={(e) => setOrdering(e.target.value)}
              className="h-10 px-3 rounded-lg ring-1 ring-border bg-card text-sm font-medium text-foreground focus:outline-none focus:ring-primary/40"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="max-w-6xl mx-auto px-4 pb-3 flex items-center gap-2 flex-wrap">
            {activeChips.map((c) => (
              <button
                key={c.key}
                onClick={c.onRemove}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 ring-1 ring-primary/20 hover:bg-primary/15 rounded-full pl-2.5 pr-1.5 py-1 transition-colors"
              >
                {c.label}
                <X className="w-3 h-3" />
              </button>
            ))}
            <button
              onClick={clearAll}
              className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-xl font-semibold text-foreground">
            {isLoading
              ? "Loading hostels…"
              : hostels.length === 0
              ? "No hostels found"
              : `${hostels.length} hostel${hostels.length === 1 ? "" : "s"}`}
          </h1>
          <p className="hidden sm:block text-sm text-muted-foreground">
            Verified listings · mobile money accepted
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : hostels.length === 0 ? (
          <div className="text-center py-20 rounded-xl bg-card ring-1 ring-border">
            <MapPin className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-foreground">
              Nothing matches those filters
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try removing a filter, or widen your price range.
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAll}
                className="mt-5 text-sm font-medium text-primary hover:text-primary/80"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {hostels.map((h) => (
              <HostelCard key={h.id} hostel={h} />
            ))}
          </div>
        )}
      </div>

      {/* Filters drawer */}
      <FiltersDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        genderFilter={genderFilter}
        setGenderFilter={setGenderFilter}
        minPrice={minPrice}
        setMinPrice={setMinPrice}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        amenities={amenities}
        selectedAmenities={selectedAmenities}
        toggleAmenity={toggleAmenity}
        onClear={clearAll}
      />
    </div>
  );
}

function TopChrome({
  isAuthenticated,
  userRole,
}: {
  isAuthenticated: boolean;
  userRole?: string;
}) {
  const dashboardHref =
    userRole === "STUDENT"
      ? "/student/dashboard"
      : userRole === "HOSTEL_ADMIN"
      ? "/admin/dashboard"
      : userRole === "SUPER_ADMIN"
      ? "/superadmin/dashboard"
      : "/";

  return (
    <header className="sticky top-0 z-40 h-14 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-6xl mx-auto h-full px-4 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
            H
          </div>
          <span className="font-semibold tracking-tight text-foreground">
            HostelHub
          </span>
        </Link>
        <nav className="ml-4 hidden sm:flex items-center gap-5 text-sm font-medium text-muted-foreground">
          <Link href="/hostels" className="text-foreground">
            Browse
          </Link>
          <Link href="/#how-it-works" className="hover:text-foreground transition-colors">
            How it works
          </Link>
        </nav>
        <div className="flex-1" />
        {isAuthenticated ? (
          <Link
            href={dashboardHref}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            My dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/student/login"
              className="hidden sm:inline text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Button asChild>
              <Link href="/student/login">Get started</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

function FiltersDrawer({
  open,
  onClose,
  genderFilter,
  setGenderFilter,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  amenities,
  selectedAmenities,
  toggleAmenity,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  genderFilter: string;
  setGenderFilter: (v: string) => void;
  minPrice: string;
  setMinPrice: (v: string) => void;
  maxPrice: string;
  setMaxPrice: (v: string) => void;
  amenities: Amenity[];
  selectedAmenities: number[];
  toggleAmenity: (id: number) => void;
  onClear: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <aside className="relative w-full sm:max-w-sm bg-background h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="sticky top-0 bg-background border-b border-border px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Filters</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-8">
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Gender policy
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {GENDER_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGenderFilter(g.value)}
                  className={`h-9 rounded-lg text-sm font-medium ring-1 transition-colors ${
                    genderFilter === g.value
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-card text-foreground ring-border hover:ring-primary/40"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Price range (GH₵ / year)
            </h3>
            <div className="flex items-center gap-2">
              <input
                inputMode="numeric"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ""))}
                className="w-full h-10 px-3 rounded-lg bg-muted ring-1 ring-border text-sm focus:outline-none focus:ring-primary/40 focus:bg-background"
              />
              <span className="text-muted-foreground text-sm">–</span>
              <input
                inputMode="numeric"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
                className="w-full h-10 px-3 rounded-lg bg-muted ring-1 ring-border text-sm focus:outline-none focus:ring-primary/40 focus:bg-background"
              />
            </div>
          </section>

          {amenities.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Amenities
              </h3>
              <div className="flex flex-wrap gap-2">
                {amenities.map((a) => {
                  const selected = selectedAmenities.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleAmenity(a.id)}
                      className={`h-8 px-3 rounded-full text-xs font-medium ring-1 transition-colors ${
                        selected
                          ? "bg-primary/10 text-primary ring-primary/30"
                          : "bg-card text-foreground ring-border hover:ring-primary/40"
                      }`}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="sticky bottom-0 bg-background border-t border-border p-4 flex items-center gap-3">
          <button
            onClick={() => {
              onClear();
            }}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
          <div className="flex-1" />
          <Button onClick={onClose} size="lg">
            Show results
          </Button>
        </div>
      </aside>
    </div>
  );
}
