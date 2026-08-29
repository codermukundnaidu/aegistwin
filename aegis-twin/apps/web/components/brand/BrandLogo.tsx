type BrandLogoProps = {
  className?: string;
  compact?: boolean;
};

export function BrandLogo({ className = "", compact = false }: BrandLogoProps) {
  const classes = ["brand-logo", compact ? "compact" : "", className].filter(Boolean).join(" ");

  return (
    <img
      className={classes}
      src="/brand/aegis-twin-logo.png?v=3"
      alt="AEGIS-TWIN"
      loading="eager"
      decoding="async"
    />
  );
}
