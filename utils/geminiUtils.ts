function arrayBufferToBase64(buffer: ArrayBuffer) {
  // chunked to avoid apply() arg limits
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const len = binary.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// Convert Float32Array [-1..1] -> Int16Array (clamped) and return Uint8Array bytes (LE)
function float32ToPcm16Bytes(float32: Float32Array) {
  const len = float32.length;
  const int16 = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    // scale to signed 16-bit range
    int16[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
  }
  return new Uint8Array(int16.buffer);
}

function createBlobFromFloat32(data: Float32Array) {
  // Live API expects base64-encoded raw PCM16 little-endian, and mime like "audio/pcm;rate=16000"
  const bytes = float32ToPcm16Bytes(data);
  const b64 = arrayBufferToBase64(bytes.buffer);
  return { data: b64, mimeType: "audio/pcm;rate=16000" };
}

// Robust decoding: input is Uint8Array of PCM16 little-endian, sampleRate, numChannels
async function decodePcm16ToAudioBuffer(
  uint8: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> {
  const bytes = uint8;
  const int16 = new Int16Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 2
  );
  const frameCount = int16.length / numChannels;
  const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    let idx = ch;
    for (let i = 0; i < frameCount; i++, idx += numChannels) {
      channelData[i] = int16[idx] / 32768;
    }
  }
  return audioBuffer;
}
export {
  arrayBufferToBase64,
  base64ToUint8Array,
  float32ToPcm16Bytes,
  createBlobFromFloat32,
  decodePcm16ToAudioBuffer,
};
