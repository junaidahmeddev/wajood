"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WebSocketProvider from "@/components/providers/WebSocketProvider";
import { ToastProvider } from "@/components/shared/Toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </WebSocketProvider>
    </QueryClientProvider>
  );
}
