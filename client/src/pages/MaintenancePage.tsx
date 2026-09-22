export default function MaintenancePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 px-6 py-16">

      {/* Subtle decorative circles */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[560px] w-[560px] rounded-full bg-white/5" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-500/10" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white/10 shadow-2xl ring-1 ring-white/20 backdrop-blur-md">

        {/* Logo strip */}
        <div className="flex items-center justify-center rounded-t-2xl border-b border-white/10 bg-white/10 px-8 py-6">
          <img
            src="/sanitaslogo.png"
            alt="Sanitas Medical Recruitment"
            className="h-12 w-auto"
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

          <p className="mt-3 text-[15px] leading-relaxed text-brand-100/80">
            We're currently making improvements to the Sanitas CRM portal.
            The system will be back online shortly — we apologise for any
            inconvenience.
          </p>

          <div className="my-7 h-px w-full bg-white/10" />

          <p className="text-[13px] text-brand-200">
            If you need immediate assistance, please contact us directly:
          </p>

          <a
            href="tel:08009998222"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
              />
            </svg>
            0800 999 8222
          </a>
        </div>

        {/* Footer */}
        <div className="rounded-b-2xl border-t border-white/10 bg-white/5 px-8 py-4 text-center">
          <p className="text-[11px] uppercase tracking-wider text-brand-300">
            Sanitas Medical Recruitment &nbsp;·&nbsp; Essex &amp; London
          </p>
        </div>
      </div>

      {/* Copyright */}
      <p className="relative z-10 mt-8 text-[11px] text-brand-300/60">
        &copy; {new Date().getFullYear()} Sanitas Medical Recruitment. All rights reserved.
      </p>
    </div>
  );
}
