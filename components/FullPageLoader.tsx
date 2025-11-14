"use client";

import Player from 'lottie-react';
import loadingAnim from '@/public/animations/loading.json';

export function FullPageLoader({ size = 220, backdrop = 'bg-white/80 backdrop-blur-sm' }: { size?: number; backdrop?: string }) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${backdrop}`}>
      <Player autoplay loop animationData={loadingAnim as any} style={{ width: size, height: size }} />
    </div>
  );
}
