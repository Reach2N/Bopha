import { useCallback, useRef, useState } from "react";
import useApiKeyStore from "@/store/api";
import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Session,
} from "@google/genai";
import {
  base64ToUint8Array,
  decodePcm16ToAudioBuffer,
  createBlobFromFloat32,
} from "@/utils";

export default function useGeminiAudio() {
  const { apiKey } = useApiKeyStore();
  const [isRecording, setIsRecording] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputNodeRef = useRef<GainNode | null>(null);
  const isRecordingRef = useRef(false);
  const silentGainRef = useRef<GainNode | null>(null);

  const initSession = useCallback(async (client: GoogleGenAI) => {
    const model = "models/gemini-2.5-flash-native-audio-preview-09-2025";

    try {
      outputAudioContextRef.current = new AudioContext();
      const outputNode = outputAudioContextRef.current.destination;
      const sources = new Set<AudioBufferSourceNode>();
      let nextStartTime = 0;

      const session = await client.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            console.log("Audio session opened");
          },
          onmessage: async (message: LiveServerMessage) => {
            const audioInline =
              message.serverContent?.modelTurn?.parts?.[0]?.inlineData;

            if (audioInline?.data && outputAudioContextRef.current) {
              // Live API outputs PCM16 @ 24kHz (little-endian). See docs.
              const data = base64ToUint8Array(audioInline.data);
              // decode into audioBuffer
              const audioBuffer = await decodePcm16ToAudioBuffer(
                data,
                outputAudioContextRef.current,
                24000, // output sample rate per Live API docs
                1
              );
              const source = outputAudioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              source.onended = () => sources.delete(source);

              // Schedule audio properly to avoid overlaps
              nextStartTime = Math.max(
                nextStartTime || 0,
                outputAudioContextRef.current.currentTime
              );
              source.start(nextStartTime);
              nextStartTime = nextStartTime + audioBuffer.duration;
              sources.add(source);
            }

            if (message.serverContent?.interrupted) {
              for (const s of sources) {
                try {
                  s.stop();
                } catch (e) {}
                sources.delete(s);
              }
              nextStartTime = 0; // Reset scheduling on interruption
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error("Audio session error:", e.message);
          },
          onclose: (e: CloseEvent) => {
            console.log("Audio session closed:" + e.reason);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Orus" } },
          },
        },
      });
      sessionRef.current = session;
    } catch (e) {
      console.error("Error initializing audio session:", e);
      if (outputAudioContextRef.current) {
        await outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
      }
    }
  }, []);

  const initClient = useCallback(async () => {
    if (!apiKey) throw new Error("API key is not set");

    try {
      const client = new GoogleGenAI({ apiKey });
      // create input audio context
      inputAudioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      inputNodeRef.current = inputAudioContextRef.current.createGain();
      inputNodeRef.current.gain.value = 1.0;
      await initSession(client); // await so errors bubble
    } catch (e) {
      console.error("Error initializing audio client:", e);
      throw e; // Re-throw so UI can handle the error
    }
  }, [apiKey, initSession]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current && !mediaStreamRef.current) return;
    console.log("Stopping audio recording...");
    isRecordingRef.current = false;
    setIsRecording(false);

    try {
      scriptProcessorNodeRef.current?.disconnect();
      sourceNodeRef.current?.disconnect();
      silentGainRef.current?.disconnect();
    } catch (e) {}

    scriptProcessorNodeRef.current = null;
    sourceNodeRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    console.log("Audio recording stopped.");
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    if (!inputAudioContextRef.current) {
      console.error("Audio context not initialized");
      return;
    }
    await inputAudioContextRef.current.resume();
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false, // Audio only
      });
      sourceNodeRef.current =
        inputAudioContextRef.current.createMediaStreamSource(
          mediaStreamRef.current
        );
      sourceNodeRef.current.connect(inputNodeRef.current!);

      // create a silent gain node to avoid audible echo while keeping the processor alive
      silentGainRef.current = inputAudioContextRef.current.createGain();
      silentGainRef.current.gain.value = 0;

      const bufferSize = 4096; // larger buffer reduces CPU and is more stable
      // @ts-ignore - ScriptProcessor types vary
      scriptProcessorNodeRef.current =
        inputAudioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

      scriptProcessorNodeRef.current.onaudioprocess = (
        audioProcessingEvent
      ) => {
        if (!isRecordingRef.current) return;
        const channelData = audioProcessingEvent.inputBuffer.getChannelData(0);
        // copy because underlying buffer can be reused by the WebAudio stack
        const copy = new Float32Array(channelData);
        try {
          const blob = createBlobFromFloat32(copy);
          sessionRef.current?.sendRealtimeInput({ audio: blob });
        } catch (err) {
          console.error("sendRealtimeInput audio error:", err);
        }
      };

      // connect processor -> silent -> destination so it runs but doesn't play
      scriptProcessorNodeRef.current.connect(silentGainRef.current);
      silentGainRef.current.connect(inputAudioContextRef.current.destination);
      sourceNodeRef.current.connect(scriptProcessorNodeRef.current);

      isRecordingRef.current = true;
      setIsRecording(true);
      console.log("🔴 Audio recording... Sending PCM chunks.");
    } catch (err) {
      console.error("Error starting audio recording:", err);
      // best-effort cleanup
      stopRecording();
    }
  }, [stopRecording]);

  const reset = useCallback(() => {
    sessionRef.current?.close();
    if (apiKey) {
      const client = new GoogleGenAI({ apiKey });
      initSession(client);
    }
    console.log("Audio session reset.");
  }, [apiKey, initSession]);

  return {
    session: sessionRef.current,
    startRecording,
    stopRecording,
    reset,
    initClient,
    isRecording,
  };
}