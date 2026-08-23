import React, { useEffect, useState } from 'react';

interface BeatVisualizerProps {
  isPlaying: boolean;
  masterT0: number;
  bpm: number;
  beatsPerMeasure: number;
  getSyncTime: () => number;
}

export function BeatVisualizer({ isPlaying, masterT0, bpm, beatsPerMeasure, getSyncTime }: BeatVisualizerProps) {
  const [activeBeat, setActiveBeat] = useState(-1);

  useEffect(() => {
    if (!isPlaying) {
      setActiveBeat(-1);
      return;
    }

    let rafId: number;
    const msPerBeat = (60.0 / bpm) * 1000;

    const tick = () => {
      const now = getSyncTime();
      const elapsed = now - masterT0;
      
      if (elapsed >= 0) {
        const beatNumber = Math.floor(elapsed / msPerBeat);
        const currentBeatInMeasure = beatNumber % beatsPerMeasure;
        
        // We only want to trigger a React re-render if the beat actually changed
        setActiveBeat((prev) => (prev !== currentBeatInMeasure ? currentBeatInMeasure : prev));
      } else {
        setActiveBeat(-1);
      }
      
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, masterT0, bpm, beatsPerMeasure, getSyncTime]);

  return (
    <div className="flex space-x-6 justify-center items-center h-12 my-4">
      {Array.from({ length: beatsPerMeasure }).map((_, i) => {
        const isActive = activeBeat === i;
        const isMainBeat = i === 0;
        
        return (
          <div 
            key={i}
            className={`rounded-full transition-all duration-75 ${
              isActive 
                ? (isMainBeat 
                    ? 'w-6 h-6 bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.9)] scale-110' 
                    : 'w-4 h-4 bg-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.9)] scale-110'
                  ) 
                : 'w-3 h-3 bg-gray-700/50'
            }`}
          />
        );
      })}
    </div>
  );
}
