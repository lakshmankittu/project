import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from '@syncfusion/ej2-angular-popups';
import { MediaDevicesService } from './media-devices.service';
import { DeviceKind, LABELS, Label, UI, type DeviceSelection } from './model';

@Component({
  selector: 'app-device-checker-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule],
  templateUrl: './device-checker-dialog.component.html',
  styleUrl: './device-checker-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceCheckerDialogComponent {
  readonly media = inject(MediaDevicesService);
  private readonly destroyRef = inject(DestroyRef);

  // 2-way bindable visibility for the ejs-dialog
  readonly visible = input<boolean>(false);
  readonly visibleChange = output<boolean>();

  // Emit currently chosen devices to parent on save
  readonly settingsChange = output<DeviceSelection>();

  // UI text enums/constants exposed to template
  readonly L = Label;
  readonly T = LABELS;
  readonly UI = UI;

  // Selected devices
  readonly selection = signal<DeviceSelection>({ audioInputId: null, audioOutputId: null, videoInputId: null });

  // Device lists (computed from service)
  readonly audioInputs = computed(() => this.media.devices().audioInputs);
  readonly audioOutputs = computed(() => this.media.devices().audioOutputs);
  readonly videoInputs = computed(() => this.media.devices().videoInputs);

  // live meters/state
  readonly micLevel = computed(() => this.media.micLevel());
  readonly isMicTesting = computed(() => this.media.isMicTesting());
  readonly isVideoOn = computed(() => this.media.isVideoOn());
  readonly outputSelectionSupported = computed(() => this.media.outputSelectionSupported());
  readonly error = computed(() => this.media.error());
  readonly isSecureContext = computed(() => this.media.isSecureContext());

  @ViewChild('videoRef', { static: false }) videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('testAudioRef', { static: false }) testAudioRef?: ElementRef<HTMLAudioElement>;

  constructor() {
    // Cleanup on destroy
    this.destroyRef.onDestroy(() => this.media.cleanupAll(this.videoRef?.nativeElement));
  }

  async onDialogOpen(): Promise<void> {
    console.log('[DeviceCheckerDialog] Dialog opened');

    // First, check permission status without requesting
    await this.media.checkPermissions();

    // Try to enumerate devices (may not have labels yet)
    await this.media.refreshDevices();

    // Request permissions - this is required to get device labels
    console.log('[DeviceCheckerDialog] Requesting permissions...');
    const granted = await this.media.ensurePermissions({ audio: true, video: true });

    if (granted) {
      console.log('[DeviceCheckerDialog] Permissions granted, refreshing devices...');
      // Now enumerate devices again - they should have labels after permission is granted
      await this.media.refreshDevices();
    } else {
      console.warn('[DeviceCheckerDialog] Permissions not granted');
    }

    console.log('[DeviceCheckerDialog] Initialization complete');
    console.log('[DeviceCheckerDialog] Devices found:', {
      audioInputs: this.audioInputs().length,
      audioOutputs: this.audioOutputs().length,
      videoInputs: this.videoInputs().length
    });
  }

  async onDialogClose(): Promise<void> {
    await this.media.cleanupAll(this.videoRef?.nativeElement);
    this.visibleChange.emit(false);
  }

  // Mic
  async startMic(): Promise<void> {
    await this.media.startMicTest(this.selection().audioInputId ?? null);
  }
  stopMic(): void {
    this.media.stopMicTest();
  }

  // Video
  async startVideo(): Promise<void> {
    const video = this.videoRef?.nativeElement;
    if (!video) return;
    await this.media.startVideo(video, this.selection().videoInputId ?? null);
  }
  stopVideo(): void {
    const video = this.videoRef?.nativeElement;
    this.media.stopVideo(video);
  }

  // Speaker
  async testSpeaker(): Promise<void> {
    const audio = this.testAudioRef?.nativeElement;
    if (!audio) return;
    await this.media.playTestTone(audio, this.selection().audioOutputId ?? null);
  }

  // Selection change handlers
  onAudioInputChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selection.update(s => ({ ...s, audioInputId: value || null }));
  }

  onVideoInputChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selection.update(s => ({ ...s, videoInputId: value || null }));
  }

  onAudioOutputChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selection.update(s => ({ ...s, audioOutputId: value || null }));
  }

  // Save & Close
  saveAndClose(): void {
    this.settingsChange.emit(this.selection());
    this.visibleChange.emit(false);
  }
}

