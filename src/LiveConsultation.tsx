import { localize } from "./lib/localize";
import { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type LocalTrackPublication,
} from "livekit-client";
import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  ShieldCheck,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { careApi, type VideoAccess } from "./lib/services";
import type { Language } from "./lib/types";

export default function LiveConsultation({
  access,
  appointmentId,
  lang,
  userRole,
  userName,
  patientName,
}: {
  access: Extract<VideoAccess, { provider: "livekit" }>;
  appointmentId: string;
  lang: Language;
  userRole?: string;
  userName?: string;
  patientName?: string;
}) {
  const containerRef = useRef<HTMLElement>(null),
    local = useRef<HTMLDivElement>(null),
    remote = useRef<HTMLDivElement>(null),
    remoteAudio = useRef<HTMLDivElement>(null),
    activeRoom = useRef<Room | null>(null);

  const [connected, setConnected] = useState(false),
    [error, setError] = useState(""),
    [microphone, setMicrophone] = useState(false),
    [camera, setCamera] = useState(false),
    [audioBlocked, setAudioBlocked] = useState(false),
    [changing, setChanging] = useState(false),
    [participants, setParticipants] = useState(0),
    [remoteName, setRemoteName] = useState(""),
    [hasRemoteVideo, setHasRemoteVideo] = useState(false),
    [remoteMicrophone, setRemoteMicrophone] = useState(false),
    [reconnecting, setReconnecting] = useState(false),
    [isFullscreen, setIsFullscreen] = useState(false);

  const l = (en: string, te: string) => localize(lang, en, te);

  const isDoctor = userRole === "specialist" || userRole === "medical_officer";
  const isHealthWorker = userRole === "health_worker" || !isDoctor;

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      // Fullscreen not permitted or cancelled
    }
  };

  useEffect(() => {
    let live = true,
      checking = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    activeRoom.current = room;

    const stop = (reason: string) => {
      if (!live) return;
      setError(reason);
      setConnected(false);
      void room.disconnect(true);
    };

    const attachLocal = (publication: LocalTrackPublication) => {
      if (publication.track?.kind !== Track.Kind.Video || !live) return;
      const video = publication.track.attach() as HTMLVideoElement;
      video.muted = true;
      video.playsInline = true;
      local.current?.appendChild(video);
    };

    const update = () => {
      if (!live) return;
      const remotes = Array.from(room.remoteParticipants.values());
      setParticipants(remotes.length);

      if (remotes.length > 0) {
        const first = remotes[0];
        setRemoteName(first.name || "");

        const videoTracks = Array.from(
          first.videoTrackPublications.values(),
        ).filter((pub) => pub.isSubscribed && pub.track && !pub.isMuted);
        setHasRemoteVideo(videoTracks.length > 0);
        setRemoteMicrophone(
          Array.from(first.audioTrackPublications.values()).some(
            (pub) => pub.isSubscribed && pub.track && !pub.isMuted,
          ),
        );
      } else {
        setRemoteName("");
        setHasRemoteVideo(false);
        setRemoteMicrophone(false);
      }

      setMicrophone(room.localParticipant.isMicrophoneEnabled);
      setCamera(room.localParticipant.isCameraEnabled);
    };

    const startAudio = async () => {
      try {
        await room.startAudio();
        if (live) setAudioBlocked(!room.canPlaybackAudio);
      } catch {
        if (live) setAudioBlocked(true);
      }
    };

    room
      .on(RoomEvent.TrackSubscribed, (track) => {
        if (!live) return;
        const element = track.attach();
        element.autoplay = true;
        if (track.kind === Track.Kind.Audio) {
          element.muted = false;
          element.volume = 1;
          remoteAudio.current?.appendChild(element);
          void startAudio();
        } else {
          if (element instanceof HTMLVideoElement) element.playsInline = true;
          remote.current?.appendChild(element);
        }
        update();
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
        update();
      })
      .on(RoomEvent.LocalTrackPublished, (publication) => {
        attachLocal(publication);
        update();
      })
      .on(RoomEvent.LocalTrackUnpublished, (publication) => {
        publication.track?.detach().forEach((el) => el.remove());
        update();
      })
      .on(RoomEvent.ParticipantConnected, update)
      .on(RoomEvent.ParticipantDisconnected, update)
      .on(RoomEvent.TrackMuted, update)
      .on(RoomEvent.TrackUnmuted, update)
      .on(RoomEvent.ParticipantNameChanged, update)
      .on(RoomEvent.Reconnecting, () => {
        if (!live) return;
        setReconnecting(true);
        setConnected(false);
      })
      .on(RoomEvent.Reconnected, () => {
        if (!live) return;
        setReconnecting(false);
        setConnected(true);
        update();
        void startAudio();
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (live) setAudioBlocked(!room.canPlaybackAudio);
      })
      .on(RoomEvent.Disconnected, () => {
        if (!live) return;
        setConnected(false);
        setReconnecting(false);
        setParticipants(0);
        setHasRemoteVideo(false);
        setRemoteMicrophone(false);
        setError(
          (previous) =>
            previous ||
            localize(
              lang,
              "Call disconnected. Close this window and join again.",
            ),
        );
      });

    void (async () => {
      try {
        await room.connect(access.server_url, access.token);
        if (!live) {
          await room.disconnect(true);
          return;
        }
        setConnected(true);
        void startAudio();
        // Start each device independently so a camera failure cannot silence the microphone.
        const devices = await Promise.allSettled([
          room.localParticipant.setMicrophoneEnabled(true),
          room.localParticipant.setCameraEnabled(true),
        ]);
        if (devices.some((result) => result.status === "rejected")) {
          if (live)
            setError(
              localize(
                lang,
                devices[0].status === "rejected"
                  ? "Your microphone could not start. Allow microphone access in your browser, then select Unmute mic."
                  : "Your camera could not start. Allow camera access in your browser, then select Turn camera on. Your microphone can still be used.",
                devices[0].status === "rejected"
                  ? "మీ మైక్ ప్రారంభం కాలేదు. బ్రౌజర్‌లో మైక్ అనుమతి ఇచ్చి మైక్ ప్రారంభించండి ఎంచుకోండి."
                  : "మీ కెమెరా ప్రారంభం కాలేదు. బ్రౌజర్‌లో కెమెరా అనుమతి ఇచ్చి కెమెరా ప్రారంభించండి ఎంచుకోండి. మైక్ ఉపయోగించవచ్చు.",
              ),
            );
        }
        if (!live) {
          room.localParticipant.trackPublications.forEach((publication) =>
            publication.track?.stop(),
          );
          await room.disconnect(true);
          return;
        }
        update();
      } catch {
        stop(
          localize(
            lang,
            "Video could not connect. Check your network, close this window and join again.",
            "వీడియో కనెక్ట్ కాలేదు. నెట్‌వర్క్ తనిఖీ చేసి మళ్లీ చేరండి.",
          ),
        );
      }
    })();

    const expiry = setTimeout(
      () =>
        stop(
          localize(
            lang,
            "This appointment's consultation window has ended.",
            "సంప్రదింపు సమయం ముగిసింది.",
          ),
        ),
      Math.max(1, access.expires_at * 1000 - Date.now()),
    );

    const authorization = setInterval(() => {
      if (checking || !live) return;
      checking = true;
      void careApi<VideoAccess>("video", { appointment_id: appointmentId })
        .then((next) => {
          if (
            next.provider !== "livekit" ||
            next.room_name !== access.room_name
          )
            stop(
              localize(
                lang,
                "The appointment changed. Close this window and join again.",
                "అపాయింట్‌మెంట్ మారింది. మళ్లీ చేరండి.",
              ),
            );
        })
        .catch(() =>
          stop(
            localize(
              lang,
              "Consultation access could not be renewed. Close this window and join again.",
              "సంప్రదింపు అనుమతి నిర్ధారించలేకపోయాము.",
            ),
          ),
        )
        .finally(() => {
          checking = false;
        });
    }, 60000);

    return () => {
      live = false;
      clearTimeout(expiry);
      clearInterval(authorization);
      activeRoom.current = null;
      room.removeAllListeners();
      void room.disconnect(true);
      local.current?.replaceChildren();
      remote.current?.replaceChildren();
      remoteAudio.current?.replaceChildren();
    };
  }, [access, appointmentId, lang]);

  async function enableAudio() {
    const room = activeRoom.current;
    if (!room) return;
    try {
      // Keep this call directly in the click handler to unlock browser audio playback.
      await room.startAudio();
      setAudioBlocked(!room.canPlaybackAudio);
    } catch {
      setAudioBlocked(true);
    }
  }

  async function toggle(kind: "microphone" | "camera") {
    const room = activeRoom.current;
    if (!room) return;
    setChanging(true);
    setError("");
    try {
      if (kind === "microphone") {
        await room.localParticipant.setMicrophoneEnabled(!microphone);
        setMicrophone(room.localParticipant.isMicrophoneEnabled);
      } else {
        await room.localParticipant.setCameraEnabled(!camera);
        setCamera(room.localParticipant.isCameraEnabled);
      }
    } catch {
      setError(
        l(
          "Allow camera/microphone permissions in your browser and retry.",
          "బ్రౌజర్‌లో కెమెరా/మైక్ అనుమతి ఇచ్చి మళ్లీ ప్రయత్నించండి.",
        ),
      );
    } finally {
      setChanging(false);
    }
  }

  // Determine local participant clinical role label
  const localRoleBadge = isDoctor
    ? userRole === "specialist"
      ? l("Specialist Doctor (You)", "స్పెషలిస్ట్ డాక్టర్ (మీరు)")
      : l("Medical Officer · Doctor (You)", "మెడికల్ ఆఫీసర్ · డాక్టర్ (మీరు)")
    : l(
        "Community Health Worker & Patient (You)",
        "ఫీల్డ్ హెల్త్ వర్కర్ & రోగి (మీరు)",
      );

  // Determine remote participant clinical label
  const defaultRemoteTitle = isHealthWorker
    ? l("Specialist Doctor", "స్పెషలిస్ట్ డాక్టర్")
    : l("Community Health Worker & Patient", "ఫీల్డ్ హెల్త్ వర్కర్ & రోగి");

  const remoteDisplayTitle = remoteName || defaultRemoteTitle;

  return (
    <section
      ref={containerRef}
      className={`live-consultation ${isFullscreen ? "fullscreen-active" : ""}`}
      aria-label={l("Secure video consultation", "సురక్షిత వీడియో సంప్రదింపు")}
    >
      <div className="consultation-status-bar">
        <p role="status" className="consultation-conn-text">
          <span className={`status-pill ${connected ? "online" : "offline"}`}>
            <span className="pulse-dot" />
            {connected
              ? l("Connected · Live call", "అనుసంధానమైంది · లైవ్ కాల్")
              : reconnecting
                ? l("Reconnecting…", "మళ్లీ కనెక్ట్ అవుతోంది…")
                : error
                  ? l("Disconnected", "కనెక్షన్ ఆగిపోయింది")
                  : l("Connecting…", "కనెక్ట్ అవుతోంది…")}
          </span>
          <span className="status-separator">·</span>
          <span className="privacy-badge">
            <ShieldCheck size={14} />
            {l(
              "Encrypted clinical teleconsultation · Recording disabled for patient privacy",
              "ఎన్‌క్రిప్ట్ చేసిన క్లినికల్ టెలి-సంప్రదింపు · గోప్యత కోసం రికార్డింగ్ నిలిపివేయబడింది",
            )}
          </span>
        </p>
      </div>

      {error && (
        <p className="error-box" role="alert">
          {localize(lang, error)}
        </p>
      )}
      <div ref={remoteAudio} className="consultation-audio" />
      {audioBlocked && (
        <p className="consultation-audio-notice" role="status">
          {l(
            "Call sound is blocked. Select Enable call audio below to hear the other participant.",
            "కాల్ శబ్దం ఆపబడింది. వినడానికి కింద కాల్ ఆడియో ప్రారంభించండి ఎంచుకోండి.",
          )}
        </p>
      )}

      <div className="consultation-grid">
        {/* Remote Tile (Main Focus: Specialist Doctor or Patient Video) */}
        <div className="consultation-tile consultation-tile-remote">
          <div className="consultation-tile-header">
            <span className="tile-title-badge">
              {participants > 0 ? (
                <>
                  <span
                    className="live-indicator-dot online"
                    aria-hidden="true"
                  />
                  <strong className="participant-role-name">
                    👨‍⚕️ {remoteDisplayTitle}
                  </strong>
                </>
              ) : (
                <>
                  <span
                    className="live-indicator-dot waiting"
                    aria-hidden="true"
                  />
                  <strong className="participant-role-name">
                    {isHealthWorker
                      ? l("👨‍⚕️ Specialist Doctor", "👨‍⚕️ స్పెషలిస్ట్ డాక్టర్")
                      : l(
                          "🏥 Health Worker & Patient",
                          "🏥 ఫీల్డ్ హెల్త్ వర్కర్ & రోగి",
                        )}
                  </strong>
                </>
              )}
            </span>
            <span className="tile-subbadge">
              {participants > 0
                ? hasRemoteVideo
                  ? l("Live video", "లైవ్ వీడియో")
                  : l("Camera off", "కెమెరా ఆఫ్")
                : l("Awaiting Join", "చేరడం కోసం వేచి ఉంది")}
            </span>
          </div>

          <div className="consultation-video-viewport">
            <div ref={remote} className="video-stream-container" />
            {(!participants || !hasRemoteVideo) && (
              <div className="consultation-waiting-state">
                <div className="radar-spinner" aria-hidden="true" />
                <h4 className="waiting-heading">
                  {participants > 0
                    ? l(
                        "Participant's camera is off",
                        "పాల్గొనేవారి కెమెరా ఆఫ్‌లో ఉంది",
                      )
                    : isHealthWorker
                      ? l(
                          "Waiting for Specialist Doctor to join…",
                          "స్పెషలిస్ట్ డాక్టర్ చేరడం కోసం వేచి ఉంది…",
                        )
                      : l(
                          patientName
                            ? `Waiting for Health Worker & ${patientName}…`
                            : "Waiting for Health Worker & Patient to join…",
                          patientName
                            ? `హెల్త్ వర్కర్ & ${patientName} చేరడం కోసం వేచి ఉంది…`
                            : "హెల్త్ వర్కర్ మరియు రోగి చేరడం కోసం వేచి ఉంది…",
                        )}
                </h4>
                <p className="waiting-subtext">
                  {participants > 0
                    ? l(
                        "You can continue speaking while their camera is off.",
                        "వారి కెమెరా ఆఫ్‌లో ఉన్నా మాట్లాడవచ్చు.",
                      )
                    : isHealthWorker
                      ? l(
                          "The other participant must join this appointment from their device.",
                          "ఇతర పాల్గొనేవారు వారి పరికరం నుండి ఈ అపాయింట్‌మెంట్‌లో చేరాలి.",
                        )
                      : l(
                          "The health worker must join this appointment from their device.",
                          "హెల్త్ వర్కర్ వారి పరికరం నుండి ఈ అపాయింట్‌మెంట్‌లో చేరాలి.",
                        )}
                </p>
              </div>
            )}
          </div>
          {participants > 0 && (
            <p className="consultation-remote-audio-status" role="status">
              {remoteMicrophone ? <Mic size={14} /> : <MicOff size={14} />}
              {remoteMicrophone
                ? l(
                    "Participant microphone on",
                    "పాల్గొనేవారి మైక్ ఆన్‌లో ఉంది",
                  )
                : l(
                    "Participant microphone off — ask them to unmute",
                    "పాల్గొనేవారి మైక్ ఆఫ్‌లో ఉంది — ఆన్ చేయమని అడగండి",
                  )}
            </p>
          )}
        </div>

        {/* Local Tile (Self View) */}
        <div className="consultation-tile consultation-tile-local">
          <div className="consultation-tile-header">
            <span className="tile-title-badge">
              <span
                className={`live-indicator-dot ${camera ? "online" : "muted"}`}
                aria-hidden="true"
              />
              <span>{localRoleBadge}</span>
            </span>
            <span className="tile-subbadge">
              {camera
                ? l("Camera On", "కెమెరా ఆన్")
                : l("Camera Off", "కెమెరా ఆఫ్")}
            </span>
          </div>

          <div className="consultation-video-viewport">
            <div ref={local} className="video-stream-container" />
            {!camera && (
              <div className="camera-off-overlay">
                <VideoOff size={32} />
                <p>{l("Your camera is muted", "మీ కెమెరా ఆపబడింది")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="care-actions consultation-toolbar">
        <button
          type="button"
          className={`button ${microphone ? "secondary" : "danger-subtle"}`}
          disabled={!connected || changing}
          onClick={() => void toggle("microphone")}
          title={
            microphone
              ? l("Mute microphone", "మైక్ ఆపండి")
              : l("Enable microphone", "మైక్ ప్రారంభించండి")
          }
        >
          {microphone ? <Mic size={16} /> : <MicOff size={16} />}
          <span>
            {microphone
              ? l("Mute mic", "మైక్ ఆపండి")
              : l("Unmute mic", "మైక్ ప్రారంభించండి")}
          </span>
        </button>

        <button
          type="button"
          className={`button ${camera ? "secondary" : "danger-subtle"}`}
          disabled={!connected || changing}
          onClick={() => void toggle("camera")}
          title={
            camera
              ? l("Turn camera off", "కెమెరా ఆపండి")
              : l("Turn camera on", "కెమెరా ప్రారంభించండి")
          }
        >
          {camera ? <Video size={16} /> : <VideoOff size={16} />}
          <span>
            {camera
              ? l("Turn camera off", "కెమెరా ఆపండి")
              : l("Turn camera on", "కెమెరా ప్రారంభించండి")}
          </span>
        </button>

        <button
          type="button"
          className={`button ${audioBlocked ? "primary" : "secondary"}`}
          disabled={!connected}
          onClick={() => void enableAudio()}
        >
          <Volume2 size={16} />
          <span>
            {audioBlocked
              ? l("Enable call audio", "కాల్ శబ్దం ప్రారంభించండి")
              : l("Check call audio", "కాల్ శబ్దం తనిఖీ చేయండి")}
          </span>
        </button>

        <button
          type="button"
          className="button secondary fullscreen-btn"
          onClick={toggleFullscreen}
          title={
            isFullscreen
              ? l("Exit full screen", "సాధారణ వీక్షణకు మార్చు")
              : l("Maximize to full screen", "పూర్తి స్క్రీన్‌కు మార్చు")
          }
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          <span>
            {isFullscreen
              ? l("Exit Fullscreen", "సాధారణ వీక్షణ")
              : l("Full Screen", "పూర్తి స్క్రీన్")}
          </span>
        </button>
      </div>
    </section>
  );
}
