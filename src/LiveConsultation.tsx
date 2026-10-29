import { localize } from "./lib/localize";
import { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type LocalTrackPublication,
} from "livekit-client";
import { careApi, type VideoAccess } from "./lib/services";
import type { Language } from "./lib/types";

export default function LiveConsultation({
  access,
  appointmentId,
  lang,
}: {
  access: Extract<VideoAccess, { provider: "livekit" }>;
  appointmentId: string;
  lang: Language;
}) {
  const local = useRef<HTMLDivElement>(null),
    remote = useRef<HTMLDivElement>(null),
    activeRoom = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false),
    [error, setError] = useState(""),
    [microphone, setMicrophone] = useState(false),
    [camera, setCamera] = useState(false),
    [audioBlocked, setAudioBlocked] = useState(false),
    [changing, setChanging] = useState(false),
    [participants, setParticipants] = useState(0);
  const l = (en: string, te: string) => localize(lang, en, te);
  useEffect(() => {
    let live = true,
      checking = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: { resolution: VideoPresets.h360.resolution },
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
      setParticipants(room.remoteParticipants.size);
      setMicrophone(room.localParticipant.isMicrophoneEnabled);
      setCamera(room.localParticipant.isCameraEnabled);
    };
    room
      .on(RoomEvent.TrackSubscribed, (track) => {
        if (!live) return;
        const element = track.attach();
        if (element instanceof HTMLVideoElement) element.playsInline = true;
        remote.current?.appendChild(element);
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
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (live) setAudioBlocked(!room.canPlaybackAudio);
      })
      .on(RoomEvent.Disconnected, () => {
        if (live) setConnected(false);
      });
    void (async () => {
      try {
        await room.connect(access.server_url, access.token);
        if (!live) {
          await room.disconnect(true);
          return;
        }
        setConnected(true);
        try {
          await room.localParticipant.enableCameraAndMicrophone();
        } catch (cause) {
          if (live)
            setError(
              localize(
                lang,
                "Camera/microphone could not start. Check permissions and use the controls below to retry.",
                "కెమెరా/మైక్ ప్రారంభించలేకపోయాము. అనుమతులు తనిఖీ చేసి కింద ఉన్న బటన్లతో మళ్లీ ప్రయత్నించండి.",
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
    };
  }, [access, appointmentId, lang]);
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
  return (
    <section
      className="live-consultation"
      aria-label={l("Secure video consultation", "సురక్షిత వీడియో సంప్రదింపు")}
    >
      <p role="status">
        {connected
          ? l("Connected", "అనుసంధానమైంది")
          : l(
              "Connecting or disconnected",
              "కనెక్ట్ అవుతోంది లేదా కనెక్షన్ లేదు",
            )}{" "}
        ·{" "}
        {l(
          "Encrypted clinical stream · Recording disabled for privacy",
          "ఎన్‌క్రిప్ట్ చేసిన క్లినికల్ స్ట్రీమ్ · గోప్యత కోసం రికార్డింగ్ నిలిపివేయబడింది",
        )}
      </p>
      {error && (
        <p className="error-box" role="alert">
          {localize(lang, error)}
        </p>
      )}
      <div className="consultation-grid">
        <div className="consultation-tile">
          <span>{l("Your camera", "మీ కెమెరా")}</span>
          <div ref={local} />
        </div>
        <div className="consultation-tile">
          <span>
            {participants
              ? l("Other participant", "ఇతర సభ్యుడు")
              : l(
                  "Waiting for the other participant…",
                  "ఇతర సభ్యుని కోసం వేచి ఉంది…",
                )}
          </span>
          <div ref={remote} />
        </div>
      </div>
      <div className="care-actions">
        <button
          className="button secondary"
          disabled={!connected || changing}
          onClick={() => void toggle("microphone")}
        >
          {microphone
            ? l("Mute microphone", "మైక్ ఆపండి")
            : l("Enable microphone", "మైక్ ప్రారంభించండి")}
        </button>
        <button
          className="button secondary"
          disabled={!connected || changing}
          onClick={() => void toggle("camera")}
        >
          {camera
            ? l("Turn camera off", "కెమెరా ఆపండి")
            : l("Turn camera on", "కెమెరా ప్రారంభించండి")}
        </button>
        {audioBlocked && (
          <button
            className="button primary"
            onClick={() => void activeRoom.current?.startAudio()}
          >
            {l("Enable call audio", "కాల్ శబ్దం ప్రారంభించండి")}
          </button>
        )}
      </div>
    </section>
  );
}
