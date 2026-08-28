import React, { useEffect, useState, useRef } from 'react';
import { SyncEngine } from '../lib/SyncEngine';
import { AudioEngine } from '../lib/AudioEngine';
import { BeatVisualizer } from './BeatVisualizer';
import { Play, Square, Users, ArrowLeft, Radio, Copy, Check, Volume2, VolumeX } from 'lucide-react';

export function MasterView({ onBack }: { onBack: () => void }) {
  const [peerId, setPeerId] = useState<string | null>(null);
  const [connections, setConnections] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterT0, setMasterT0] = useState(0);
  const [copied, setCopied] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  
  const syncRef = useRef<SyncEngine | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.setVolume(volume);
      audioRef.current.setMuted(isMuted);
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const sync = new SyncEngine();
    sync.onIdReady = setPeerId;
    sync.onConnectionChange = setConnections;
    sync.initMaster();
    syncRef.current = sync;

    const audio = new AudioEngine(() => performance.now()); // Master time IS performance.now()
    audioRef.current = audio;

    return () => {
      audio.stop();
      // Need a way to clean up peer connection, but for simplicity we assume full reload on unmount
    };
  }, []);

  const togglePlay = () => {
    if (!syncRef.current || !audioRef.current) return;
    
    const nextIsPlaying = !isPlaying;
    const masterT0 = performance.now() + 100; // start 100ms in future
    
    setIsPlaying(nextIsPlaying);
    setMasterT0(masterT0);
    
    const state = {
      bpm,
      beatsPerMeasure: 4,
      isPlaying: nextIsPlaying,
      masterT0
    };
    
    syncRef.current.broadcastState(state);
    
    audioRef.current.setParams(masterT0, bpm, 4);
    if (nextIsPlaying) {
      audioRef.current.start();
    } else {
      audioRef.current.stop();
    }
  };

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseInt(e.target.value, 10);
    setBpm(newBpm);
    
    if (isPlaying && syncRef.current && audioRef.current) {
      const state = {
        bpm: newBpm,
        beatsPerMeasure: 4,
        isPlaying: true,
        masterT0: performance.now() + 100
      };
      setMasterT0(state.masterT0);
      syncRef.current.broadcastState(state);
      audioRef.current.setParams(state.masterT0, newBpm, 4);
      audioRef.current.start(); // re-syncs
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back
        </button>
        
        <div className="glass rounded-3xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center">
              <Radio className="w-6 h-6 mr-2 text-cyan-400" /> Master
            </h2>
            <div className="flex items-center text-sm font-medium bg-gray-900/50 px-3 py-1.5 rounded-full">
              <Users className="w-4 h-4 mr-2 text-cyan-400" />
              {connections} Client(s)
            </div>
          </div>
          
          <div className="bg-black/30 rounded-xl p-4 text-center">
            <p className="text-gray-400 text-sm mb-1">Your Connect ID</p>
            <div className="flex items-center justify-center gap-3">
              <p className="font-mono text-xl tracking-wider text-cyan-300 font-bold select-all">
                {peerId || 'Generating...'}
              </p>
              {peerId && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(peerId);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                  title="Copy ID"
                >
                  {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl p-6 mb-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">
            Master Volume
          </h3>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded-lg transition-colors ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted && parseFloat(e.target.value) > 0) setIsMuted(false);
              }}
              className="w-full accent-cyan-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div className="glass rounded-3xl p-8 flex flex-col items-center text-center">
          <div className="text-7xl font-black mb-2 tabular-nums tracking-tighter">
            {bpm}
          </div>
          
          <BeatVisualizer 
            isPlaying={isPlaying} 
            masterT0={masterT0} 
            bpm={bpm} 
            beatsPerMeasure={4} 
            getSyncTime={() => performance.now()} 
          />
          
          <input 
            type="range" 
            min="40" 
            max="240" 
            value={bpm}
            onChange={handleBpmChange}
            className="w-full mb-10 accent-cyan-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
          />

          <button 
            onClick={togglePlay}
            className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
              isPlaying 
                ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.3)]' 
                : 'bg-cyan-500 text-white hover:bg-cyan-400 shadow-[0_0_40px_rgba(8,145,178,0.5)]'
            }`}
          >
            {isPlaying ? <Square className="w-12 h-12 fill-current" /> : <Play className="w-14 h-14 fill-current ml-2" />}
          </button>
        </div>
      </div>
    </div>
  );
}
