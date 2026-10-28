import { useCallback, useEffect, useRef, useState } from "react";
import {
  configurationError,
  fetchProfile,
  fetchWorkspace,
  isCloud,
  submitCloud,
  supabase,
} from "./client";
import { demoProfiles, summarize, visibleDemo } from "./demo";
import { careApi, serviceStatus, type ServiceStatus } from "./services";
import {
  getLocal,
  listDrafts,
  loadDemo,
  mutateDemo,
  queueDraft,
  removeDraft,
  resetDemo,
  setLocal,
} from "./storage";
import {
  emptyData,
  type Command,
  type Draft,
  type Profile,
  type Role,
  type Summary,
} from "./types";

export function useWorkspace() {
  const [services, setServices] = useState<ServiceStatus>({
    database: false,
    files: false,
    video: false,
    ai: false,
    reminders: false,
  });
  useEffect(() => {
    void serviceStatus()
      .then(setServices)
      .catch(() => {});
  }, []);
  const [profile, setProfile] = useState<Profile | null>(null),
    [data, setData] = useState(emptyData),
    [summary, setSummary] = useState<Summary>(() => summarize(emptyData()));
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [online, setOnline] = useState(navigator.onLine);
  const lock = useRef(false),
    syncing = useRef(false),
    generation = useRef(0);
  const scope = isCloud ? "supabase" : "demo";
  const refresh = useCallback(
    async (actor: Profile) => {
      const version = ++generation.current;
      const next = isCloud
        ? await fetchWorkspace(actor)
        : { data: await loadDemo(), summary: null };
      if (version !== generation.current) return;
      const visible = isCloud ? next.data : visibleDemo(next.data, actor.role);
      setData(visible);
      setSummary(
        next.summary ??
          summarize(actor.role === "district_admin" ? next.data : visible),
      );
      setDrafts(await listDrafts(actor.id, scope));
      setError("");
    },
    [scope],
  );
  useEffect(() => {
    let alive = true;
    const enter = async (id?: string) => {
      setLoading(true);
      try {
        if (configurationError) throw new Error(configurationError);
        if (isCloud && !id) {
          setProfile(null);
          setData(emptyData());
          return;
        }
        const actor = isCloud
          ? await fetchProfile(id!)
          : (demoProfiles.find(
              (p) => p.role === localStorage.getItem("aarogya-demo-role"),
            ) ?? demoProfiles[0]);
        if (!alive) return;
        setProfile(actor);
        await refresh(actor);
      } catch (e) {
        if (alive) setError(message(e));
      } finally {
        if (alive) setLoading(false);
      }
    };
    if (supabase) {
      supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          setError(error.message);
          setLoading(false);
        } else void enter(data.session?.user.id);
      });
    } else void enter();
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT")
        setTimeout(() => {
          if (alive) void enter(session?.user.id);
        }, 0);
    });
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      alive = false;
      subscription?.data.subscription.unsubscribe();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh]);

  const execute = useCallback(
    async (
      action: Command["action"],
      payload: Record<string, unknown>,
      retryId?: string,
    ) => {
      if (!profile) throw new Error("Sign in first.");
      if (lock.current) throw new Error("Please wait for the current action.");
      lock.current = true;
      setBusy(true);
      const command: Command = {
        id:
          retryId ??
          (action === "register"
            ? String(payload.patient_id)
            : crypto.randomUUID()),
        actor: profile.id,
        action,
        payload,
        created_at: new Date().toISOString(),
      };
      try {
        if (action === "register") {
          await queueDraft(
            {
              id: command.id,
              actor: profile.id,
              payload,
              created_at: command.created_at,
              status: "pending",
            },
            scope,
          );
          if (!navigator.onLine) {
            setDrafts(await listDrafts(profile.id, scope));
            return "queued" as const;
          }
        } else if (!navigator.onLine)
          throw new Error(
            "Reconnect before changing clinical records. Registration drafts can be saved offline.",
          );
        if (isCloud && action === "image")
          await careApi("upload", {
            kind: "oral",
            data_url: payload.preview,
            ...payload,
          });
        else if (isCloud && action === "document")
          await careApi("upload", {
            kind: "report",
            data_url: payload.preview,
            ...payload,
          });
        else if (isCloud && action === "analyze")
          await careApi("analyze", payload);
        else if (isCloud) await submitCloud(command);
        else await mutateDemo(profile, command);
        if (action === "register") await removeDraft(command.id);
        await refresh(profile);
        return "saved" as const;
      } catch (e) {
        if (action === "register") {
          await queueDraft(
            {
              id: command.id,
              actor: profile.id,
              payload,
              created_at: command.created_at,
              status: "failed",
              error: message(e),
            },
            scope,
          );
          setDrafts(await listDrafts(profile.id, scope));
        }
        throw e;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [profile, refresh, scope],
  );

  const sync = useCallback(async () => {
    if (!profile || syncing.current || !navigator.onLine) return;
    syncing.current = true;
    let failure = "";
    try {
      for (const draft of await listDrafts(profile.id, scope)) {
        try {
          await execute("register", draft.payload, draft.id);
        } catch (e) {
          failure = message(e);
          setError(failure);
        }
      }
    } finally {
      syncing.current = false;
    }
    if (failure) throw new Error(failure);
  }, [profile, scope, execute]);
  useEffect(() => {
    if (online && profile) void sync().catch((e) => setError(message(e)));
  }, [online, profile?.id]); // Retry only on reconnect/session change.
  return {
    services,
    refreshServices: async () => setServices(await serviceStatus()),
    profile,
    data,
    summary,
    loading,
    busy,
    error,
    setError,
    drafts,
    online,
    scope,
    execute,
    sync,
    refresh: async () => {
      if (profile) await refresh(profile);
    },
    changeRole: async (role: Role) => {
      if (isCloud || busy) return;
      const actor = demoProfiles.find((p) => p.role === role)!;
      localStorage.setItem("aarogya-demo-role", role);
      setProfile(actor);
      await refresh(actor);
    },
    reset: async () => {
      if (!isCloud && profile) {
        await resetDemo();
        await refresh(profile);
      }
    },
    signOut: async () => {
      await supabase?.auth.signOut();
      setProfile(null);
      setData(emptyData());
    },
    saveForm: async (value: unknown) => {
      if (profile) await setLocal(`form:${scope}:${profile.id}`, value);
    },
    loadForm: async () =>
      profile
        ? await getLocal<Record<string, unknown>>(`form:${scope}:${profile.id}`)
        : undefined,
  };
}
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "Something went wrong. Please try again.";
