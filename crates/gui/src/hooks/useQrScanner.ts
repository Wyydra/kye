import { useState, useRef, useEffect } from "react";
import { scanQrFromVideo } from "../lib/qrScanner";

export const useQrScanner = (onScanSuccess: (url: string) => void) => {
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startScanning = async () => {
    setScanning(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); // Required for iOS
        videoRef.current.play();
      }

      // Poll QR decoding frame-by-frame
      scanIntervalRef.current = window.setInterval(() => {
        if (videoRef.current) {
          const result = scanQrFromVideo(videoRef.current);
          if (result) {
            onScanSuccess(result);
          }
        }
      }, 300);
    } catch (e: any) {
      setScanning(false);
      setError(`Camera access failed: ${e.toString()}`);
    }
  };

  const stopScanning = () => {
    setScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Clean up scanner resources on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    scanning,
    videoRef,
    error,
    startScanning,
    stopScanning
  };
};
