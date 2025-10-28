import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from '@syncfusion/ej2-angular-popups';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-device-checker-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, FormsModule],
  templateUrl: './device-checker-dialog.component.html',
  styleUrl: './device-checker-dialog.component.scss',
})
export class DeviceCheckerDialogComponent implements OnInit, OnDestroy {
  // Tab management
  activeTab: 'audio' | 'video' = 'audio';

  // Device lists
  availableDevices: MediaDeviceInfo[] = [];
  defaultMicId: string = '';
  communicationsMicId: string = '';
  defaultSpeakerId: string = '';
  communicationsSpeakerId: string = '';

  // Microphone test
  selectedMicId: string = '';
  isRecording: boolean = false;
  audioLevel: number = 0;
  recordingDuration: number = 0;
  recordedAudioUrl: string | null = null;
  maxRecordingTime: number = 10;

  // Speaker test
  selectedSpeakerId: string = '';
  isPlayingTestSound: boolean = false;
  @ViewChild('speakerAudio') speakerAudioRef?: ElementRef<HTMLAudioElement>;
  @ViewChild('recordedAudio') recordedAudioRef?: ElementRef<HTMLAudioElement>;

  // Private properties
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private animationFrameId: number | null = null;
  private recordingTimer: any = null;
  private recordedChunks: Blob[] = [];
  private testAudio: HTMLAudioElement | null = null;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit() { this.listDevices(); }
  ngOnDestroy() { this.cleanup(); }

  async listDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(track => track.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableDevices = devices;

      // Find default microphone
      const defaultDevice = devices.find(d => d.kind === 'audioinput' && d.deviceId === 'default');
      const communicationsDevice = devices.find(d => d.kind === 'audioinput' && d.deviceId === 'communications');
      if (defaultDevice?.groupId) {
        const actualDevice = devices.find(d => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications' && d.groupId === defaultDevice.groupId);
        if (actualDevice) {
          this.defaultMicId = actualDevice.deviceId;
          // Auto-select default microphone if none selected
          if (!this.selectedMicId) {
            this.selectedMicId = actualDevice.deviceId;
          }
        }
      }
      if (communicationsDevice?.groupId) {
        const actualDevice = devices.find(d => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications' && d.groupId === communicationsDevice.groupId);
        if (actualDevice) this.communicationsMicId = actualDevice.deviceId;
      }

      // Find default speaker
      const defaultSpeaker = devices.find(d => d.kind === 'audiooutput' && d.deviceId === 'default');
      const communicationsSpeaker = devices.find(d => d.kind === 'audiooutput' && d.deviceId === 'communications');
      if (defaultSpeaker?.groupId) {
        const actualDevice = devices.find(d => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== 'communications' && d.groupId === defaultSpeaker.groupId);
        if (actualDevice) {
          this.defaultSpeakerId = actualDevice.deviceId;
          // Auto-select default speaker if none selected
          if (!this.selectedSpeakerId) {
            this.selectedSpeakerId = actualDevice.deviceId;
          }
        }
      }
      if (communicationsSpeaker?.groupId) {
        const actualDevice = devices.find(d => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== 'communications' && d.groupId === communicationsSpeaker.groupId);
        if (actualDevice) this.communicationsSpeakerId = actualDevice.deviceId;
      }

      this.cdr.detectChanges();
    } catch (err) { console.error('Error:', err); }
  }

  getAudioInputs(): MediaDeviceInfo[] {
    return this.availableDevices.filter(d => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
  }
  getAudioOutputs(): MediaDeviceInfo[] {
    return this.availableDevices.filter(d => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
  }
  getVideoInputs(): MediaDeviceInfo[] { return this.availableDevices.filter(d => d.kind === 'videoinput'); }
  isDefaultMic(deviceId: string): boolean { return this.defaultMicId === deviceId; }
  isCommunicationsMic(deviceId: string): boolean { return this.communicationsMicId === deviceId; }
  isDefaultSpeaker(deviceId: string): boolean { return this.defaultSpeakerId === deviceId; }
  isCommunicationsSpeaker(deviceId: string): boolean { return this.communicationsSpeakerId === deviceId; }
  getSelectedDeviceName(): string {
    if (!this.selectedMicId) return 'No device selected';
    const device = this.availableDevices.find(d => d.deviceId === this.selectedMicId);
    return device ? (device.label || 'Unnamed Device') : 'Unknown Device';
  }
  getFormattedRecordingTime(): string { return this.recordingDuration.toFixed(1) + 's'; }
  get recordingProgress(): number { return (this.recordingDuration / this.maxRecordingTime) * 100; }

  async startRecording() {
    if (!this.selectedMicId || this.isRecording) return;
    try {
      this.clearRecording();
      this.recordingDuration = 0;
      this.recordedChunks = [];
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: this.selectedMicId } } });
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) this.recordedChunks.push(event.data); };
      this.mediaRecorder.onstop = () => {
        this.ngZone.run(async () => {
          const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
          this.recordedAudioUrl = URL.createObjectURL(blob);
          this.cdr.detectChanges();

          // Wait for the audio element to be created, then set its output device
          setTimeout(async () => {
            if (this.recordedAudioRef?.nativeElement && this.selectedSpeakerId) {
              const audio = this.recordedAudioRef.nativeElement;
              if ('setSinkId' in audio) {
                try {
                  await (audio as any).setSinkId(this.selectedSpeakerId);
                  console.log('Recorded audio output set to:', this.selectedSpeakerId);
                } catch (err) {
                  console.error('Error setting recorded audio output:', err);
                }
              }
            }
          }, 100);
        });
      };
      this.mediaRecorder.start();
      this.isRecording = true;
      this.updateAudioLevel();
      this.recordingTimer = setInterval(() => {
        this.recordingDuration += 0.1;
        if (this.recordingDuration >= this.maxRecordingTime) this.stopRecording();
      }, 100);
    } catch (err) { console.error('Error:', err); this.cleanup(); }
  }

  stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;
    if (this.recordingTimer) { clearInterval(this.recordingTimer); this.recordingTimer = null; }
    if (this.animationFrameId !== null) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
    if (this.stream) { this.stream.getTracks().forEach(track => track.stop()); this.stream = null; }
    if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
    this.analyser = null;
    this.audioLevel = 0;
  }

  clearRecording() {
    if (this.recordedAudioUrl) { URL.revokeObjectURL(this.recordedAudioUrl); this.recordedAudioUrl = null; }
    this.recordedChunks = [];
    this.recordingDuration = 0;
  }

  private updateAudioLevel() {
    if (!this.analyser || !this.isRecording) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    this.audioLevel = Math.min(100, (average / 255) * 100);
    this.animationFrameId = requestAnimationFrame(() => this.updateAudioLevel());
  }

  // Tab navigation
  switchTab(tab: 'audio' | 'video') {
    this.activeTab = tab;
    this.stopRecording();
  }

  nextTab() {
    if (this.activeTab === 'audio') {
      this.activeTab = 'video';
      this.stopRecording();
    }
  }

  previousTab() {
    if (this.activeTab === 'video') {
      this.activeTab = 'audio';
    }
  }

  // Speaker test methods
  getSelectedSpeakerName(): string {
    if (!this.selectedSpeakerId) return 'No speaker selected';
    const device = this.availableDevices.find(d => d.deviceId === this.selectedSpeakerId);
    return device ? (device.label || 'Unnamed Device') : 'Unknown Device';
  }

  onMicrophoneChange() {
    // If currently recording, stop and restart with new microphone
    if (this.isRecording) {
      this.stopRecording();
      console.log('Microphone changed to:', this.selectedMicId);
      // Optionally auto-restart recording with new mic
      // setTimeout(() => this.startRecording(), 100);
    }
  }

  async onSpeakerChange() {
    // Update all audio elements' output device when speaker selection changes
    if (!this.selectedSpeakerId) return;

    const audioElements = [
      this.speakerAudioRef?.nativeElement,
      this.recordedAudioRef?.nativeElement
    ].filter(el => el !== undefined);

    for (const audio of audioElements) {
      if (audio && 'setSinkId' in audio) {
        try {
          await (audio as any).setSinkId(this.selectedSpeakerId);
          console.log('Audio output device changed to:', this.selectedSpeakerId);
        } catch (err) {
          console.error('Error setting audio output device:', err);
        }
      }
    }
  }

  async playTestSound() {
    if (!this.selectedSpeakerId || this.isPlayingTestSound) return;

    this.isPlayingTestSound = true;

    try {
      // Create a simple test tone using Web Audio API
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const destination = audioContext.createMediaStreamDestination();

      oscillator.connect(gainNode);
      gainNode.connect(destination);

      oscillator.frequency.value = 440; // A4 note
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2);

      // Create audio element and set the output device
      const audio = new Audio();
      audio.srcObject = destination.stream;

      // Set the audio output device (setSinkId)
      if ('setSinkId' in audio) {
        await (audio as any).setSinkId(this.selectedSpeakerId);
      }

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 2);

      await audio.play();

      setTimeout(() => {
        this.isPlayingTestSound = false;
        audio.pause();
        audio.srcObject = null;
        audioContext.close();
        this.cdr.detectChanges();
      }, 2000);
    } catch (err) {
      console.error('Error playing test sound:', err);
      this.isPlayingTestSound = false;
      this.cdr.detectChanges();
    }
  }

  private cleanup() {
    this.stopRecording();
    this.clearRecording();
    if (this.testAudio) {
      this.testAudio.pause();
      this.testAudio = null;
    }
  }
}
