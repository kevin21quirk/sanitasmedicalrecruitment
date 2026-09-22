export default function MaintenancePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 px-6 py-16">

      {/* Subtle decorative circles */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[560px] w-[560px] rounded-full bg-white/5" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-500/10" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white/10 shadow-2xl ring-1 ring-white/20 backdrop-blur-md">

        {/* Logo strip — solid white so the logo renders crisply */}
        <div className="flex items-center justify-center rounded-t-2xl bg-white px-8 py-6">
          <img
            src="/sanitaslogo.png"
            alt="Sanitas Medical Recruitment"
            className="h-14 w-auto"
          />
        </div>

        {/* Body */}
        <div className="px-8 py-10 text-center">
          {/* Status indicator */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent-500/20 ring-4 ring-accent-500/30">
            <svg
              className="h-8 w-8 text-accent-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.654-4.654m5.657-5.657 1.97-1.97a3 3 0 0 1 4.243 4.243l-1.97 1.97M9.322 4.82l3.03 2.497.766 1.208-.766-1.208-3.03-2.497ZM3 3l1.5 1.5"
              />
            </svg>
          </div>

          <h1 className="font-display text-2xl font-semibold text-white">
            Portal Temporarily Unavailable
          </h1>
        </div>
      </div>
    </div>
  );
}
