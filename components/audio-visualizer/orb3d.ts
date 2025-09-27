/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// tslint:disable:organize-imports
// tslint:disable:ban-malformed-import-paths
// tslint:disable:no-new-decorators

import {LitElement, css, html} from 'lit';
import {Analyser} from './analyser';
import {FaceTracker} from './face-tracker';

import * as THREE from 'three';
// Post-processing imports removed for performance
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
import {vs as sphereVS} from './sphere-shader';

/**
 * 3D live audio visual.
 */
// Cache for shared resources
const resourceCache = {
  exrTexture: null as THREE.Texture | null,
  geometry: null as THREE.IcosahedronGeometry | null,
  loadingTexture: false,
};

export class Orb3D extends LitElement {
  private inputAnalyser!: Analyser;
  private outputAnalyser!: Analyser;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private sphere!: THREE.Mesh;
  private leftEye!: THREE.Mesh;
  private rightEye!: THREE.Mesh;
  private rotation = new THREE.Vector3(0, 0, 0);
  private eyeTarget = new THREE.Vector3(0, 0, 1);
  private wanderTime = 0;
  private faceTracker: FaceTracker | null = null;
  private facePosition = { x: 0, y: 0, detected: false };
  private isTracking = false;

  static properties = {
    outputNode: {type: Object},
    inputNode: {type: Object},
    videoStream: {type: Object},
    isRecording: {type: Boolean}
  };

  get outputNode() {
    return this._outputNode;
  }
  set outputNode(node: AudioNode | null) {
    this._outputNode = node;
    if (node && node.numberOfOutputs > 0) {
      this.outputAnalyser = new Analyser(node);
    } else {
      this.outputAnalyser = null as any;
    }
  }
  private _outputNode: AudioNode | null = null;

  get inputNode() {
    return this._inputNode;
  }
  set inputNode(node: AudioNode | null) {
    this._inputNode = node;
    if (node && node.numberOfOutputs > 0) {
      this.inputAnalyser = new Analyser(node);
    } else {
      this.inputAnalyser = null as any;
    }
  }
  private _inputNode: AudioNode | null = null;

  get videoStream() {
    return this._videoStream;
  }
  set videoStream(stream: MediaStream | null) {
    this._videoStream = stream;
    if (stream && !this.faceTracker) {
      this.setupFaceTracking(stream);
    }
  }
  private _videoStream: MediaStream | null = null;

  get isRecording() {
    return this._isRecording;
  }
  set isRecording(recording: boolean) {
    this._isRecording = recording;
    this.isTracking = recording;
  }
  private _isRecording: boolean = false;


  private canvas!: HTMLCanvasElement;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    canvas {
      width: 100% !important;
      height: 100% !important;
      display: block;
      image-rendering: auto;
      background: transparent !important;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
  }

  private init() {
    const scene = new THREE.Scene();
    // Transparent background
    scene.background = null;
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(2, -2, 5);
    this.camera = camera;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x00ffff, 0.5, 100);
    pointLight.position.set(-5, 5, 5);
    scene.add(pointLight);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true, // Enable transparency
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Limit pixel ratio for better performance
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0); // Transparent background
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;

    // Use cached geometry or create with lower subdivision for better performance
    if (!resourceCache.geometry) {
      resourceCache.geometry = new THREE.IcosahedronGeometry(1, 6); // Reduced from 10 to 6
    }
    const geometry = resourceCache.geometry;

    const sphereMaterial = new THREE.MeshPhysicalMaterial({
      metalness: 0.9,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 0.9,
      envMapIntensity: 0.5,
    });

    // Cache EXR texture loading with loading state
    if (resourceCache.exrTexture) {
      sphereMaterial.envMap = resourceCache.exrTexture;
      sphereMaterial.needsUpdate = true;
    } else if (!resourceCache.loadingTexture) {
      resourceCache.loadingTexture = true;
      new EXRLoader().load('/piz_compressed.exr', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        resourceCache.exrTexture = texture;
        resourceCache.loadingTexture = false;
        sphereMaterial.envMap = texture;
        sphereMaterial.needsUpdate = true;
      }, undefined, (error) => {
        console.error('Failed to load EXR texture:', error);
        resourceCache.loadingTexture = false;
      });
    }

    // Initialize shader uniforms immediately
    sphereMaterial.userData.shader = {
      uniforms: {
        time: {value: 0},
        inputData: {value: new THREE.Vector4(0.1, 0.1, 0.1, 0)},
        outputData: {value: new THREE.Vector4(0.1, 0.1, 0.1, 0)}
      }
    };

    sphereMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.time = {value: 0};
      shader.uniforms.inputData = {value: new THREE.Vector4(0.1, 0.1, 0.1, 0)};
      shader.uniforms.outputData = {value: new THREE.Vector4(0.1, 0.1, 0.1, 0)};

      sphereMaterial.userData.shader = shader;

      shader.vertexShader = sphereVS;
    };

    const sphere = new THREE.Mesh(geometry, sphereMaterial);
    scene.add(sphere);
    this.sphere = sphere;

    // Create robot eyes
    this.createRobotEyes(scene);

    // Post-processing disabled for performance - keeping direct rendering

    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h);
      // composer.setSize(w, h);
    }

    window.addEventListener('resize', onWindowResize);
    onWindowResize();

    this.animation();
  }

  private animation() {
    requestAnimationFrame(() => this.animation());

    const t = performance.now();
    const dt = 0.016; // Fixed 60fps timing
    const sphereMaterial = this.sphere.material as THREE.MeshPhysicalMaterial;

    // Get audio data or use fallback values
    let inputData = [0.1, 0.1, 0.1, 0.1];
    let outputData = [0.1, 0.1, 0.1, 0.1];

    if (this.inputAnalyser && this.inputAnalyser.isConnected) {
      this.inputAnalyser.update();
      inputData = Array.from(this.inputAnalyser.data);
    }

    if (this.outputAnalyser && this.outputAnalyser.isConnected) {
      this.outputAnalyser.update();
      outputData = Array.from(this.outputAnalyser.data);
    }

    if (sphereMaterial.userData.shader) {
      // Scale based on audio with smooth transitions and connection states
      const hasInputAudio = this.inputAnalyser && this.inputAnalyser.isConnected;
      const hasOutputAudio = this.outputAnalyser && this.outputAnalyser.isConnected;

      let scaleFactor;
      if (hasInputAudio || hasOutputAudio) {
        // Connected state - responsive to audio
        const inputLevel = hasInputAudio ? inputData[1] / 255 : 0;
        const outputLevel = hasOutputAudio ? outputData[1] / 255 : 0;
        const combinedLevel = Math.max(inputLevel, outputLevel);
        scaleFactor = 1 + (combinedLevel * 0.3);
      } else {
        // Idle state - gentle breathing
        scaleFactor = 1 + 0.05 * Math.sin(t * 0.002);
      }

      // Smooth scaling transition
      const currentScale = this.sphere.scale.x;
      const newScale = currentScale + (scaleFactor - currentScale) * 0.08;
      this.sphere.scale.setScalar(newScale);

      // Update eye animations
      this.updateEyes();

      // Rotate the camera based on audio data - simplified
      const f = 0.0005;
      if (this.inputAnalyser && this.outputAnalyser) {
        this.rotation.x += f * outputData[1] / 255;
        this.rotation.z += f * inputData[1] / 255;
        this.rotation.y += f * 0.5 * (inputData[2] + outputData[2]) / 255;
      } else {
        // Gentle rotation when no audio
        this.rotation.x += f * 0.1;
        this.rotation.y += f * 0.05;
        this.rotation.z += f * 0.08;
      }

      const euler = new THREE.Euler(
        this.rotation.x,
        this.rotation.y,
        this.rotation.z,
      );
      const quaternion = new THREE.Quaternion().setFromEuler(euler);
      const vector = new THREE.Vector3(0, 0, 5);
      vector.applyQuaternion(quaternion);
      this.camera.position.copy(vector);
      this.camera.lookAt(this.sphere.position);

      // Update shader uniforms - simplified
      sphereMaterial.userData.shader.uniforms.time.value += dt * 0.01;

      sphereMaterial.userData.shader.uniforms.inputData.value.set(
        (1 * inputData[0]) / 255,
        (0.1 * inputData[1]) / 255,
        (10 * inputData[2]) / 255,
        0,
      );
      sphereMaterial.userData.shader.uniforms.outputData.value.set(
        (2 * outputData[0]) / 255,
        (0.1 * outputData[1]) / 255,
        (10 * outputData[2]) / 255,
        0,
      );
    }

    this.renderer.clearColor();
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
  }

  private createRobotEyes(scene: THREE.Scene) {
    // Create eye geometry - tall and narrow like robot eyes
    const eyeGeometry = new THREE.CapsuleGeometry(0.03, 0.15, 4, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: false,
      opacity: 1.0
    });

    this.leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    this.rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial.clone());

    // Add glow effect with point lights
    const leftGlow = new THREE.PointLight(0xffffff, 0.5, 1);
    const rightGlow = new THREE.PointLight(0xffffff, 0.5, 1);

    this.leftEye.add(leftGlow);
    this.rightEye.add(rightGlow);

    // Position eyes on sphere surface
    this.positionEyesOnSphere();

    scene.add(this.leftEye);
    scene.add(this.rightEye);
  }

  private positionEyesOnSphere() {
    // Get current sphere scale
    const currentScale = this.sphere ? this.sphere.scale.x : 1;
    const sphereRadius = 1 * currentScale;
    const eyeDistance = 0.15; // Closer together

    const baseDirection = new THREE.Vector3(0, 0.05, 1).normalize(); // More centered

    const leftDirection = baseDirection.clone();
    leftDirection.x -= eyeDistance / 2;
    leftDirection.normalize().multiplyScalar(sphereRadius + 0.01);

    const rightDirection = baseDirection.clone();
    rightDirection.x += eyeDistance / 2;
    rightDirection.normalize().multiplyScalar(sphereRadius + 0.01);

    this.leftEye.position.copy(leftDirection);
    this.rightEye.position.copy(rightDirection);

    this.leftEye.lookAt(leftDirection.clone().multiplyScalar(2));
    this.rightEye.lookAt(rightDirection.clone().multiplyScalar(2));
  }

  private updateEyes() {
    if (this.isTracking && this.facePosition.detected) {
      this.trackFace();
    } else {
      this.wanderEyes();
    }
  }

  private trackFace() {
    // Convert face position to 3D target on sphere
    const target = new THREE.Vector3(
      this.facePosition.x * 0.6, // Scale face movement
      this.facePosition.y * 0.4,
      1
    ).normalize();

    // Smooth tracking
    this.eyeTarget.lerp(target, 0.15);
    this.moveEyesToTarget();
  }

  private async setupFaceTracking(stream: MediaStream) {
    try {
      this.faceTracker = new FaceTracker();
      await this.faceTracker.initialize(stream, (facePos) => {
        this.facePosition = facePos;
      });
      console.log('Face tracking setup complete');
    } catch (error) {
      console.error('Face tracking setup failed:', error);
    }
  }

  private wanderEyes() {
    this.wanderTime += 0.01;

    const wanderX = Math.sin(this.wanderTime * 0.7) * 0.3;
    const wanderY = Math.cos(this.wanderTime * 0.5) * 0.2;

    const newTarget = new THREE.Vector3(wanderX, wanderY, 1).normalize();
    this.eyeTarget.lerp(newTarget, 0.02);
    this.moveEyesToTarget();
  }


  private moveEyesToTarget() {
    // Get current sphere scale to keep eyes on surface
    const currentScale = this.sphere.scale.x;
    const sphereRadius = 1 * currentScale;
    const eyeDistance = 0.15; // Match the closer distance

    const leftDirection = this.eyeTarget.clone();
    leftDirection.x -= eyeDistance / 2;
    leftDirection.normalize().multiplyScalar(sphereRadius + 0.02);

    const rightDirection = this.eyeTarget.clone();
    rightDirection.x += eyeDistance / 2;
    rightDirection.normalize().multiplyScalar(sphereRadius + 0.02);

    // Smoother eye movement
    this.leftEye.position.lerp(leftDirection, 0.08);
    this.rightEye.position.lerp(rightDirection, 0.08);

    // Pure white glow based on activity
    const hasInputAudio = this.inputAnalyser && this.inputAnalyser.isConnected;
    const hasOutputAudio = this.outputAnalyser && this.outputAnalyser.isConnected;

    let glowIntensity = 0.3; // Base white glow
    if (hasInputAudio || hasOutputAudio) {
      glowIntensity = 0.8; // Much brighter when active
    }

    // Update glow lights
    const leftGlow = this.leftEye.children[0] as THREE.PointLight;
    const rightGlow = this.rightEye.children[0] as THREE.PointLight;

    if (leftGlow && rightGlow) {
      leftGlow.intensity = glowIntensity;
      rightGlow.intensity = glowIntensity;
    }

    const lookTarget = this.eyeTarget.clone().multiplyScalar(2);
    this.leftEye.lookAt(lookTarget);
    this.rightEye.lookAt(lookTarget);
  }


  protected firstUpdated() {
    this.canvas = this.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // Use RAF to prevent blocking main thread during initialization
    requestAnimationFrame(() => {
      this.init();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Cleanup Three.js resources but be gentle
    try {
      if (this.renderer) {
        this.renderer.dispose();
      }
      if (this.scene) {
        this.scene.clear();
      }
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
    // Note: We don't clear the cache as it's shared between instances
  }

  protected render() {
    return html`<canvas></canvas>`;
  }
}

// Register the custom element (only if not already defined)
if (!customElements.get('gemini-orb-3d')) {
  customElements.define('gemini-orb-3d', Orb3D);
}

declare global {
  interface HTMLElementTagNameMap {
    'gemini-orb-3d': Orb3D;
  }
}
