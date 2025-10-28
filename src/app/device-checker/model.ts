// Static enums and constants, so we never hardcode strings in templates/components
export enum DeviceKind {
  AudioInput = 'audioinput',
  AudioOutput = 'audiooutput',
  VideoInput = 'videoinput',
}

export type DeviceId = string;

export interface AvDevices {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
}

export interface DeviceSelection {
  audioInputId: DeviceId | null;
  audioOutputId: DeviceId | null;
  videoInputId: DeviceId | null;
}

export enum Label {
  DialogTitle = 'DialogTitle',
  Microphone = 'Microphone',
  Camera = 'Camera',
  Speaker = 'Speaker',
  SelectPrompt = 'SelectPrompt',
  Start = 'Start',
  Stop = 'Stop',
  TestSpeaker = 'TestSpeaker',
  Save = 'Save',
  Close = 'Close',
  UnlabeledDevice = 'UnlabeledDevice',
  BrowserNotSupported = 'BrowserNotSupported',
  OutputSwitchUnsupported = 'OutputSwitchUnsupported',
}

export const LABELS: Record<Label, string> = {
  [Label.DialogTitle]: 'Audio/Video Device Tester',
  [Label.Microphone]: 'Microphone',
  [Label.Camera]: 'Camera',
  [Label.Speaker]: 'Speaker',
  [Label.SelectPrompt]: 'Select…',
  [Label.Start]: 'Start',
  [Label.Stop]: 'Stop',
  [Label.TestSpeaker]: 'Play test tone',
  [Label.Save]: 'Save',
  [Label.Close]: 'Close',
  [Label.UnlabeledDevice]: 'Unlabeled device',
  [Label.BrowserNotSupported]: 'This feature is not supported in your environment.',
  [Label.OutputSwitchUnsupported]: 'Your browser may not allow changing the speaker output device.',
};

export const UI = {
  DIALOG_WIDTH: '720px',
  METER_MAX: 1.0,
};

export const ANALYSER = {
  FFT_SIZE: 1024,
  SMOOTHING: 0.8,
};

export const TEST_TONE = {
  FREQUENCY: 440,
  DURATION_MS: 800,
  GAIN: 0.08,
};

export function displayLabel(device: MediaDeviceInfo | undefined | null): string {
  if (!device) return LABELS[Label.UnlabeledDevice];
  return device.label?.trim() || LABELS[Label.UnlabeledDevice];
}

