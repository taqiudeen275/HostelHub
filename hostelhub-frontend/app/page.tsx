import Link from "next/link";
import { ArrowRight, ShieldCheck, MapPin, Wallet, Users, Search, Star, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
              H
            </div>
            <span className="font-bold text-xl tracking-tight">HostelHub</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</Link>
            <Link href="/admin/login" className="hover:text-foreground transition-colors">For Partners</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/student/login"
              className="px-5 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-full transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/student/login"
              className="hidden sm:flex items-center gap-2 px-5 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/25"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        {/* Dynamic Background Blobs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[100px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="container mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Now live at UTAS Campuse
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 fill-mode-both">
            Find your perfect <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
              student home.
            </span>
          </h1>
          
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 fill-mode-both">
            Browse verified hostels, compare prices, view room videos, and book securely with Mobile Money. No agents. No stress.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 fill-mode-both">
            <Link
              href="/hostels"
              className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-primary/30 group"
            >
              <Search className="w-5 h-5 group-hover:animate-bounce" />
              Find a Hostel
            </Link>
            <Link
              href="/admin/login"
              className="w-full sm:w-auto px-8 py-4 bg-secondary text-secondary-foreground rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all hover:scale-105 active:scale-95"
            >
              <Building2 className="w-5 h-5" />
              List Your Property
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="mt-16 pt-10 border-t border-border/50 max-w-3xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-1000 delay-500 fill-mode-both">
            {[
              { label: "Verified Hostels", value: "200+" },
              { label: "Happy Students", value: "5,000+" },
              { label: "Universities", value: "5" },
              { label: "Support", value: "24/7" },
            ].map((stat) => (
              <div key={stat.label} className="text-center space-y-1">
                <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm font-medium text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Why students love us</h2>
            <p className="text-muted-foreground text-lg text-balance">
              We've rebuilt the accommodation experience from the ground up to be safe, transparent, and built for students.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: ShieldCheck,
                title: "100% Verified Listings",
                description: "Every hostel on our platform is physically inspected. Say goodbye to scams and fake pictures.",
                color: "text-emerald-500",
                bg: "bg-emerald-500/10",
              },
              {
                icon: Wallet,
                title: "Secure MoMo Payments",
                description: "Pay your rent directly through the app using MTN MoMo, Telecel, or card. Instant receipts generated.",
                color: "text-blue-500",
                bg: "bg-blue-500/10",
              },
              {
                icon: Users,
                title: "Roommate Matching",
                description: "Don't want to live with strangers? See profiles of potential roommates before you book a shared room.",
                color: "text-purple-500",
                bg: "bg-purple-500/10",
              },
            ].map((feature, idx) => (
              <div 
                key={idx} 
                className="group relative p-8 rounded-3xl bg-background border hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1"
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110", feature.bg, feature.color)}>
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 -skew-y-3 transform-gpu" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
            <div className="flex gap-1 text-yellow-400 mb-8">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 fill-current" />
              ))}
            </div>
            <p className="text-2xl md:text-4xl font-medium tracking-tight mb-8 leading-snug">
              "Finding a hostel used to involve walking in the hot sun for days. With HostelHub, I viewed videos of my room and paid my deposit from my bed. Absolute game changer."
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                J
              </div>
              <div className="text-left">
                <div className="font-bold text-foreground">Josephine Acheampong</div>
                <div className="text-sm text-muted-foreground">Level 300, KNUST</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="border-t bg-background pt-24 pb-12">
        <div className="container mx-auto px-6 text-center max-w-3xl mb-24">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Ready to move in?</h2>
          <p className="text-xl text-muted-foreground mb-10">Join thousands of students finding their perfect space effortlessly.</p>
          <Link
            href="/student/login"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-foreground text-background rounded-2xl font-semibold text-lg hover:bg-foreground/90 transition-all hover:scale-105 active:scale-95 shadow-xl"
          >
            Create Free Account
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        <div className="container mx-auto px-6 border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
              H
            </div>
            <span className="font-semibold text-foreground">HostelHub Ghana</span>
          </div>
          <p>© {new Date().getFullYear()} HostelHub Ltd. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-foreground">Privacy</Link>
            <Link href="#" className="hover:text-foreground">Terms</Link>
            <Link href="#" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
