import { useCallback, useRef, useState } from "react";

export function useVideoRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastCaptureTimeRef = useRef<number>(0);
  const onDataCallbackRef = useRef<((data: any) => void) | null>(null);

  const captureFrame = useCallback(async () => {
    if (
      !canvasRef.current ||
      !videoElementRef.current ||
      !onDataCallbackRef.current
    ) {
      return;
    }

    const canvas = canvasRef.current;
    const video = videoElementRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Check if video is ready and has dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    // Only resize canvas if dimensions changed (performance optimization)
    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Use blob for better performance and memory management
    try {
      canvas.toBlob(
        (blob) => {
          if (blob && onDataCallbackRef.current) {
            // Convert blob to base64 for Gemini API
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = (reader.result as string).split(",")[1];
              onDataCallbackRef.current?.({
                data: base64,
                mimeType: "image/jpeg",
              });
            };
            reader.readAsDataURL(blob);
          }
        },
        "image/jpeg",
        0.8 // Better quality for 1fps
      );
    } catch (error) {
      console.error("Frame capture error:", error);
    }
  }, []);

  const captureLoop = useCallback(() => {
    const now = performance.now();
    const targetFrameTime = 1000; // 1fps (1000ms between frames)

    if (now - lastCaptureTimeRef.current >= targetFrameTime) {
      captureFrame();
      lastCaptureTimeRef.current = now;
    }

    if (animationFrameRef.current !== null) {
      animationFrameRef.current = requestAnimationFrame(captureLoop);
    }
  }, [captureFrame]);

  const start = useCallback(
    async (onData: (data: any) => void) => {
      if (isRecording) return;

      onDataCallbackRef.current = onData;

      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: { ideal: 1280, min: 640, max: 1920 },
            height: { ideal: 720, min: 480, max: 1080 },
            frameRate: { ideal: 30, max: 60 }, // Higher for smooth preview
            facingMode: "user", // Front camera by default
          },
        });

        setVideoStream(mediaStreamRef.current);

        if (!videoElementRef.current) {
          videoElementRef.current = document.createElement("video");
          videoElementRef.current.autoplay = true;
          videoElementRef.current.muted = true;
          videoElementRef.current.playsInline = true;
          // Make video visible (but tiny) so it renders properly
          videoElementRef.current.style.width = "1px";
          videoElementRef.current.style.height = "1px";
          videoElementRef.current.style.position = "absolute";
          videoElementRef.current.style.top = "-1000px";
          document.body.appendChild(videoElementRef.current);
        }

        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas");
        }

        videoElementRef.current.srcObject = mediaStreamRef.current;

        // Wait for video to be ready AND playing
        await new Promise<void>((resolve) => {
          const onPlaying = () => {
            videoElementRef.current?.removeEventListener("playing", onPlaying);
            setTimeout(resolve, 100);
          };

          videoElementRef.current?.addEventListener("playing", onPlaying);
          videoElementRef.current?.play().catch(console.error);
        });

        setIsRecording(true);
        // Start real-time capture loop at 10fps
        lastCaptureTimeRef.current = performance.now();
        animationFrameRef.current = requestAnimationFrame(captureLoop);
      } catch (err) {
        console.error("Error starting video recording:", err);
        stop();
      }
    },
    [isRecording, captureFrame]
  );

  const stop = useCallback(() => {
    if (!isRecording) return;

    setIsRecording(false);
    onDataCallbackRef.current = null;

    // Cancel animation frame loop
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Legacy interval cleanup (if still used)
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setVideoStream(null);
    }

    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
      // Remove from DOM if we added it
      if (videoElementRef.current.parentNode) {
        videoElementRef.current.parentNode.removeChild(videoElementRef.current);
      }
      videoElementRef.current = null;
    }
  }, [isRecording]);

  return { start, stop, isRecording, videoStream };
}
