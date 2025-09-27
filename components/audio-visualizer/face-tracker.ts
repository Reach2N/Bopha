/**
 * Face tracking using MediaPipe Face Mesh
 */
import * as FaceMeshModule from '@mediapipe/face_mesh';
import * as CameraUtils from '@mediapipe/camera_utils';
const { FaceMesh } = FaceMeshModule;
const { Camera } = CameraUtils;

export class FaceTracker {
  private faceMesh: InstanceType<typeof FaceMesh>;
  private camera: InstanceType<typeof Camera> | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private onFaceUpdate: ((facePosition: { x: number; y: number; detected: boolean }) => void) | null = null;
  private isInitialized = false;

  constructor() {
    this.faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.faceMesh.onResults(this.onResults.bind(this));
  }

  async initialize(videoStream: MediaStream, onFaceUpdate: (facePosition: { x: number; y: number; detected: boolean }) => void) {
    if (this.isInitialized) return;

    this.onFaceUpdate = onFaceUpdate;

    try {
      // Create video element
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = videoStream;
      this.videoElement.play();

      // Initialize camera
      this.camera = new Camera(this.videoElement, {
        onFrame: async () => {
          if (this.videoElement) {
            await this.faceMesh.send({ image: this.videoElement });
          }
        },
        width: 640,
        height: 480
      });

      await this.camera.start();
      this.isInitialized = true;
      console.log('Face tracking initialized');
    } catch (error) {
      console.error('Face tracking initialization failed:', error);
    }
  }

  private onResults(results: any) {
    if (!this.onFaceUpdate) return;

    const detected = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

    if (detected) {
      const landmarks = results.multiFaceLandmarks[0];

      // Get nose tip (landmark 1) for face center
      const noseTip = landmarks[1];

      // Convert to normalized coordinates (-1 to 1)
      const faceX = (noseTip.x - 0.5) * 2; // Convert 0-1 to -1 to 1
      const faceY = (noseTip.y - 0.5) * -2; // Convert 0-1 to 1 to -1 (flip Y)

      this.onFaceUpdate({
        x: faceX,
        y: faceY,
        detected: true
      });
    } else {
      this.onFaceUpdate({
        x: 0,
        y: 0,
        detected: false
      });
    }
  }

  stop() {
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    this.isInitialized = false;
    this.onFaceUpdate = null;
  }
}