"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import DBInitializer from "./DBInitializer";

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // treat root and login routes as "welcome" screens where sidebar should be hidden
  const isWelcome = pathname === "/" || pathname === "" || pathname.startsWith("/login");

  return (
    <div className={`flex ${isWelcome ? 'bg-black text-white' : ''}`}>

      {/* Sidebar hidden on welcome page */}
      {!isWelcome && <Sidebar />}

      {/* Page Content */}
      <main className={`flex-1 min-h-screen ${isWelcome ? 'p-0 flex items-center justify-center' : 'bg-gray-50 p-6'}`}>
        {/* Initialize PouchDB + live sync (not needed on welcome) */}
        {!isWelcome && <DBInitializer />}

        {children}
      </main>
    </div>
  );
}
