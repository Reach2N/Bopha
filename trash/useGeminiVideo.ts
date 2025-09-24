import { useCallback, useRef, useState } from "react";
import useApiKeyStore from "@/store/api";
import {
  GoogleGenAI,
  LiveServerMessage,
  MediaResolution,
  Modality,
  Session,
} from "@google/genai";

export default function useGeminiVideo() {
  const { apiKey } = useApiKeyStore();
  const [isRecording, setIsRecording] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);

  const captureFrame = useCallback(() => {
    if (
      !canvasRef.current ||
      !videoElementRef.current ||
      !sessionRef.current ||
      !isRecordingRef.current
    ) {
      return;
    }

    const canvas = canvasRef.current;
    const video = videoElementRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to base64 image
    canvas.toBlob((blob) => {
      if (blob) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1]; // Remove data:image/jpeg;base64, prefix

          try {
            // Send image frame to Gemini
            sessionRef.current?.sendRealtimeInput({
              media: {
                data: base64,
                mimeType: "image/jpeg",
              },
            });
          } catch (err) {
            console.error("Error sending video frame:", err);
          }
        };
        reader.readAsDataURL(blob);
      }
    }, "image/jpeg");
  }, []);

  const initSession = useCallback(async (client: GoogleGenAI) => {
    const model = "models/gemini-2.5-flash-native-audio-preview-09-2025";

    try {
      const session = await client.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            console.log("Video session opened");
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle text responses from vision analysis
            const textContent = message.serverContent?.modelTurn?.parts?.find(
              (part) => part.text
            );

            if (textContent?.text) {
              console.log("Vision analysis:", textContent.text);
              // You can emit this to UI or handle it as needed
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error("Video session error:", e.message);
          },
          onclose: (e: CloseEvent) => {
            console.log("Video session closed:" + e.reason);
          },
        },
        config: {
          responseModalities: [Modality.TEXT], // Text responses for vision analysis
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
          tools: [{ googleSearch: {} }],
        },
      });
      sessionRef.current = session;
    } catch (e) {
      console.error("Error initializing video session:", e);
    }
  }, []);

  const initClient = useCallback(async () => {
    if (!apiKey) throw new Error("API key is not set");

    try {
      const client = new GoogleGenAI({ apiKey });
      await initSession(client);
    } catch (e) {
      console.error("Error initializing video client:", e);
      throw e;
    }
  }, [apiKey, initSession]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current && !mediaStreamRef.current) return;
    console.log("Stopping video recording...");

    isRecordingRef.current = false;
    setIsRecording(false);

    // Stop frame capture interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Stop video stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setVideoStream(null);
    }

    // Clear video element
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
    }

    console.log("Video recording stopped.");
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;

    try {
      // Get video stream with constraints
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 }, // We'll sample at 3fps but capture at 30fps for smooth preview
        },
      });

      setVideoStream(mediaStreamRef.current);

      // Create video element for frame capture
      if (!videoElementRef.current) {
        videoElementRef.current = document.createElement("video");
        videoElementRef.current.autoplay = true;
        videoElementRef.current.muted = true;
        videoElementRef.current.playsInline = true;
      }

      // Create canvas for frame capture
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }

      videoElementRef.current.srcObject = mediaStreamRef.current;

      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        const onLoadedMetadata = () => {
          videoElementRef.current?.removeEventListener(
            "loadedmetadata",
            onLoadedMetadata
          );
          resolve();
        };
        videoElementRef.current?.addEventListener(
          "loadedmetadata",
          onLoadedMetadata
        );
      });

      isRecordingRef.current = true;
      setIsRecording(true);

      // Start capturing frames at 3fps (every 333ms)
      intervalRef.current = setInterval(captureFrame, 333);

      console.log("🎥 Video recording... Sending frames at 3fps.");
    } catch (err) {
      console.error("Error starting video recording:", err);
      stopRecording();
    }
  }, [stopRecording, captureFrame]);

  const reset = useCallback(() => {
    sessionRef.current?.close();
    if (apiKey) {
      const client = new GoogleGenAI({ apiKey });
      initSession(client);
    }
    console.log("Video session reset.");
  }, [apiKey, initSession]);

  return {
    session: sessionRef.current,
    startRecording,
    stopRecording,
    reset,
    initClient,
    isRecording,
    videoStream, // Provide video stream for UI preview
  };
}
