import { cn } from "@/lib/utils";

/**
 * LOOM brand mark. Swaps automatically with the app theme:
 * bright-blue badge on light theme, deep-navy badge on dark theme.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/brand/logo-light.png"
        alt="LOOM"
        width={96}
        height={96}
        className={cn("dark:hidden", className)}
      />
      <img
        src="/brand/logo-dark.png"
        alt="LOOM"
        width={96}
        height={96}
        className={cn("hidden dark:block", className)}
      />
    </>
  );
}
