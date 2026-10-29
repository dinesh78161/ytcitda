import { useEffect, useRef, useState } from "react";
import {
  Camera,
  RotateCcw,
  Sparkles,
  Sun,
  X,
  Zap,
  ZapOff,
  AlertCircle,
  Check,
  RefreshCw,
  Video,
} from "lucide-react";
import { localize } from "./lib/localize";
import { oralViewLabel as viewLabel } from "./lib/i18n";
import {
  inspectImage,
  type MedGemmaQualityAssessment,
} from "./lib/image-quality";
import type { Language } from "./lib/types";

export interface LiveCameraModalProps {
  oralView: string;
  lang: Language;
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function LiveCameraModal({
  oralView,
  lang,
  onCapture,
  onClose,
}: LiveCameraModalProps) {
  const copy = (en: string, te: string) => localize(lang, en, te);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleTimerRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Live quality monitoring states
  const [liveLighting, setLiveLighting] = useState<"good" | "low" | "glare">(
    "good",
  );
  const [liveFocus, setLiveFocus] = useState<"sharp" | "blurry">("sharp");
  const [liveBrightness, setLiveBrightness] = useState<number>(128);

  // Captured snapshot states
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [capturedQuality, setCapturedQuality] = useState<{
    status: string;
    details: {
      sharpness: number;
      brightness: number;
      glare_percent: number;
      medgemma?: MedGemmaQualityAssessment;
    };
  } | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const stopTracks = () => {
    if (sampleTimerRef.current) {
      window.clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async (
    deviceId?: string,
    preferFacing: "environment" | "user" = facingMode,
  ) => {
    stopTracks();
    setLoading(true);
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia_unsupported");
      }
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? {
              deviceId: { exact: deviceId },
              width: { ideal: 1920, min: 640 },
              height: { ideal: 1080, min: 480 },
            }
          : {
              facingMode: { ideal: preferFacing },
              width: { ideal: 1920, min: 640 },
              height: { ideal: 1080, min: 480 },
            },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check torch support
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const caps = (
            track.getCapabilities ? track.getCapabilities() : {}
          ) as any;
          setTorchAvailable(Boolean(caps?.torch));
        } catch {
          setTorchAvailable(false);
        }
      }

      // Enumerate available video devices
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoDevs);
        if (track) {
          const settings = track.getSettings?.();
          if (settings?.deviceId) {
            setActiveDeviceId(settings.deviceId);
          }
        }
      } catch {
        // ignore device listing errors
      }

      // Start live quality sampler loop
      startSampler();
    } catch (err: any) {
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        setError(
          copy(
            "Camera access was denied. Please allow camera permissions in your browser settings, or close this window to upload a file.",
            "కెమెరా అనుమతి నిరాకరించబడింది. దయచేసి బ్రౌజర్ సెట్టింగ్స్‌లో అనుమతించండి లేదా ఫైల్ అప్‌లోడ్ చేయండి.",
          ),
        );
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        setError(
          copy(
            "No camera device was found on this system. Please use the file upload option.",
            "ఈ పరికరంలో కెమెరా కనుగొనబడలేదు. దయచేసి ఫైల్ అప్‌లోడ్ ఎంపికను ఉపయోగించండి.",
          ),
        );
      } else {
        setError(
          copy(
            "Could not access live camera. Please check camera permissions and retry.",
            "లైవ్ కెమెరాను ప్రారంభించలేకపోయాము. అనుమతులు తనిಖీ చేసి మళ్లీ ప్రయత్నించండి.",
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const startSampler = () => {
    if (sampleTimerRef.current) window.clearInterval(sampleTimerRef.current);
    if (!sampleCanvasRef.current) {
      sampleCanvasRef.current = document.createElement("canvas");
      sampleCanvasRef.current.width = 120;
      sampleCanvasRef.current.height = 90;
    }
    const canvas = sampleCanvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    sampleTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !ctx) return;

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        let sum = 0;
        let glareCount = 0;
        const totalPixels = canvas.width * canvas.height;
        const gray = new Float32Array(totalPixels);

        for (let i = 0; i < totalPixels; i++) {
          const val =
            0.299 * imgData[i * 4] +
            0.587 * imgData[i * 4 + 1] +
            0.114 * imgData[i * 4 + 2];
          gray[i] = val;
          sum += val;
          if (val > 248) glareCount++;
        }

        const avgBrightness = sum / totalPixels;
        setLiveBrightness(Math.round(avgBrightness));

        if (avgBrightness < 40) {
          setLiveLighting("low");
        } else if (avgBrightness > 225 || glareCount / totalPixels > 0.25) {
          setLiveLighting("glare");
        } else {
          setLiveLighting("good");
        }

        // Fast Laplacian approximation for focus
        let total = 0;
        let squares = 0;
        let count = 0;
        for (let y = 1; y < canvas.height - 1; y += 2) {
          for (let x = 1; x < canvas.width - 1; x += 2) {
            const n = y * canvas.width + x;
            const lap =
              gray[n - 1] +
              gray[n + 1] +
              gray[n - canvas.width] +
              gray[n + canvas.width] -
              4 * gray[n];
            total += lap;
            squares += lap * lap;
            count++;
          }
        }
        const sharpness = squares / count - (total / count) ** 2;
        setLiveFocus(sharpness >= 45 ? "sharp" : "blurry");
      } catch {
        // ignore sampling frame drops
      }
    }, 350);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: next }],
      });
      setTorchOn(next);
    } catch {
      // torch toggling failed
    }
  };

  const toggleCameraFacing = () => {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    void startCamera(undefined, nextFacing);
  };

  const switchDevice = (id: string) => {
    setActiveDeviceId(id);
    void startCamera(id);
  };

  const snapPhoto = async () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const file = new File([blob], `oral-${oralView}-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const url = URL.createObjectURL(blob);
        setCapturedFile(file);
        setCapturedPreview(url);
        stopTracks();

        setEvaluating(true);
        try {
          const inspected = await inspectImage(file);
          setCapturedQuality({
            status: inspected.quality_status,
            details: inspected.quality_details as any,
          });
        } catch {
          // fallback quality
        } finally {
          setEvaluating(false);
        }
      },
      "image/jpeg",
      0.92,
    );
  };

  const retakePhoto = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedFile(null);
    setCapturedPreview(null);
    setCapturedQuality(null);
    void startCamera(activeDeviceId || undefined);
  };

  const confirmPhoto = () => {
    if (capturedFile) {
      onCapture(capturedFile);
    }
  };

  useEffect(() => {
    void startCamera();
    return () => {
      stopTracks();
      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview);
      }
    };
  }, []);

  const oralViewLabel = viewLabel(oralView, lang);
  const isAcceptable = capturedQuality?.status === "acceptable";
  const medgemma = capturedQuality?.details?.medgemma;

  return (
    <div
      className="live-camera-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={copy(
        "Live camera oral photo capture",
        "లైవ్ కెమెరా నోటి ఫోటో క్యాప్చర్",
      )}
    >
      <div className="live-camera-modal">
        {/* Header */}
        <header className="live-camera-header">
          <div>
            <div className="live-camera-title-row">
              <Camera size={20} className="camera-icon-badge" />
              <h3>
                {capturedPreview
                  ? copy("Review oral photograph", "నోటి ఫోటోను పరిశీలించండి")
                  : copy("Live camera capture", "లైవ్ కెమెరా క్యాప్చర్")}
              </h3>
            </div>
            <p className="live-camera-subheading">
              {copy("Target site", "లక్ష్య భాగం")}:{" "}
              <strong>{oralViewLabel}</strong> ·{" "}
              {copy(
                "Local image quality guidance",
                "స్థానిక చిత్ర నాణ్యత మార్గదర్శనం",
              )}
            </p>
          </div>
          <button
            type="button"
            className="icon-button-close"
            onClick={onClose}
            aria-label={copy("Close camera", "కెమెరా మూసివేయి")}
          >
            <X size={20} />
          </button>
        </header>

        {/* Viewport / Main Area */}
        <div className="live-camera-body">
          {error ? (
            <div className="live-camera-error">
              <AlertCircle size={44} color="#d9534f" />
              <h4>{copy("Camera unavailable", "కెమెరా అందుబాటులో లేదు")}</h4>
              <p>{error}</p>
              <div className="live-camera-error-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void startCamera(activeDeviceId || undefined)}
                >
                  <RefreshCw size={15} />
                  {copy("Retry camera", "మళ్లీ ప్రయత్నించండి")}
                </button>
                <button
                  type="button"
                  className="button primary"
                  onClick={onClose}
                >
                  {copy("Use file upload instead", "ఫైల్ అప్‌లోడ్ ఉపయోగించండి")}
                </button>
              </div>
            </div>
          ) : capturedPreview ? (
            /* Snapshot Review View */
            <div className="live-camera-review">
              <div className="captured-photo-wrapper">
                <img
                  src={capturedPreview}
                  alt={copy("Captured oral photo", "తీసిన నోటి చిత్రం")}
                  className="captured-photo-img"
                />
                <div className="captured-photo-badge-row">
                  <span
                    className={`badge ${isAcceptable ? "badge-completed" : "badge-missed"}`}
                  >
                    {isAcceptable
                      ? copy("Quality: Acceptable", "నాణ్యత: ఆమోదయోగ్యం")
                      : copy(
                          "Quality: Recapture recommended",
                          "నాణ్యత: మళ్లీ తీయండి",
                        )}
                  </span>
                  <span className="badge badge-subtle">
                    {copy("View", "భాగం")}: {oralViewLabel}
                  </span>
                </div>
              </div>

              {/* Google MedGemma Image Quality Feedback Card */}
              <div className="medgemma-live-card">
                <div className="medgemma-live-header">
                  <Sparkles size={16} />
                  <strong>
                    {copy(
                      "Local image quality checks",
                      "స్థానిక చిత్ర నాణ్యత తనిఖీలు",
                    )}
                  </strong>
                </div>

                {evaluating ? (
                  <p className="medgemma-eval-note">
                    {copy(
                      "Checking photograph brightness, focus and glare…",
                      "చిత్రం ప్రకాశం, స్పష్టత మరియు మెరుపును తనిఖీ చేస్తోంది…",
                    )}
                  </p>
                ) : (
                  <>
                    <p className="medgemma-recommendation">
                      {medgemma
                        ? localize(
                            lang,
                            medgemma.recommendation,
                            medgemma.recommendation_te,
                          )
                        : copy(
                            "Local image checks are capture guidance, not a clinical validation.",
                            "స్థానిక చిత్ర తనిఖీలు చిత్రం తీయడానికి మార్గదర్శనం మాత్రమే; వైద్య ధృవీకరణ కాదు.",
                          )}
                    </p>

                    <div className="medgemma-metrics-row">
                      <div className="metric-chip">
                        <span>{copy("Sharpness", "స్పష్టత")}</span>
                        <strong>
                          {capturedQuality?.details?.sharpness ?? "—"}
                        </strong>
                      </div>
                      <div className="metric-chip">
                        <span>{copy("Brightness", "ప్రకాశం")}</span>
                        <strong>
                          {capturedQuality?.details?.brightness ?? "—"}
                        </strong>
                      </div>
                      <div className="metric-chip">
                        <span>{copy("Glare", "మెరుపు")}</span>
                        <strong>
                          {capturedQuality?.details?.glare_percent !== undefined
                            ? `${capturedQuality.details.glare_percent}%`
                            : "—"}
                        </strong>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Live Camera Stream View */
            <div className="live-camera-stream-wrapper">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="live-camera-video"
              />

              {loading && (
                <div className="camera-loading-overlay">
                  <RefreshCw className="spin" size={32} />
                  <span>
                    {copy("Starting camera…", "కెమెరా ప్రారంభమవుతోంది…")}
                  </span>
                </div>
              )}

              {/* Live MedGemma Guidance Overlay */}
              <div className="live-guidance-overlay">
                {/* Real-time Quality Indicators */}
                <div className="live-quality-chips">
                  <div
                    className={`quality-chip ${liveLighting === "good" ? "chip-good" : "chip-warning"}`}
                  >
                    <Sun size={13} />
                    <span>
                      {liveLighting === "good"
                        ? copy("Lighting: Good", "వెలుతురు: బాగుంది")
                        : liveLighting === "low"
                          ? copy(
                              "Low light · Use torch",
                              "వెలుతురు తక్కువ · టార్చ్ వెలిగించండి",
                            )
                          : copy(
                              "High glare · Adjust angle",
                              "మెరుపు ఎక్కువ · కోణం మార్చండి",
                            )}
                    </span>
                  </div>

                  <div
                    className={`quality-chip ${liveFocus === "sharp" ? "chip-good" : "chip-warning"}`}
                  >
                    <Sparkles size={13} />
                    <span>
                      {liveFocus === "sharp"
                        ? copy("Focus: Sharp", "ఫోకస్: స్పష్టం")
                        : copy("Hold steady", "కదలకుండా ఉంచండి")}
                    </span>
                  </div>

                  <div className="quality-chip chip-medgemma">
                    <span>
                      {copy("Local image checks", "స్థానిక చిత్ర తనిఖీలు")}
                    </span>
                  </div>
                </div>

                {/* Intraoral Framing Reticle Guide */}
                <div className="intraoral-reticle">
                  <div className="reticle-frame">
                    <div className="reticle-corner top-left" />
                    <div className="reticle-corner top-right" />
                    <div className="reticle-corner bottom-left" />
                    <div className="reticle-corner bottom-right" />
                    <div className="reticle-guide-text">
                      {copy(
                        `Frame ${oralViewLabel} here`,
                        `${oralViewLabel} భాగం ఇక్కడ అమర్చండి`,
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer / Controls */}
        <footer className="live-camera-footer">
          {capturedPreview ? (
            /* Review Controls */
            <div className="live-camera-review-actions">
              <button
                type="button"
                className="button secondary"
                onClick={retakePhoto}
              >
                <RotateCcw size={16} />
                {copy("Retake photo", "మళ్లీ ఫోటో తీయండి")}
              </button>
              <button
                type="button"
                className="button primary"
                onClick={confirmPhoto}
              >
                <Check size={16} />
                {copy("Use this photo", "ఈ ఫోటో ఉపయోగించండి")}
              </button>
            </div>
          ) : (
            /* Live Stream Controls */
            <div className="live-camera-stream-actions">
              {/* Secondary toggles: Device selector / switch / torch */}
              <div className="stream-action-group">
                {torchAvailable && (
                  <button
                    type="button"
                    className={`button-pill ${torchOn ? "active" : ""}`}
                    onClick={toggleTorch}
                    title={copy(
                      "Toggle flashlight/torch",
                      "టార్చ్ లైట్ ఆన్/ఆఫ్",
                    )}
                  >
                    {torchOn ? <ZapOff size={16} /> : <Zap size={16} />}
                    <span>
                      {torchOn
                        ? copy("Torch on", "టార్చ్ ఆన్")
                        : copy("Torch", "టార్చ్")}
                    </span>
                  </button>
                )}

                {devices.length > 1 ? (
                  <select
                    className="camera-device-select"
                    value={activeDeviceId || ""}
                    onChange={(e) => switchDevice(e.target.value)}
                    aria-label={copy("Select camera", "కెమెరా ఎంచుకోండి")}
                  >
                    {devices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `${copy("Camera", "కెమెరా")} ${i + 1}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    className="button-pill"
                    onClick={toggleCameraFacing}
                    title={copy("Flip camera", "కెమెరా తిప్పండి")}
                  >
                    <RefreshCw size={15} />
                    <span>{copy("Flip", "తిప్పండి")}</span>
                  </button>
                )}
              </div>

              {/* Big Shutter Button */}
              <button
                type="button"
                className="shutter-button"
                onClick={snapPhoto}
                disabled={loading || Boolean(error)}
                aria-label={copy("Take oral photo", "నోటి ఫోటో తీయండి")}
              >
                <div className="shutter-inner">
                  <Camera size={26} />
                </div>
              </button>

              {/* Cancel Button */}
              <button type="button" className="button subtle" onClick={onClose}>
                {copy("Cancel", "రద్దు")}
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
