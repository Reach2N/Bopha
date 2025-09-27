/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// tslint:disable:organize-imports
// tslint:disable:ban-malformed-import-paths
// tslint:disable:no-new-decorators

import {LitElement, css, html} from 'lit';
import {Analyser} from './analyser';

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
  private prevTime = 0;
  private rotation = new THREE.Vector3(0, 0, 0);
  private frameSkipCounter = 0;
  private targetFrameRate = 60;
  private frameInterval = 1000 / this.targetFrameRate;

  static properties = {
    outputNode: {type: Object},
    inputNode: {type: Object},
    videoStream: {type: Object}
  };

  get outputNode() {
    return this._outputNode;
  }
  set outputNode(node: AudioNode | null) {
    this._outputNode = node;
    if (node && node.numberOfOutputs > 0) {
      this.outputAnalyser = new Analyser(node);
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
    }
  }
  private _inputNode: AudioNode | null = null;

  get videoStream() {
    return this._videoStream;
  }
  set videoStream(stream: MediaStream | null) {
    this._videoStream = stream;
    // Video stream can be used for additional visual effects if needed
  }
  private _videoStream: MediaStream | null = null;

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
    const deltaTime = t - this.prevTime;

    // Frame rate limiting for better performance
    if (deltaTime < this.frameInterval) {
      return;
    }

    const dt = deltaTime / (1000 / 60);
    this.prevTime = t - (deltaTime % this.frameInterval);
    const sphereMaterial = this.sphere.material as THREE.MeshPhysicalMaterial;

    // Get audio data or use fallback values
    let inputData = [0.1, 0.1, 0.1, 0.1];
    let outputData = [0.1, 0.1, 0.1, 0.1];

    if (this.inputAnalyser) {
      this.inputAnalyser.update();
      inputData = Array.from(this.inputAnalyser.data);
    }
    
    if (this.outputAnalyser) {
      this.outputAnalyser.update();
      outputData = Array.from(this.outputAnalyser.data);
    }

    if (sphereMaterial.userData.shader) {
      // Optimize scaling with frame skipping for smooth performance
      this.frameSkipCounter++;
      if (this.frameSkipCounter % 2 === 0) { // Skip every other frame for scaling
        const scaleFactor = this.outputAnalyser ?
          1 + (0.2 * outputData[1]) / 255 :
          1 + 0.1 * Math.sin(t * 0.001);
        this.sphere.scale.setScalar(scaleFactor);
      }

      // Rotate the camera based on audio data
      const f = 0.001;
      if (this.inputAnalyser && this.outputAnalyser) {
        this.rotation.x += (dt * f * 0.5 * outputData[1]) / 255;
        this.rotation.z += (dt * f * 0.5 * inputData[1]) / 255;
        this.rotation.y += (dt * f * 0.25 * inputData[2]) / 255;
        this.rotation.y += (dt * f * 0.25 * outputData[2]) / 255;
      } else {
        // Fallback rotation when no audio
        this.rotation.x += dt * f * 0.1;
        this.rotation.y += dt * f * 0.05;
        this.rotation.z += dt * f * 0.08;
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

      // Update shader uniforms
      sphereMaterial.userData.shader.uniforms.time.value += 
        this.outputAnalyser ? 
        (dt * 0.1 * outputData[0]) / 255 : 
        dt * 0.001;

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

// Register the custom element
customElements.define('gemini-orb-3d', Orb3D);

declare global {
  interface HTMLElementTagNameMap {
    'gemini-orb-3d': Orb3D;
  }
}
