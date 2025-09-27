import { useCallback, useRef, useState } from "react";
import useApiKeyStore from "@/store/api";
import {
  GoogleGenAI,
  LiveServerMessage,
  MediaResolution,
  Modality,
  Session,
} from "@google/genai";
import { base64ToUint8Array, decodePcm16ToAudioBuffer } from "@/utils";
import { useAudioRecorder } from "./utils";
import { useVideoRecorder } from "./utils";

export default function geminiLiveServer() {
  const [output, setOutput] = useState("");
  const addOutputChunk = (chunk: string) => {
    setOutput((prev) => prev + chunk);
  };

  const { apiKey } = useApiKeyStore();
  const [mode, setMode] = useState<"audio" | "video" | "both">("both");
  const [isRecording, setIsRecording] = useState(false);

  const sessionRef = useRef<Session | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputGainNodeRef = useRef<GainNode | null>(null);

  const audioRecorder = useAudioRecorder();
  const videoRecorder = useVideoRecorder();

  // Move audio playback variables to component scope
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const nextStartTimeRef = useRef(0);

  const initSession = useCallback(
    async (client: GoogleGenAI) => {
      const model = "gemini-2.5-flash-native-audio-preview-09-2025";

      try {
        // Only create audio context for audio modes
        if (mode === "audio" || mode === "both") {
          outputAudioContextRef.current = new AudioContext();
          // Create a gain node for output that can be used by the orb
          outputGainNodeRef.current = outputAudioContextRef.current.createGain();
          outputGainNodeRef.current.connect(outputAudioContextRef.current.destination);
        }

        const outputNode = outputGainNodeRef.current;
        // Reset audio playback state
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;

        const session = await client.live.connect({
          model: model,
          callbacks: {
            onopen: () => {
              console.log(`${mode} session opened`);
            },
            onmessage: async (message: LiveServerMessage) => {
              // Handle audio responses
              const audioInline =
                message.serverContent?.modelTurn?.parts?.[0]?.inlineData;
              if (
                audioInline?.data &&
                outputAudioContextRef.current &&
                outputNode
              ) {
                const data = base64ToUint8Array(audioInline.data);
                const audioBuffer = await decodePcm16ToAudioBuffer(
                  data,
                  outputAudioContextRef.current,
                  24000,
                  1
                );
                const source =
                  outputAudioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputGainNodeRef.current!);
                source.onended = () => sourcesRef.current.delete(source);

                nextStartTimeRef.current = Math.max(
                  nextStartTimeRef.current || 0,
                  outputAudioContextRef.current.currentTime
                );
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current =
                  nextStartTimeRef.current + audioBuffer.duration;
                sourcesRef.current.add(source);
              }
              // Handle transcription messages output
              if (message.serverContent) {
                const isInterruptedOrComplete =
                  message.serverContent.interrupted ||
                  message.serverContent?.turnComplete;

                const outputTranscription =
                  message.serverContent.outputTranscription;

                // Handle output transcription if present
                if (outputTranscription?.text) {
                  addOutputChunk(outputTranscription.text);
                }
                if (isInterruptedOrComplete) {
                  setTimeout(() => {
                    setOutput("");
                  }, 1000);
                }
              }

              if (message.serverContent?.interrupted) {
                for (const s of sourcesRef.current) {
                  try {
                    s.stop();
                  } catch (e) {}
                  sourcesRef.current.delete(s);
                }
                nextStartTimeRef.current = 0;
              }
            },
            onerror: (e: ErrorEvent) => {
              console.error("Session error:", e.message);
            },
            onclose: (e: CloseEvent) => {
              console.log("Session closed:", e.reason);
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],

            outputAudioTranscription: {},
            inputAudioTranscription: {},
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Orus" } },
              languageCode: "kh-khm",
            },
            systemInstruction: {
              role: "system",
              parts: [
                {
                  text: "You are a helpful useful human companion that complies to the user as needed with the vision of their video in realtime. Do not say that you are an AI, you are a real huma. when referring to what is this or that, it will be referring to the video. So use that as the context to help the user.  Only when the user is asking to do a search, you should search up and look for relevant stuff on the internet to help the user. As of now is 2025, and you are Bopha, developed by a creative mind 'Reach' or រាជ. Please respond in Khmer Language regardless of the language the user speaks to you in",
                },
              ],
            },
            contextWindowCompression: {
              triggerTokens: "32000",
              slidingWindow: { targetTokens: "32000" },
            },
            tools: [
              {
                googleSearch: {},
              },
            ],
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
          },
        });
        sessionRef.current = session;
      } catch (e) {
        console.error("Error initializing session:", e);
        if (outputAudioContextRef.current) {
          await outputAudioContextRef.current.close();
          outputAudioContextRef.current = null;
          outputGainNodeRef.current = null;
        }
      }
    },
    [mode]
  );

  const initClient = useCallback(async () => {
    if (!apiKey) throw new Error("API key is not set");

    try {
      const client = new GoogleGenAI({
        apiKey: apiKey,
      });

      // Initialize audio recorder if needed
      if (mode === "audio" || mode === "both") {
        audioRecorder.init();
      }

      await initSession(client);
    } catch (e) {
      console.error("Error initializing client:", e);
      throw e;
    }
  }, [apiKey, initSession, mode, audioRecorder]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;

    try {
      setIsRecording(true);

      // Start audio recording
      if (mode === "audio" || mode === "both") {
        await audioRecorder.start((audioData) => {
          sessionRef.current?.sendRealtimeInput({ audio: audioData });
        });
      }

      // Start video recording
      if (mode === "video" || mode === "both") {
        await videoRecorder.start((videoData) => {
          sessionRef.current?.sendRealtimeInput({ video: videoData });
        });
      }
    } catch (err) {
      console.error("Error starting recording:", err);
      stopRecording();
    }
  }, [mode, audioRecorder, videoRecorder, isRecording]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;

    setIsRecording(false);

    // Stop audio recording
    if (mode === "audio" || mode === "both") {
      audioRecorder.stop();
    }

    // Stop video recording
    if (mode === "video" || mode === "both") {
      videoRecorder.stop();
    }

    console.log("Recording stopped");
  }, [mode, audioRecorder, videoRecorder, isRecording]);
  const reset = useCallback(() => {
    sessionRef.current?.close();
    if (apiKey) {
      const client = new GoogleGenAI({ apiKey });
      initSession(client);
    }
    console.log("Session reset");
  }, [apiKey, initSession]);

  return {
    session: sessionRef.current,
    startRecording,
    stopRecording,
    reset,
    initClient,
    isRecording,
    output,
    mode,
    setMode,
    videoStream: videoRecorder.videoStream,
    inputNode: audioRecorder.inputNodeRef?.current,
    outputNode: outputGainNodeRef.current,
  };
}
