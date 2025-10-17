import type { ReactNode } from "react";
import { HelmetProvider } from "react-helmet-async";

interface SEOProviderProps {
  children: ReactNode;
}

export function SEOProvider({ children }: SEOProviderProps) {
  return <HelmetProvider>{children}</HelmetProvider>;
}
