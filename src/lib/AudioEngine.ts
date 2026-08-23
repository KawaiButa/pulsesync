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
    
    osc.type = isAccent ? 'square' : 'sine';
    osc.frequency.value = isAccent ? 1200 : 800; // Higher pitch for accent
    
    // Envelope to make a percussive "click"
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(1, time + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    
    // Hardware latency compensation
    const latency = (this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0);
    const playTime = time - latency; // shift schedule slightly back if hardware delays
    
    osc.start(playTime > 0 ? playTime : 0);
    osc.stop(playTime > 0 ? playTime + 0.1 : 0.1);
  }

  private scheduler = () => {
    // While there are notes that will need to play before the next interval,
    // schedule them and advance the pointer.
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
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
