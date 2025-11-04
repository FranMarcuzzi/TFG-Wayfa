'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center space-y-8 px-4">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold text-gray-900">Wayfa</h1>
          <p className="text-xl text-gray-600 max-w-md mx-auto">
            Plan your trips with friends. Share itineraries, chat, and vote on activities together.
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Link href="/register">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              Get Started
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
