"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * LOOM brand mark. Renders a single image whose source follows the resolved
 * theme (bright-blue badge on light, deep-navy badge on dark), so a second
 * CSS-hidden image can never peek through next to it.
 */
export function BrandLogo({ className }: { className?: string }) {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return (
    <img
      src={dark ? "/brand/logo-dark.png" : "/brand/logo-light.png"}
      alt="LOOM"
      width={96}
      height={96}
      className={cn(className)}
      draggable={false}
    />
  );
}
