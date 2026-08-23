import React, { useEffect, useState, useRef } from 'react';
import { SyncEngine, SyncState } from '../lib/SyncEngine';
import { AudioEngine } from '../lib/AudioEngine';
import { ArrowLeft, Wifi, Activity } from 'lucide-react';
import { BeatVisualizer } from './BeatVisualizer';

export function ClientView({ onBack }: { onBack: () => void }) {
  const [masterId, setMasterId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [rtt, setRtt] = useState(0);
  const [manualOffset, setManualOffset] = useState(0);

  const syncRef = useRef<SyncEngine | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const hasAudioContext = useRef(false);

  // Auto-init audio context on user interaction
  const initAudio = () => {
    if (!hasAudioContext.current && audioRef.current) {
      audioRef.current.getContext().resume();
      hasAudioContext.current = true;
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.setManualOffset(manualOffset);
    }
  }, [manualOffset]);

  useEffect(() => {
    const sync = new SyncEngine();
    syncRef.current = sync;

    const audio = new AudioEngine(() => sync.getSynchronizedTime());
    audioRef.current = audio;

    sync.onConnectionChange = (count) => {
      setIsConnected(count > 0);
      setIsConnecting(false);
    };

    sync.onOffsetUpdate = (offset, pingRtt) => {
      setClockOffset(offset);
      setRtt(pingRtt);
    };

    sync.onStateChange = (state) => {
      setSyncState(state);
      audio.setParams(state.masterT0, state.bpm, state.beatsPerMeasure);
      if (state.isPlaying) {
        audio.start();
      } else {
        audio.stop();
      }
    };

    return () => {
      audio.stop();
    };
  }, []);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterId.trim() || !syncRef.current) return;
    setIsConnecting(true);
    initAudio();
    syncRef.current.initClient(masterId.trim());
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 flex flex-col items-center" onClick={initAudio}>
      <div className="w-full max-w-md">
        <button onClick={onBack} className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back
        </button>

        {!isConnected ? (
          <div className="glass rounded-3xl p-8 animate-in fade-in zoom-in duration-500">
            <h2 className="text-2xl font-bold mb-6 text-center">Connect to Master</h2>
            <form onSubmit={handleConnect} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Master ID</label>
                <input
                  type="text"
                  value={masterId}
                  onChange={(e) => setMasterId(e.target.value)}
                  placeholder="Paste ID here..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-lg font-mono placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                type="submit"
                disabled={isConnecting || !masterId.trim()}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(147,51,234,0.4)]"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500 space-y-6">
            <div className="glass rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center text-purple-400">
                  <Wifi className="w-6 h-6 mr-2" /> Connected
                </h2>
                <div className="flex space-x-4 text-xs font-mono text-gray-400 bg-black/30 px-3 py-2 rounded-lg">
                  <div>RTT: {Math.round(rtt)}ms</div>
                  <div>Offset: {clockOffset > 0 ? '+' : ''}{Math.round(clockOffset)}ms</div>
                </div>
              </div>
            </div>

            <div className="glass rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden">
              {syncState?.isPlaying && (
                <div className="absolute inset-0 bg-purple-500/10 animate-pulse pointer-events-none" />
              )}
              
              <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">
                Current BPM
              </div>
              <div className="text-8xl font-black mb-4 tabular-nums tracking-tighter text-white">
                {syncState?.bpm || '--'}
              </div>

              <BeatVisualizer 
                isPlaying={syncState?.isPlaying || false} 
                masterT0={syncState?.masterT0 || 0} 
                bpm={syncState?.bpm || 120} 
                beatsPerMeasure={syncState?.beatsPerMeasure || 4} 
                getSyncTime={() => (syncRef.current ? syncRef.current.getSynchronizedTime() - manualOffset : performance.now())} 
              />

              <div className="flex items-center text-gray-400">
                <Activity className={`w-6 h-6 mr-2 ${syncState?.isPlaying ? 'text-purple-400' : ''}`} />
                {syncState?.isPlaying ? 'Playing in Sync' : 'Waiting for Master...'}
              </div>
            </div>

            <div className="glass rounded-3xl p-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">
                Fine-tune Sync (Offset)
              </h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Earlier</span>
                <span className="text-lg font-mono text-purple-300 font-bold">{manualOffset > 0 ? '+' : ''}{manualOffset}ms</span>
                <span className="text-xs text-gray-500">Later</span>
              </div>
              <input 
                type="range" 
                min="-200" 
                max="200" 
                value={manualOffset}
                onChange={(e) => setManualOffset(parseInt(e.target.value, 10))}
                className="w-full accent-purple-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
