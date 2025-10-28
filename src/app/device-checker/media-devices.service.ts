
import { Injectable, signal, computed, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { ANALYSER, DeviceKind, LABELS, Label, TEST_TONE, type AvDevices } from './model';

export interface PermissionStatus {
  microphone: PermissionState;
  camera: PermissionState;
}

@Injectable({ providedIn: 'root' })
export class MediaDevicesService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly _devices = signal<AvDevices>({ audioInputs: [], audioOutputs: [], videoInputs: [] });
  readonly devices = computed(() => this._devices());

  readonly micLevel = signal(0);
  readonly isMicTesting = signal(false);
  readonly isVideoOn = signal(false);
  readonly error = signal<string | null>(null);
  readonly outputSelectionSupported = signal<boolean>(false);
  readonly permissionStatus = signal<PermissionStatus | null>(null);
  readonly isSecureContext = signal<boolean>(false);

  private micStream?: MediaStream;
  private videoStream?: MediaStream;
  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private sourceNode?: MediaStreamAudioSourceNode;
  private rafId?: number;
  private deviceChangeListener?: () => void;

  constructor() {
    if (this.isBrowser) {
      // Feature detect setSinkId support
      const proto = (HTMLMediaElement.prototype as any);
      this.outputSelectionSupported.set(typeof proto.setSinkId === 'function');

      // Check if running in secure context (HTTPS or localhost)
      this.isSecureContext.set(window.isSecureContext ?? false);

      // Set up device change monitoring
      this.setupDeviceChangeMonitoring();
    }
  }

  /**
   * Monitor device connections/disconnections
   */
  private setupDeviceChangeMonitoring(): void {
    if (!navigator?.mediaDevices) return;

    this.deviceChangeListener = () => {
      console.log('[MediaDevicesService] Device change detected, refreshing...');
      this.refreshDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeListener);
  }

  /**
   * Check permission status without requesting access
   */
  async checkPermissions(): Promise<PermissionStatus | null> {
    if (!this.isBrowser) return null;

    // Permissions API is not supported in all browsers
    if (!navigator.permissions?.query) {
      console.log('[MediaDevicesService] Permissions API not supported');
      return null;
    }

    try {
      const [micResult, cameraResult] = await Promise.all([
        navigator.permissions.query({ name: 'microphone' as PermissionName }).catch(() => null),
        navigator.permissions.query({ name: 'camera' as PermissionName }).catch(() => null),
      ]);

      const status: PermissionStatus = {
        microphone: micResult?.state ?? 'prompt',
        camera: cameraResult?.state ?? 'prompt',
      };

      this.permissionStatus.set(status);
      console.log('[MediaDevicesService] Permission status:', status);

      // Listen for permission changes
      micResult?.addEventListener('change', () => {
        this.permissionStatus.update(s => s ? { ...s, microphone: micResult.state } : null);
      });
      cameraResult?.addEventListener('change', () => {
        this.permissionStatus.update(s => s ? { ...s, camera: cameraResult.state } : null);
      });

      return status;
    } catch (e) {
      console.error('[MediaDevicesService] Error checking permissions:', e);
      return null;
    }
  }

  async refreshDevices(): Promise<void> {
    if (!this.isBrowser) {
      console.log('[MediaDevicesService] Not in browser context, skipping device enumeration');
      return;
    }

    // Check secure context first
    if (!this.isSecureContext()) {
      this.error.set('⚠️ Media devices require HTTPS or localhost. Please use a secure connection.');
      console.error('[MediaDevicesService] Not in secure context (HTTPS required)');
      return;
    }

    if (!navigator?.mediaDevices?.enumerateDevices) {
      this.error.set(LABELS[Label.BrowserNotSupported]);
      console.error('[MediaDevicesService] navigator.mediaDevices.enumerateDevices not available');
      return;
    }

    try {
      console.log('[MediaDevicesService] Enumerating devices...');
      const all = await navigator.mediaDevices.enumerateDevices();
      console.log('[MediaDevicesService] Found devices:', all.length, all);

      const audioInputs = all.filter(d => d.kind === DeviceKind.AudioInput);
      const audioOutputs = all.filter(d => d.kind === DeviceKind.AudioOutput);
      const videoInputs = all.filter(d => d.kind === DeviceKind.VideoInput);

      console.log('[MediaDevicesService] Categorized:', {
        audioInputs: audioInputs.length,
        audioOutputs: audioOutputs.length,
        videoInputs: videoInputs.length
      });

      // Check if we have devices but no labels (permissions not granted yet)
      const hasDevicesWithoutLabels = all.length > 0 && all.every(d => !d.label);
      if (hasDevicesWithoutLabels) {
        console.warn('[MediaDevicesService] Devices found but no labels - permissions may not be granted');
        this.error.set('ℹ️ Click "Request Permissions" to see device names');
      }

      this._devices.set({ audioInputs, audioOutputs, videoInputs });

      // Only clear error if we have devices with labels
      if (!hasDevicesWithoutLabels) {
        this.error.set(null);
      }
    } catch (e: any) {
      console.error('[MediaDevicesService] Error enumerating devices:', e);
      this.error.set(e?.message ?? String(e));
    }
  }

  async ensurePermissions(opts: { audio?: boolean; video?: boolean } = {}): Promise<boolean> {
    if (!this.isBrowser) {
      console.log('[MediaDevicesService] Not in browser context, skipping permission request');
      return false;
    }

    // Check secure context first
    if (!this.isSecureContext()) {
      this.error.set('⚠️ Media devices require HTTPS or localhost. Please use a secure connection.');
      console.error('[MediaDevicesService] Not in secure context (HTTPS required)');
      return false;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      this.error.set(LABELS[Label.BrowserNotSupported]);
      console.error('[MediaDevicesService] getUserMedia not available');
      return false;
    }

    const constraints: MediaStreamConstraints = {
      audio: !!opts.audio,
      video: !!opts.video,
    };

    let stream: MediaStream | undefined;
    try {
      if (!constraints.audio && !constraints.video) return false;

      console.log('[MediaDevicesService] Requesting permissions:', constraints);
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[MediaDevicesService] Permissions granted');
      this.error.set(null); // Clear any previous errors

      // Update permission status after successful grant
      await this.checkPermissions();

      return true;
    } catch (e: any) {
      console.error('[MediaDevicesService] Permission error:', e);

      // Provide user-friendly error messages
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        this.error.set('🚫 Permission denied. Please allow access to your camera/microphone in browser settings.');
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        this.error.set('📷 No camera or microphone found. Please connect a device.');
      } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
        this.error.set('⚠️ Device is already in use by another application.');
      } else if (e.name === 'OverconstrainedError') {
        this.error.set('⚠️ No device matches the requested constraints.');
      } else if (e.name === 'SecurityError') {
        this.error.set('🔒 Security error. Please use HTTPS or localhost.');
      } else {
        this.error.set(e?.message ?? String(e));
      }

      return false;
    } finally {
      stream?.getTracks().forEach(t => t.stop());
    }
  }

  async startMicTest(deviceId: string | null): Promise<void> {
    if (!this.isBrowser || !navigator.mediaDevices?.getUserMedia) return;
    this.stopMicTest();
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      } as any;
      this.micStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = ANALYSER.FFT_SIZE;
      this.analyser.smoothingTimeConstant = ANALYSER.SMOOTHING;
      this.sourceNode.connect(this.analyser);
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const update = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(dataArray);
        // Compute a simple peak level from 0..1
        let peak = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128; // -1..1
          const mag = Math.abs(v);
          if (mag > peak) peak = mag;
        }
        this.micLevel.set(Math.min(1, peak));
        this.rafId = requestAnimationFrame(update);
      };
      this.isMicTesting.set(true);
      update();
    } catch (e: any) {
      this.error.set(e?.message ?? String(e));
      this.stopMicTest();
    }
  }

  stopMicTest(): void {
    this.isMicTesting.set(false);
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = undefined;
    try { this.sourceNode?.disconnect(); } catch {}
    try { this.analyser?.disconnect(); } catch {}
    this.sourceNode = undefined;
    this.analyser = undefined;
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => void 0);
      this.audioCtx = undefined;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = undefined;
    }
    this.micLevel.set(0);
  }

  async startVideo(videoEl: HTMLVideoElement, deviceId: string | null): Promise<void> {
    if (!this.isBrowser || !navigator.mediaDevices?.getUserMedia) return;
    this.stopVideo(videoEl);
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
      } as any;
      this.videoStream = await navigator.mediaDevices.getUserMedia(constraints);
      (videoEl as any).srcObject = this.videoStream;
      await videoEl.play();
      this.isVideoOn.set(true);
    } catch (e: any) {
      this.error.set(e?.message ?? String(e));
      this.stopVideo(videoEl);
    }
  }

  stopVideo(videoEl?: HTMLVideoElement): void {
    this.isVideoOn.set(false);
    if (videoEl) {
      try { videoEl.pause(); } catch {}
      try { (videoEl as any).srcObject = null; } catch {}
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = undefined;
    }
  }

  async playTestTone(audioEl: HTMLAudioElement, outputDeviceId: string | null): Promise<void> {
    if (!this.isBrowser) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const dest = ctx.createMediaStreamDestination();
    osc.frequency.value = TEST_TONE.FREQUENCY;
    gain.gain.value = TEST_TONE.GAIN;
    osc.connect(gain).connect(dest);
    (audioEl as any).srcObject = dest.stream;

    if (this.outputSelectionSupported() && outputDeviceId) {
      try {
        await (audioEl as any).setSinkId(outputDeviceId);
      } catch {
        // Some environments (non-secure, or unsupported) will fail here
        this.error.set(LABELS[Label.OutputSwitchUnsupported]);
      }
    }

    try {
      await audioEl.play();
      osc.start();
      setTimeout(async () => {
        try { osc.stop(); } catch {}
        try { audioEl.pause(); } catch {}
        try { (audioEl as any).srcObject = null; } catch {}
        await ctx.close();
      }, TEST_TONE.DURATION_MS);
    } catch (e: any) {
      this.error.set(e?.message ?? String(e));
      try { await ctx.close(); } catch {}
    }
  }

  async cleanupAll(videoEl?: HTMLVideoElement): Promise<void> {
    this.stopMicTest();
    this.stopVideo(videoEl);

    // Remove device change listener
    if (this.deviceChangeListener && navigator?.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeListener);
    }
  }
}


