export class AudioEngine {
  private ctx: AudioContext;
  private isPlaying: boolean = false;
  private masterT0: number = 0;
  private bpm: number = 120;
  private beatsPerMeasure: number = 4;
  
  private lookahead: number = 25.0; // How frequently to call scheduling function (in milliseconds)
  private scheduleAheadTime: number = 0.1; // How far ahead to schedule audio (sec)
  
  private currentBeat: number = 0;
  private nextNoteTime: number = 0; // When the next note is due (in AudioContext time)
  private timerID: number | null = null;
  private manualOffset: number = 0; // In milliseconds
  private soundType: 'classic' | 'deep' | 'sharp' = 'classic';
  private volume: number = 1.0;
  private isMuted: boolean = false;
  
  // getSyncTime returns the current time in the Master's reference frame (in ms)
  private getSyncTime: () => number;

  constructor(getSyncTime: () => number) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.getSyncTime = getSyncTime;
  }

  public setParams(masterT0: number, bpm: number, beatsPerMeasure: number) {
    this.masterT0 = masterT0;
    this.bpm = bpm;
    this.beatsPerMeasure = beatsPerMeasure;
    // Calculate which beat we should be on right now based on sync time
    if (this.isPlaying) {
      this.resyncToMaster();
    }
  }

  public setManualOffset(offset: number) {
    this.manualOffset = offset;
  }

  public setSoundType(type: 'classic' | 'deep' | 'sharp') {
    this.soundType = type;
  }

  public setVolume(vol: number) {
    this.volume = vol;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public start() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.resyncToMaster();
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerID !== null) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  private resyncToMaster() {
    const syncTimeNow = this.getSyncTime();
    const msPerBeat = (60.0 / this.bpm) * 1000;
    
    // Elapsed time since masterT0
    const elapsedMs = syncTimeNow - this.masterT0;
    
    if (elapsedMs < 0) {
      // We are starting in the future
      this.currentBeat = 0;
      // Convert sync time future to local AudioContext time
      const delayMs = -elapsedMs;
      this.nextNoteTime = this.ctx.currentTime + (delayMs / 1000);
    } else {
      // We are already playing, find the NEXT beat to play
      const beatsElapsed = Math.floor(elapsedMs / msPerBeat);
      this.currentBeat = beatsElapsed + 1;
      
      const nextBeatMs = this.masterT0 + (this.currentBeat * msPerBeat);
      const msUntilNextBeat = nextBeatMs - syncTimeNow;
      this.nextNoteTime = this.ctx.currentTime + (msUntilNextBeat / 1000);
    }
  }

  private nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.currentBeat++;
  }

  private scheduleNote(beatNumber: number, time: number) {
    const isAccent = (beatNumber % this.beatsPerMeasure === 0);
    
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    
    if (this.soundType === 'classic') {
      osc.type = isAccent ? 'square' : 'sine';
      osc.frequency.value = isAccent ? 1200 : 800; // Higher pitch for accent
    } else if (this.soundType === 'deep') {
      osc.type = 'sine';
      osc.frequency.value = isAccent ? 400 : 200;
    } else if (this.soundType === 'sharp') {
      osc.type = isAccent ? 'sawtooth' : 'triangle';
      osc.frequency.value = isAccent ? 1500 : 1000;
    }
    
    // Hardware latency compensation and manual offset
    const latency = (this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0);
    const manualOffsetSec = this.manualOffset / 1000.0;
    const playTime = time - latency + manualOffsetSec; // shift schedule slightly based on latency and manual offset
    const now = this.ctx.currentTime;
    const safePlayTime = playTime > now ? playTime : now;
    
    // Envelope to make a percussive "click"
    const targetVolume = this.isMuted ? 0 : this.volume;
    
    gainNode.gain.setValueAtTime(0, safePlayTime);
    if (targetVolume > 0) {
      gainNode.gain.linearRampToValueAtTime(targetVolume, safePlayTime + 0.002);
      gainNode.gain.exponentialRampToValueAtTime(0.001, safePlayTime + 0.1);
    } else {
      gainNode.gain.setValueAtTime(0, safePlayTime + 0.1);
    }
    
    osc.start(safePlayTime);
    osc.stop(safePlayTime + 0.1);
  }

  private scheduler = () => {
    // While there are notes that will need to play before the next interval,
    // schedule them and advance the pointer.
    const latency = (this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0);
    const manualOffsetSec = this.manualOffset / 1000.0;
    
    while (this.nextNoteTime - latency + manualOffsetSec < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentBeat, this.nextNoteTime);
      this.nextNote();
    }
    
    if (this.isPlaying) {
      this.timerID = window.setTimeout(this.scheduler, this.lookahead);
    }
  }

  public getContext() {
    return this.ctx;
  }
}
