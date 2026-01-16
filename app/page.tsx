"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated } from "convex/react";
import { ArrowRight, Code2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen bg-neutral-950 flex-col font-sans text-white">
        
       {/* Redirect authenticated users to dashboard */}
       <Authenticated>
          <AuthenticatedRedirect />
       </Authenticated>

       <Unauthenticated>
         <div className="flex flex-col items-center justify-center h-screen w-full gap-8 p-4">
             
             {/* Hero */}
             <div className="flex flex-col items-center gap-4 text-center">
                 <div className="p-4 bg-blue-500/10 rounded-2xl mb-2 ring-1 ring-blue-500/20">
                    <Code2 className="size-12 text-blue-500" />
                 </div>
                 <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-white to-neutral-500 bg-clip-text text-transparent pb-2">
                     Build software with AI
                 </h1>
                 <p className="text-lg text-neutral-400 max-w-lg">
                     A powerful AI code editor that helps you build, test, and deploy web applications directly from your browser.
                 </p>
             </div>
             
             {/* CTA */}
             <SignInButton mode="modal">
                <button className="group flex items-center gap-2 px-8 py-4 bg-white text-black hover:bg-neutral-200 rounded-xl font-semibold text-lg transition-all transform hover:scale-105">
                    Start Coding <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                </button>
             </SignInButton>

         </div>
       </Unauthenticated>
    </main>
  );
}

function AuthenticatedRedirect() {
    redirect("/dashboard");
    return null;
}