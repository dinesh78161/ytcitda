// Deterministic SDK boundary for permission and playback failure tests.
export const Track = { Kind: { Video: "video", Audio: "audio" } };
export const VideoPresets = {
  h720: { resolution: { width: 1280, height: 720 } },
};
export const RoomEvent = Object.fromEntries(
  [
    "TrackSubscribed",
    "TrackUnsubscribed",
    "LocalTrackPublished",
    "LocalTrackUnpublished",
    "ParticipantConnected",
    "ParticipantDisconnected",
    "AudioPlaybackStatusChanged",
    "TrackMuted",
    "TrackUnmuted",
    "ParticipantNameChanged",
    "Reconnecting",
    "Reconnected",
    "Disconnected",
  ].map((name) => [name, name]),
);
const flags = new URLSearchParams(location.search);
const resources: { stop(): void }[] = [];
function track(kind: string, label: string) {
  const elements: HTMLMediaElement[] = [];
  let stream: MediaStream;
  if (kind === "video") {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#236c54";
    context.fillRect(0, 0, 640, 360);
    context.fillStyle = "white";
    context.font = "28px sans-serif";
    context.fillText(label, 30, 180);
    stream = canvas.captureStream(10);
  } else {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const output = audio.createMediaStreamDestination();
    oscillator.connect(output);
    oscillator.start();
    void audio.resume();
    stream = output.stream;
    resources.push({
      stop() {
        oscillator.stop();
        void audio.close();
      },
    });
  }
  const result = {
    kind,
    attach() {
      const element = document.createElement(
        kind === "video" ? "video" : "audio",
      );
      element.srcObject = stream;
      element.autoplay = true;
      elements.push(element);
      return element;
    },
    detach() {
      return elements.splice(0);
    },
    stop() {
      stream.getTracks().forEach((t) => t.stop());
    },
  };
  resources.push(result);
  return result;
}
export class Room {
  handlers = new Map<string, Function[]>();
  remoteParticipants = new Map();
  canPlaybackAudio = false;
  audioAttempts = 0;
  disconnected = false;
  blockAudio = flags.has("blocked");
  localParticipant = {
    isMicrophoneEnabled: false,
    isCameraEnabled: false,
    trackPublications: new Map(),
    setMicrophoneEnabled: async (enabled: boolean) => {
      if (flags.has("no-microphone")) throw Error("Microphone denied");
      this.localParticipant.isMicrophoneEnabled = enabled;
    },
    setCameraEnabled: async (enabled: boolean) => {
      if (flags.has("no-camera")) throw Error("Camera denied");
      this.localParticipant.isCameraEnabled = enabled;
      if (enabled && !this.localParticipant.trackPublications.size) {
        const publication = { track: track("video", "Your small preview") };
        this.localParticipant.trackPublications.set("camera", publication);
        this.emit("LocalTrackPublished", publication);
      }
    },
  };
  constructor() {
    (window as any).testRoom = this;
  }
  on(event: string, handler: Function) {
    this.handlers.set(event, [...(this.handlers.get(event) || []), handler]);
    return this;
  }
  emit(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.forEach((h) => h(...args));
  }
  async connect() {
    const audio = {
      track: track("audio", "Worker voice"),
      isSubscribed: true,
      isMuted: false,
    };
    const video = {
      track: track("video", "Other participant — main view"),
      isSubscribed: true,
      isMuted: false,
    };
    this.remoteParticipants.set("worker", {
      name: "Worker (Community Health Worker)",
      audioTrackPublications: new Map([["microphone", audio]]),
      videoTrackPublications: new Map([["camera", video]]),
    });
    this.emit("ParticipantConnected");
    this.emit("TrackSubscribed", audio.track);
    this.emit("TrackSubscribed", video.track);
  }
  async startAudio() {
    this.audioAttempts++;
    if (this.blockAudio) {
      this.canPlaybackAudio = false;
      this.emit("AudioPlaybackStatusChanged");
      throw new DOMException("Autoplay blocked", "NotAllowedError");
    }
    await Promise.all(
      Array.from(document.querySelectorAll("audio")).map((el) => el.play()),
    );
    this.canPlaybackAudio = true;
    this.emit("AudioPlaybackStatusChanged");
  }
  async disconnect() {
    this.disconnected = true;
    resources.splice(0).forEach((r) => r.stop());
    this.emit("Disconnected");
  }
  removeAllListeners() {
    this.handlers.clear();
  }
}
