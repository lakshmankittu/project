import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DeviceCheckerDialogComponent } from './device-checker/device-checker-dialog.component';
import type { DeviceSelection } from './device-checker/model';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DeviceCheckerDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'project';
  dialogVisible = signal(true); // Open dialog on startup

  onSettingsChange(selection: DeviceSelection): void {
    console.log('Device settings saved:', selection);
  }

  onVisibleChange(visible: boolean): void {
    this.dialogVisible.set(visible);
  }
}
