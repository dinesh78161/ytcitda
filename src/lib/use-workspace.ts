import { useCallback, useEffect, useRef, useState } from "react";
import {
  configurationError,
  fetchProfile,
  fetchWorkspace,
  isCloud,
  isClinical,
  verifyClinicalWorkspace,
  submitCloud,
  supabase,
} from "./client";
import { demoProfiles, summarize, visibleDemo } from "./demo";
import { requiresSecondFactor } from "./security";
import {
  careApi,
  serviceStatus,
  uploadRequestId,
  type ServiceStatus,
} from "./services";
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
  const sessionForm = useRef<unknown>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [authRevision, setAuthRevision] = useState(0);
  const authGeneration = useRef(0);
  const [services, setServices] = useState<ServiceStatus>({
    database: false,
    files: false,
    video: false,
    ai: false,
    reminders: false,
  });
  const [checkingServices, setCheckingServices] = useState(true);
  const [servicesError, setServicesError] = useState("");
  const servicesGeneration = useRef(0);
  const refreshServices = useCallback(async () => {
    const request = ++servicesGeneration.current;
    setCheckingServices(true);
    try {
      const next = await serviceStatus();
      if (request === servicesGeneration.current) {
        setServices(next);
        setServicesError("");
      }
      return next;
    } catch (cause) {
      if (request === servicesGeneration.current)
        setServicesError("Could not check the file connection. Please retry.");
      throw cause;
    } finally {
      if (request === servicesGeneration.current) setCheckingServices(false);
    }
  }, []);
  useEffect(() => {
    let stopped = false,
      attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      try {
        await refreshServices();
      } catch {
        if (!stopped && attempts++ < 3)
          timer = setTimeout(() => void check(), 3000 * attempts);
      }
    };
    const reconnect = () => {
      clearTimeout(timer);
      attempts = 0;
      void check();
    };
    void check();
    window.addEventListener("online", reconnect);
    return () => {
      stopped = true;
      ++servicesGeneration.current;
      clearTimeout(timer);
      window.removeEventListener("online", reconnect);
    };
  }, [refreshServices]);
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
      setDrafts(isClinical ? [] : await listDrafts(actor.id, scope));
      setError("");
    },
    [scope],
  );
  useEffect(() => {
    let alive = true;
    let sessionUserId: string | undefined;
    const enter = async (id?: string) => {
      sessionUserId = id;
      const authVersion = ++authGeneration.current;
      ++generation.current;
      setLoading(true);
      setData(emptyData());
      setSummary(summarize(emptyData()));
      setDrafts([]);
      sessionForm.current = null;
      setMfaRequired(false);
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
        if (!alive || authVersion !== authGeneration.current) return;
        if (isCloud) {
          const assurance =
            await supabase!.auth.mfa.getAuthenticatorAssuranceLevel();
          if (assurance.error) throw assurance.error;
          if (!alive || authVersion !== authGeneration.current) return;
          if (
            requiresSecondFactor(
              actor.role,
              assurance.data.currentLevel,
              assurance.data.nextLevel,
            )
          ) {
            setMfaRequired(true);
            setProfile(actor);
            return;
          }
        }
        if (isCloud) await verifyClinicalWorkspace();
        if (!alive || authVersion !== authGeneration.current) return;
        setProfile(actor);
        await refresh(actor);
      } catch (e) {
        if (alive && authVersion === authGeneration.current) {
          sessionUserId = undefined;
          setProfile(null);
          setError(message(e));
        }
      } finally {
        if (alive && authVersion === authGeneration.current) setLoading(false);
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
      if (
        [
          "SIGNED_IN",
          "SIGNED_OUT",
          "MFA_CHALLENGE_VERIFIED",
          "TOKEN_REFRESHED",
          "USER_UPDATED",
        ].includes(event)
      )
        setTimeout(() => {
          if (!alive) return;
          // Supabase repeats SIGNED_IN on tab focus for an existing session.
          // Keep the mounted patient form when the account has not changed.
          if (event === "SIGNED_IN" && session?.user.id === sessionUserId)
            return;
          void enter(session?.user.id);
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
  }, [refresh, authRevision]);

  const execute = useCallback(
    async (
      action: Command["action"],
      payload: Record<string, unknown>,
      retryId?: string,
    ) => {
      if (!profile) throw new Error("Sign in first.");
      if (mfaRequired) throw new Error("Verify your authenticator code first.");
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
        if (isClinical && !navigator.onLine)
          throw new Error(
            "Reconnect before saving clinical records. This form is kept only for the current session.",
          );
        if (action === "register" && !isClinical) {
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
            request_id: await uploadRequestId(profile.id, "oral", payload),
          });
        else if (isCloud && action === "document")
          await careApi("upload", {
            kind: "report",
            data_url: payload.preview,
            ...payload,
            request_id: await uploadRequestId(profile.id, "report", payload),
          });
        else if (isCloud && action === "analyze")
          await careApi("analyze", payload);
        else if (isCloud) await submitCloud(command);
        else await mutateDemo(profile, command);
        if (action === "register") await removeDraft(command.id);
        await refresh(profile);
        return "saved" as const;
      } catch (e) {
        if (action === "register" && !isClinical) {
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
    [profile, refresh, scope, mfaRequired],
  );

  const sync = useCallback(async () => {
    if (isClinical) return;
    if (!profile || mfaRequired || syncing.current || !navigator.onLine) return;
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
  }, [profile, scope, execute, mfaRequired]);
  useEffect(() => {
    if (online && profile && !mfaRequired)
      void sync().catch((e) => setError(message(e)));
  }, [online, profile?.id, mfaRequired]); // Retry only on reconnect/session change.
  return {
    services,
    refreshServices,
    checkingServices,
    servicesError,
    profile,
    mfaRequired,
    completeMfa: () => setAuthRevision((value) => value + 1),
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
      if (profile && !mfaRequired) await refresh(profile);
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
      setMfaRequired(false);
      setData(emptyData());
      sessionForm.current = null;
    },
    saveForm: async (value: unknown) => {
      if (isClinical) {
        sessionForm.current = value;
        return;
      }
      if (profile) await setLocal(`form:${scope}:${profile.id}`, value);
    },
    loadForm: async () =>
      isClinical
        ? (sessionForm.current as Record<string, unknown> | undefined)
        : profile
          ? await getLocal<Record<string, unknown>>(
              `form:${scope}:${profile.id}`,
            )
          : undefined,
  };
}
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "Something went wrong. Please try again.";
