'use client';

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with xterm.js
const SSHClient = dynamic(
  () => import('@/components/ssh/ssh-client').then((mod) => mod.SSHClient),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-[#1e1e1e]">
        <div className="text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-t-transparent border-[#0e639c] rounded-full animate-spin mx-auto mb-4" />
          <p>Loading SSH Client...</p>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  return <SSHClient />;
}
