export function EriksmindeLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div
        className="font-serif text-[var(--brand-900)] text-xl"
        style={{ letterSpacing: "0.22em" }}
      >
        ERIKSMINDE
      </div>
      <svg width="120" height="10" viewBox="0 0 120 10" className="text-[var(--brand-500)]">
        <path
          d="M2 5 Q 12 0 22 5 T 42 5 T 62 5 T 82 5 T 102 5 T 118 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <div
        className="font-serif text-[10px] text-[var(--brand-900)]/80"
        style={{ letterSpacing: "0.28em" }}
      >
        FAMILIEN GJØRUP
      </div>
    </div>
  );
}
