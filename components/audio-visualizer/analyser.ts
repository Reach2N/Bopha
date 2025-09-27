/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Analyser class for live audio visualisation.
 */
export class Analyser {
    private analyser: AnalyserNode | null = null;
    private bufferLength = 16; // Default size
    private dataArray: Uint8Array;
    private connected = false;

    constructor(node: AudioNode) {
      this.dataArray = new Uint8Array(this.bufferLength);

      try {
        if (node && node.context && node.numberOfOutputs > 0) {
          this.analyser = node.context.createAnalyser();
          this.analyser.fftSize = 32;
          this.bufferLength = this.analyser.frequencyBinCount;
          this.dataArray = new Uint8Array(this.bufferLength);
          node.connect(this.analyser);
          this.connected = true;
        }
      } catch (error) {
        console.warn('Failed to create analyser:', error);
        this.connected = false;
      }
    }

    update() {
      if (this.connected && this.analyser) {
        try {
          this.analyser.getByteFrequencyData(this.dataArray);
        } catch (error) {
          console.warn('Analyser update failed:', error);
          this.connected = false;
        }
      }
    }

    get data() {
      return this.dataArray;
    }

    get isConnected() {
      return this.connected;
    }
  }
  