import logoAsset from "@/assets/eriksminde-logo.png.asset.json";

export function EriksmindeLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <img
        src={logoAsset.url}
        alt="Eriksminde"
        className="w-full max-w-[180px] h-auto"
      />
      <div
        className="font-serif text-[10px] text-[var(--brand-900)]/80"
        style={{ letterSpacing: "0.28em" }}
      >
        FAMILIEN GJØRUP
      </div>
    </div>
  );
}
