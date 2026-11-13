import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X, Camera } from "lucide-react";

interface Props {
  onDetect: (barcode: string) => void;
  onCancel: () => void;
}

export function BarcodeScanner({ onDetect, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setScanning(true);
        }
      } catch {
        setError("Impossibile accedere alla fotocamera. Verifica i permessi.");
      }
    }

    start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (code) {
      stopCamera();
      onDetect(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function handleVideoPlaying() {
    rafRef.current = requestAnimationFrame(tick);
  }

  function handleCancel() {
    stopCamera();
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90">
      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-white">
            <Camera size={18} />
            <span className="text-sm font-medium">Scansiona barcode</span>
          </div>
          <button onClick={handleCancel} className="text-white/70 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative mx-4 overflow-hidden rounded-xl bg-black aspect-square">
          {error ? (
            <div className="flex items-center justify-center h-full text-white/70 text-sm text-center px-6">
              {error}
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                onCanPlay={handleVideoPlaying}
              />
              {/* Overlay con mirino */}
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-48 h-48">
                    {/* Angoli */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-yellow-400 rounded-tl" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-yellow-400 rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-yellow-400 rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-yellow-400 rounded-br" />
                    {/* Linea di scansione */}
                    <div className="absolute inset-x-0 top-1/2 h-px bg-yellow-400/60 animate-pulse" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Canvas nascosto per elaborazione */}
        <canvas ref={canvasRef} className="hidden" />

        <p className="text-center text-white/50 text-xs mt-3 pb-4">
          Inquadra il codice a barre del prodotto
        </p>
      </div>
    </div>
  );
}
