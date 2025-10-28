
import { Injectable} from '@angular/core';


export interface PermissionStatus {
  microphone: PermissionState;
  camera: PermissionState;
}

@Injectable({ providedIn: 'root' })
export class MediaDevicesService {
  
}


