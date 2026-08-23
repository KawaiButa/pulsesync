import { Peer, DataConnection } from 'peerjs';

export type SyncState = {
  bpm: number;
  beatsPerMeasure: number;
  isPlaying: boolean;
  masterT0: number;
};

export class SyncEngine {
  private peer: Peer | null = null;
  public connections: DataConnection[] = [];
  public peerId: string | null = null;
  
  // Clock Synchronization state (for Client)
  private offsets: number[] = [];
  public currentOffset: number = 0;
  
  // Callbacks
  public onStateChange?: (state: SyncState) => void;
  public onConnectionChange?: (count: number) => void;
  public onOffsetUpdate?: (offset: number, rtt: number) => void;
  public onIdReady?: (id: string) => void;

  // Master acts as NTP Server, responding to PINGs.
  // Client sends PINGs to Master.
  
  public initMaster() {
    this.peer = new Peer();
    
    this.peer.on('open', (id) => {
      this.peerId = id;
      if (this.onIdReady) this.onIdReady(id);
    });

    this.peer.on('connection', (conn) => {
      this.connections.push(conn);
      if (this.onConnectionChange) this.onConnectionChange(this.connections.length);
      
      conn.on('data', (data: any) => {
        if (data.type === 'PING') {
          // Master received PING at T2, replies with T3 immediately
          const T2 = performance.now();
          const T3 = performance.now(); // minimal delay
          conn.send({
            type: 'PONG',
            T1: data.T1,
            T2,
            T3
          });
        }
      });
      
      conn.on('close', () => {
        this.connections = this.connections.filter(c => c !== conn);
        if (this.onConnectionChange) this.onConnectionChange(this.connections.length);
      });
    });
  }

  public initClient(masterId: string) {
    this.peer = new Peer();
    
    this.peer.on('open', (id) => {
      this.peerId = id;
      const conn = this.peer!.connect(masterId);
      this.connections = [conn];
      
      conn.on('open', () => {
        if (this.onConnectionChange) this.onConnectionChange(1);
        this.startSyncLoop(conn);
      });
      
      conn.on('data', (data: any) => {
        if (data.type === 'PONG') {
          const T4 = performance.now();
          const { T1, T2, T3 } = data;
          
          const rtt = (T4 - T1) - (T3 - T2);
          const offset = ((T2 - T1) + (T3 - T4)) / 2;
          
          this.processOffset(offset, rtt);
        } else if (data.type === 'SYNC_METRONOME') {
          if (this.onStateChange) {
            this.onStateChange({
              bpm: data.bpm,
              beatsPerMeasure: data.beatsPerMeasure,
              isPlaying: data.isPlaying,
              masterT0: data.masterT0
            });
          }
        }
      });

      conn.on('close', () => {
        this.connections = [];
        if (this.onConnectionChange) this.onConnectionChange(0);
      });
    });
  }

  private startSyncLoop(conn: DataConnection) {
    const pingInterval = setInterval(() => {
      if (conn.open) {
        conn.send({ type: 'PING', T1: performance.now() });
      } else {
        clearInterval(pingInterval);
      }
    }, 500); // Ping every 500ms
  }

  private processOffset(offset: number, rtt: number) {
    // Keep a sliding window of 10 offsets
    this.offsets.push(offset);
    if (this.offsets.length > 10) {
      this.offsets.shift();
    }
    
    // Filter out outliers (rudimentary IQR or just median/average)
    // For simplicity, we just average them. A real app might sort and drop top/bottom 20%.
    const sorted = [...this.offsets].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Filter out values too far from median
    const filtered = this.offsets.filter(o => Math.abs(o - median) < 20); // within 20ms of median
    
    if (filtered.length > 0) {
      const sum = filtered.reduce((a, b) => a + b, 0);
      this.currentOffset = sum / filtered.length;
    } else {
      this.currentOffset = median;
    }
    
    if (this.onOffsetUpdate) {
      this.onOffsetUpdate(this.currentOffset, rtt);
    }
  }

  public getSynchronizedTime(): number {
    // Converts local performance.now() to Master's timeline
    return performance.now() + this.currentOffset;
  }

  public broadcastState(state: SyncState) {
    for (const conn of this.connections) {
      if (conn.open) {
        conn.send({
          type: 'SYNC_METRONOME',
          ...state
        });
      }
    }
  }
}
