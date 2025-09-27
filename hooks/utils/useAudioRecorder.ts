import { useCallback, useRef, useState } from "react";
import { createBlobFromFloat32 } from "@/utils";

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const inputNodeRef = useRef<GainNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const onDataCallbackRef = useRef<((data: any) => void) | null>(null);
  const isRecordingRef = useRef(false); // Use ref instead of state for audio processing

  const init = useCallback(() => {
    inputAudioContextRef.current = new (window.AudioContext ||
      (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });
    inputNodeRef.current = inputAudioContextRef.current.createGain();
    inputNodeRef.current.gain.value = 1.0;
  }, []);

  const start = useCallback(
    async (onData: (data: any) => void) => {
      if (isRecording) return;

      onDataCallbackRef.current = onData;

      if (!inputAudioContextRef.current) {
        init();
      }

      await inputAudioContextRef.current!.resume();

      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        sourceNodeRef.current =
          inputAudioContextRef.current!.createMediaStreamSource(
            mediaStreamRef.current
          );
        sourceNodeRef.current.connect(inputNodeRef.current!);

        silentGainRef.current = inputAudioContextRef.current!.createGain();
        silentGainRef.current.gain.value = 0;

        // @ts-ignore
        scriptProcessorNodeRef.current =
          inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);

        scriptProcessorNodeRef.current.onaudioprocess = (event) => {
          if (!isRecordingRef.current) return;
          const channelData = event.inputBuffer.getChannelData(0);
          const copy = new Float32Array(channelData);
          const blob = createBlobFromFloat32(copy);
          onDataCallbackRef.current?.(blob);
        };

        scriptProcessorNodeRef.current.connect(silentGainRef.current);
        silentGainRef.current.connect(
          inputAudioContextRef.current!.destination
        );
        sourceNodeRef.current.connect(scriptProcessorNodeRef.current);

        isRecordingRef.current = true;
        setIsRecording(true);
      } catch (err) {
        console.error("Error starting audio recording:", err);
        stop();
      }
    },
    [isRecording, init]
  );

  const stop = useCallback(() => {
    if (!isRecording) return;

    isRecordingRef.current = false;
    setIsRecording(false);
    onDataCallbackRef.current = null;

    try {
      scriptProcessorNodeRef.current?.disconnect();
      sourceNodeRef.current?.disconnect();
      silentGainRef.current?.disconnect();
    } catch (e) {}

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    scriptProcessorNodeRef.current = null;
    sourceNodeRef.current = null;
  }, [isRecording]);

  return { start, stop, isRecording, init };
}
