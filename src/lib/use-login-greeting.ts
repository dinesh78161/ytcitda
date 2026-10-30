import { useCallback, useEffect, useRef, useState } from "react";
import { greetingAudioPath } from "./greetings";
import type { Language } from "./languages";

// Only fixed, bundled greetings are played. No names, patient details or runtime
// text-to-speech requests are sent to another service.
function createGreetingPlayer() {
  let context: AudioContext | undefined;
  let source: AudioBufferSourceNode | undefined;
  let revision = 0;
  const buffers = new Map<Language, Promise<AudioBuffer>>();
  const getContext = () => {
    if (!context || context.state === "closed") {
      context = new AudioContext();
      buffers.clear();
    }
    return context;
  };
  const load = (language: Language, audio: AudioContext) => {
    let pending = buffers.get(language);
    if (!pending) {
      pending = fetch(greetingAudioPath(language), {
        signal: AbortSignal.timeout(10000),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Greeting audio unavailable.");
          return audio.decodeAudioData(await response.arrayBuffer());
        })
        .catch((error: unknown) => {
          buffers.delete(language);
          throw error;
        });
      buffers.set(language, pending);
    }
    return pending;
  };
  const stop = () => {
    revision++;
    try {
      source?.stop();
    } catch {
      // A source that failed to start may already be stopped.
    }
    source?.disconnect();
    source = undefined;
  };
  return {
    prepare(language: Language) {
      try {
        // Unlock audio inside the sign-in gesture, before the network request.
        const audio = getContext();
        void audio.resume().catch(() => {});
        void load(language, audio).catch(() => {});
      } catch {
        // Audio support must never prevent authentication.
      }
    },
    async play(language: Language) {
      stop();
      const version = revision;
      try {
        const audio = getContext();
        const resumed = audio.resume().catch(() => {});
        const buffer = await load(language, audio);
        await resumed;
        if (version !== revision || audio.state !== "running") return;
        source = audio.createBufferSource();
        source.buffer = buffer;
        source.connect(audio.destination);
        source.onended = () => {
          if (version === revision) {
            source?.disconnect();
            source = undefined;
          }
        };
        source.start();
      } catch {
        // The header's play button permits a fresh user gesture if autoplay was
        // blocked. A missing clip or audio device does not interrupt the app.
      }
    },
    stop,
    dispose() {
      stop();
      if (context) void context.close().catch(() => {});
      context = undefined;
      buffers.clear();
    },
  };
}

export function useLoginGreeting(language: Language, ready: boolean) {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem("aarogya-login-greeting") !== "off",
  );
  const player = useRef<ReturnType<typeof createGreetingPlayer> | null>(null);
  if (!player.current) player.current = createGreetingPlayer();
  const audio = player.current;
  const pending = useRef(false);

  useEffect(() => {
    localStorage.setItem("aarogya-login-greeting", enabled ? "on" : "off");
  }, [enabled]);
  useEffect(() => {
    if (ready && pending.current) {
      pending.current = false;
      void audio.play(language);
    } else if (!ready) audio.stop();
  }, [ready, language, audio]);
  useEffect(() => () => audio.dispose(), [audio]);

  const begin = useCallback(() => {
    pending.current = enabled;
    if (enabled) audio.prepare(language);
  }, [audio, enabled, language]);
  const cancel = useCallback(() => {
    pending.current = false;
    audio.stop();
  }, [audio]);
  const play = () => {
    audio.prepare(language);
    void audio.play(language);
  };
  return { enabled, setEnabled, begin, cancel, play };
}
