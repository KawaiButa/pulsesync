import { useState, useEffect } from 'react';
import { MasterView } from './components/MasterView';
import { ClientView } from './components/ClientView';
import { Activity } from 'lucide-react';

function useWakeLock() {
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Wake Lock error:', err);
      }
    };
    requestWakeLock();
    
    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().then(() => { wakeLock = null; });
      }
    };
  }, []);
}

function App() {
  const [role, setRole] = useState<'master' | 'client' | null>(null);
  
  useWakeLock();

  if (role === 'master') {
    return <MasterView onBack={() => setRole(null)} />;
  }
  
  if (role === 'client') {
    return <ClientView onBack={() => setRole(null)} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="glass p-8 rounded-3xl max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-cyan-500/20 rounded-full flex items-center justify-center">
            <Activity className="w-10 h-10 text-cyan-400" />
          </div>
        </div>
        
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">PulseSync</h1>
          <p className="text-gray-400">Distributed Sub-Millisecond Metronome</p>
        </div>

        <div className="grid grid-cols-1 gap-4 mt-8">
          <button 
            onClick={() => setRole('master')}
            className="bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 shadow-[0_0_20px_rgba(8,145,178,0.4)]"
          >
            Start as Master
          </button>
          <button 
            onClick={() => setRole('client')}
            className="bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 shadow-[0_0_20px_rgba(147,51,234,0.4)]"
          >
            Connect as Client
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
