"use client";

import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from "@tanstack/react-query";
import { useState } from "react";

const config: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Serve cached data for 30s before considering stale; a stale read still
      // paints instantly from cache and refetches in the background.
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient(config));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
