"use client";

import React, { useEffect, useRef, useState } from "react";

type RevealProps = {
  as?: keyof JSX.IntrinsicElements;
  children: React.ReactNode;
  className?: string;
  /** fade | slideUp | slideIn */
  variant?: "fade" | "slideUp" | "slideIn";
  delayMs?: number;
};

export function Reveal({ as = "div", children, className = "", variant = "slideUp", delayMs = 0 }: RevealProps) {
  const Comp: any = as;
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desktop = window.matchMedia("(min-width: 768px)").matches && window.matchMedia("(pointer: fine)").matches;
    if (reduce || !desktop) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          if (delayMs > 0) {
            const t = setTimeout(() => setShown(true), delayMs);
            (el as any)._rvt = t;
          } else {
            setShown(true);
          }
          obs.disconnect();
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });
    obs.observe(el);
    return () => {
      obs.disconnect();
      const t = (el as any)?._rvt;
      if (t) clearTimeout(t);
    };
  }, [delayMs]);

  const baseHidden = variant === "fade"
    ? "opacity-0"
    : variant === "slideIn"
      ? "opacity-0 translate-x-3"
      : "opacity-0 translate-y-3"; // slideUp

  const baseShown = variant === "fade"
    ? "animate-fade-in"
    : variant === "slideIn"
      ? "animate-slide-in"
      : "animate-slide-up";

  return (
    <Comp ref={ref} className={`${shown ? baseShown : baseHidden} ${className}`}> 
      {children}
    </Comp>
  );
}
