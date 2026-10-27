"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { SpoilerProvider } from "@/components/spoilers";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <SpoilerProvider>{children}</SpoilerProvider>
    </ThemeProvider>
  );
}
