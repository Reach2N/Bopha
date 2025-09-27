"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import ApiModal from "@/components/ApiModal";
import useGeminiLive from "@/hooks/geminiLiveServer";
import { Mic, StopCircle, RefreshCw, Key } from "lucide-react";

// Type declaration for custom elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gemini-orb-3d': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

// Simple one-time import
if (typeof window !== "undefined") {
  import("@/components/audio-visualizer/orb3d");
}

function Page() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const orbRef = React.useRef<HTMLDivElement>(null);
  const {
    initClient,
    startRecording,
    stopRecording,
    reset,
    output,
    isRecording,
    mode,
    videoStream,
    inputNode,
    outputNode,
  } = useGeminiLive();

  React.useEffect(() => {
    if (orbRef.current && typeof window !== 'undefined') {
      // Only create if doesn't exist
      if (!orbRef.current.querySelector('gemini-orb-3d')) {
        const orbElement = document.createElement('gemini-orb-3d');
        orbRef.current.appendChild(orbElement);
      }
    }
  }, []); // Run only once

  // Update orb with audio/video data when available
  React.useEffect(() => {
    if (orbRef.current) {
      const orbElement = orbRef.current.querySelector('gemini-orb-3d') as any;
      if (orbElement) {
        if (inputNode) orbElement.inputNode = inputNode;
        if (outputNode) orbElement.outputNode = outputNode;
        if (videoStream) orbElement.videoStream = videoStream;
      }
    }
  }, [videoStream, inputNode, outputNode]);
  const handleInitClient = async () => {
    try {
      setError(null);
      await initClient();
      setIsInitialized(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to initialize client"
      );
      setIsModalOpen(true);
    }
  };

  const handleStartRecording = async () => {
    if (!isInitialized) {
      await handleInitClient();
      if (!isInitialized) return;
    }
    try {
      await startRecording();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start recording"
      );
    }
  };

  return (
    <div className="flex flex-col items-center justify-end min-h-screen bg-white p-6 relative">
      {/* Orb Sphere - Always visible, positioned below header */}
      <div className="absolute z-0 top-20 left-0 right-0 bottom-0 w-full h-full pointer-events-none">
        <div ref={orbRef} className="w-full h-full"></div>
      </div>
      {/* API Key Button */}
      <Button
        onClick={() => setIsModalOpen(true)}
        className="mb-6 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white relative z-10"
      >
        <Key className="w-4 h-4" /> Set API Key
      </Button>
      <ApiModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError(null);
        }}
        error={error}
      />

      {/* Transcription Output */}
      <div className="w-full max-w-md mb-6 relative z-10">
        {output ? (
          <div className="bg-white/90 backdrop-blur-sm shadow rounded-2xl p-4 border">
            <h3 className="text-base font-semibold text-gray-800 mb-3">
              Live Transcription
            </h3>
            <div className="bg-slate-50/80 rounded-lg p-3 max-h-60 overflow-y-auto">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {output}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white/90 backdrop-blur-sm shadow rounded-2xl p-6 border text-center text-gray-400">
            <p>No transcription yet. Start recording to see live text here.</p>
          </div>
        )}
      </div>

      {/* Video Preview */}
      {(mode === "video" || mode === "both") && videoStream && (
        <div className="relative mb-6 w-full max-w-md">
          <video
            ref={(el) => {
              if (el) el.srcObject = videoStream;
            }}
            autoPlay
            muted
            playsInline
            className="w-full rounded-2xl border shadow scale-x-[-1]"
          />
          <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs shadow">
            {isRecording ? "🔴 Recording" : "⏸️ Stopped"}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-3 w-full max-w-md relative z-10">
        {!isRecording ? (
          <Button
            onClick={handleStartRecording}
            className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl text-lg font-medium flex items-center justify-center gap-2"
          >
            <Mic className="w-5 h-5" />
            {isInitialized ? "Start Recording" : "Initialize & Start Recording"}
          </Button>
        ) : (
          <Button
            onClick={stopRecording}
            variant="destructive"
            className="py-4 rounded-xl text-lg font-medium flex items-center justify-center gap-2"
          >
            <StopCircle className="w-5 h-5" /> Stop Recording
          </Button>
        )}

        {isRecording && (
          <Button
            onClick={reset}
            variant="outline"
            className="py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Reset Session
          </Button>
        )}
      </div>

      {/* Status */}
      <div className="mt-8 text-sm text-gray-600 space-y-1 text-center relative z-10">
        <div>Status: {isRecording ? "🔴 Recording" : "⏸️ Stopped"}</div>

        {isInitialized && (
          <div className="text-green-600 font-medium">
            ✅ Client Initialized
          </div>
        )}
      </div>
    </div>
  );
}

export default Page;
