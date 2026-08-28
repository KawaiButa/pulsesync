import React, { useEffect, useState, useRef } from 'react';
import { SyncEngine, SyncState } from '../lib/SyncEngine';
import { AudioEngine } from '../lib/AudioEngine';
import { ArrowLeft, Wifi, Activity, Minus, Plus, Volume2, VolumeX, MousePointerClick } from 'lucide-react';
import { BeatVisualizer } from './BeatVisualizer';

export function ClientView({ onBack }: { onBack: () => void }) {
  const [masterId, setMasterId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [rtt, setRtt] = useState(0);
  const [manualOffset, setManualOffset] = useState<number | string>(0);
  const [soundType, setSoundType] = useState<'classic' | 'deep' | 'sharp'>('classic');
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);

  const syncRef = useRef<SyncEngine | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const hasAudioContext = useRef(false);
  
  const tapHistoryRef = useRef<number[]>([]);
  const lastTapTimeRef = useRef<number>(0);

  // Auto-init audio context on user interaction
  const initAudio = () => {
    if (!hasAudioContext.current && audioRef.current) {
      audioRef.current.getContext().resume();
      hasAudioContext.current = true;
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.setManualOffset(Number(manualOffset) || 0);
      audioRef.current.setSoundType(soundType);
      audioRef.current.setVolume(volume);
      audioRef.current.setMuted(isMuted);
    }
  }, [manualOffset, soundType, volume, isMuted]);

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

  const handleTapToSync = () => {
    if (!syncState || !syncRef.current) return;
    
    const now = performance.now();
    if (now - lastTapTimeRef.current > 2000) {
      // More than 2 seconds since last tap, reset history
      tapHistoryRef.current = [];
    }
    lastTapTimeRef.current = now;

    const syncTime = syncRef.current.getSynchronizedTime();
    const msPerBeat = (60.0 / syncState.bpm) * 1000;
    const elapsed = syncTime - syncState.masterT0;
    const N = Math.round(elapsed / msPerBeat);
    const idealBeatTime = syncState.masterT0 + N * msPerBeat;
    
    const delta = syncTime - idealBeatTime;
    
    tapHistoryRef.current.push(delta);
    if (tapHistoryRef.current.length > 8) {
      tapHistoryRef.current.shift(); // keep last 8 taps
    }
    
    // Calculate average
    const avgDelta = tapHistoryRef.current.reduce((a, b) => a + b, 0) / tapHistoryRef.current.length;
    
    // Update offset (clamp to -500 to 500)
    const newOffset = Math.max(-500, Math.min(500, Math.round(avgDelta)));
    setManualOffset(newOffset);
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
                getSyncTime={() => (syncRef.current ? syncRef.current.getSynchronizedTime() - (Number(manualOffset) || 0) : performance.now())} 
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
              
              <button
                onClick={handleTapToSync}
                className="w-full bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 rounded-xl py-3 font-bold mb-6 transition-all flex items-center justify-center active:scale-95 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
              >
                <MousePointerClick className="w-5 h-5 mr-2" />
                Tap to Sync with Master
              </button>

              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 w-12">Earlier</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setManualOffset(Math.max(-500, (Number(manualOffset) || 0) - 1))}
                    className="p-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex items-center">
                    <span className="text-lg font-mono text-purple-300 font-bold mr-1 w-4 text-right">{(Number(manualOffset) || 0) > 0 ? '+' : ''}</span>
                    <input 
                      type="text"
                      value={manualOffset}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || val === '-') {
                          setManualOffset(val);
                        } else {
                          const num = parseInt(val, 10);
                          if (!isNaN(num)) setManualOffset(Math.max(-500, Math.min(500, num)));
                        }
                      }}
                      className="w-16 bg-black/50 border border-white/10 rounded px-2 py-1 text-lg font-mono text-center focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-lg font-mono text-purple-300 font-bold ml-1 w-6">ms</span>
                  </div>
                  <button 
                    onClick={() => setManualOffset(Math.min(500, (Number(manualOffset) || 0) + 1))}
                    className="p-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs text-gray-500 w-12 text-right">Later</span>
              </div>
              <input 
                type="range" 
                min="-500" 
                max="500" 
                value={Number(manualOffset) || 0}
                onChange={(e) => setManualOffset(parseInt(e.target.value, 10))}
                className="w-full accent-purple-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-4"
              />
            </div>

            <div className="glass rounded-3xl p-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">
                Sound Profile
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSoundType('classic')}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${soundType === 'classic' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >Classic</button>
                <button 
                  onClick={() => setSoundType('deep')}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${soundType === 'deep' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >Deep</button>
                <button 
                  onClick={() => setSoundType('sharp')}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${soundType === 'sharp' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >Sharp</button>
              </div>
            </div>

            <div className="glass rounded-3xl p-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">
                Client Volume
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
                  className="w-full accent-purple-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
