"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import ApiModal from "@/components/ApiModal";
import useGeminiLive from "@/hooks/geminiLiveServer";
import { Mic, StopCircle, RefreshCw, Key } from "lucide-react";

function Page() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const {
    initClient,
    startRecording,
    stopRecording,
    reset,
    output,
    isRecording,
    mode,
    videoStream,
  } = useGeminiLive();

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
    <div className="flex z-1000 flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      {/* API Key Button */}
      <Button
        onClick={() => setIsModalOpen(true)}
        className="mb-6 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
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
      <div className="w-full max-w-md mb-6">
        {output ? (
          <div className="bg-white shadow rounded-2xl p-4 border">
            <h3 className="text-base font-semibold text-gray-800 mb-3">
              Live Transcription
            </h3>
            <div className="bg-slate-50 rounded-lg p-3 max-h-60 overflow-y-auto">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {output}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-2xl p-6 border text-center text-gray-400">
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
      <div className="flex flex-col gap-3 w-full max-w-md">
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
      <div className="mt-8 text-sm text-gray-600 space-y-1 text-center">
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
