// components/SessionProviderWrapper.tsx
"use client"; // This directive marks the component as a Client Component

import { SessionProvider } from "next-auth/react";
import React from "react";

interface Props {
  children: React.ReactNode;
  // session: any; // You might pass the session from a server component if needed initially
}

export default function SessionProviderWrapper({ children }: Props) {
  return <SessionProvider>{children}</SessionProvider>;
}
