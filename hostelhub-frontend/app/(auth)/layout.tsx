import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — illustrated side */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900">
        {/* Decorative blobs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-400/10 rounded-full blur-2xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center font-bold text-lg">
              H
            </div>
            <span className="font-bold text-xl tracking-tight">HostelHub</span>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight">
              Find your perfect<br />
              <span className="text-indigo-300">student home.</span>
            </h1>
            <p className="text-indigo-200/80 text-lg leading-relaxed max-w-sm">
              Browse verified hostels near your university, compare prices, and book
              with mobile money — all in one place.
            </p>

            {/* Stats */}
            <div className="flex gap-8 pt-4">
              {[
                { label: "Verified Hostels", value: "50+" },
                { label: "Happy Students", value: "1,000+" },
                { label: "Universities", value: "5+" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-indigo-300/70 text-xs mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer quote */}
          <div className="border-t border-white/10 pt-6">
            <p className="text-indigo-200/60 text-sm italic">
              &ldquo;I found my room before arriving on campus. No more walking around looking.&rdquo;
            </p>
            <p className="text-indigo-300/80 text-xs mt-2">— Ama, Level 100 Student</p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
