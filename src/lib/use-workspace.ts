import { useCallback, useEffect, useRef, useState } from "react";
import {
  configurationError,
  fetchProfile,
  fetchWorkspace,
  isCloud,
  isClinical,
  offlineScope,
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
  captureSnapshot,
  loadOffline,
  offlineDrafts,
  projectDrafts,
  removeOfflineDraft,
  saveOffline,
  saveOfflineDraft,
  validOfflineSession,
  type OfflineSession,
} from "./offline";
import { hasConsent } from "./care-workflows";
import {
  emptyData,
  type Command,
  type Draft,
  type Profile,
  type Role,
  type Summary,
} from "./types";

export function useWorkspace() {
  const sessionExpiresAt = useRef(0);
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
  const scope = isCloud ? offlineScope : "demo";
  const readDrafts = useCallback(
    (actor: string) =>
      isCloud ? offlineDrafts(scope, actor) : listDrafts(actor, scope),
    [scope],
  );
  const writeDraft = useCallback(
    (draft: Draft) =>
      isCloud ? saveOfflineDraft(scope, draft) : queueDraft(draft, scope),
    [scope],
  );
  const deleteDraft = useCallback(
    (actor: string, id: string) =>
      isCloud ? removeOfflineDraft(scope, actor, id) : removeDraft(id),
    [scope],
  );
  const refresh = useCallback(
    async (actor: Profile) => {
      const version = ++generation.current;
      const cached =
        isCloud && !navigator.onLine
          ? await loadOffline<OfflineSession>(scope, actor.id, "session")
          : undefined;
      if (isCloud && !navigator.onLine && !cached)
        throw new Error(
          "Open this workspace online before using offline capture.",
        );
      const next = isCloud
        ? cached
          ? { data: cached.data, summary: null }
          : await fetchWorkspace(actor)
        : { data: await loadDemo(), summary: null };
      if (version !== generation.current) return;
      if (isCloud && navigator.onLine && actor.role === "health_worker")
        await saveOffline(scope, actor.id, "session", {
          profile: actor,
          verified_at: Date.now(),
          data: captureSnapshot(next.data, actor),
        } satisfies OfflineSession);
      const pending = await readDrafts(actor.id);
      if (version !== generation.current) return;
      // Demo registrations keep their existing queue-only behavior; cloud drafts
      // must be visible so a worker can photograph a newly registered patient.
      const visible = isCloud
        ? projectDrafts(next.data, actor, pending, isClinical)
        : projectDrafts(
            visibleDemo(next.data, actor.role),
            actor,
            pending.filter((d) => d.action === "image"),
            false,
          );
      setData(visible);
      setSummary(
        next.summary ??
          summarize(actor.role === "district_admin" ? next.data : visible),
      );
      setDrafts(pending);
      setError("");
    },
    [scope, readDrafts],
  );
  useEffect(() => {
    let alive = true;
    let sessionUserId: string | undefined;
    const enter = async (id?: string, expiresAt = 0) => {
      sessionExpiresAt.current = expiresAt;
      sessionUserId = id;
      const authVersion = ++authGeneration.current;
      ++generation.current;
      setLoading(true);
      setData(emptyData());
      setSummary(summarize(emptyData()));
      setDrafts([]);
      setMfaRequired(false);
      try {
        if (configurationError) throw new Error(configurationError);
        if (isCloud && !id) {
          setProfile(null);
          setData(emptyData());
          return;
        }
        if (isCloud && !navigator.onLine) {
          const cached = await loadOffline<OfflineSession>(
            scope,
            id!,
            "session",
          );
          if (!validOfflineSession(cached, id!, expiresAt))
            throw new Error(
              "Reconnect and sign in before using offline capture on this device.",
            );
          if (!alive || authVersion !== authGeneration.current) return;
          setProfile(cached!.profile);
          await refresh(cached!.profile);
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
        } else void enter(data.session?.user.id, data.session?.expires_at);
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
          void enter(session?.user.id, session?.expires_at);
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
  }, [refresh, authRevision, scope]);

  const execute = useCallback(
    async (
      action: Command["action"],
      payload: Record<string, unknown>,
      retryId?: string,
    ) => {
      if (!profile) throw new Error("Sign in first.");
      if (mfaRequired) throw new Error("Verify your authenticator code first.");
      if (lock.current) throw new Error("Please wait for the current action.");
      if (syncing.current && !retryId)
        throw new Error("Please wait for pending uploads to finish.");
      lock.current = true;
      setBusy(true);
      const queueable =
        ["register", "image"].includes(action) &&
        profile.role === "health_worker";
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
      let queued: Draft | undefined;
      try {
        if (isCloud && !navigator.onLine) {
          const cached = await loadOffline<OfflineSession>(
            scope,
            profile.id,
            "session",
          );
          if (
            !validOfflineSession(cached, profile.id, sessionExpiresAt.current)
          )
            throw new Error(
              "Reconnect and sign in before saving offline on this device.",
            );
        }
        if (isCloud && action === "image" && !retryId)
          command.id = await uploadRequestId(profile.id, "oral", payload);
        if (action === "delete_image") {
          const id = String(payload.image_id ?? payload.id);
          const pending = (await readDrafts(profile.id)).find(
            (d) => d.id === id && d.action === "image",
          );
          if (pending) {
            await deleteDraft(profile.id, id);
            setDrafts(await readDrafts(profile.id));
            setData((current) => ({
              ...current,
              images: current.images.filter((image) => image.id !== id),
            }));
            return "saved" as const;
          }
        }
        if (
          action === "analyze" &&
          data.images.some(
            (image) => image.id === payload.image_id && image.pending_sync,
          )
        )
          throw new Error("Sync this photo before requesting analysis.");
        if (queueable) {
          if (
            action === "image" &&
            data.screenings
              .filter((screen) => screen.patient_id === payload.patient_id)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
              ?.status === "closed"
          )
            throw new Error("Reopen this case before capturing a photo.");
          if (
            action === "image" &&
            (!hasConsent(data, String(payload.patient_id), "image_capture") ||
              !hasConsent(data, String(payload.patient_id), "screening"))
          )
            throw new Error(
              "Current screening and photo consent are required.",
            );
          if (action === "register" && payload.consent !== true)
            throw new Error("Record screening consent before saving.");
          const previous = (await readDrafts(profile.id)).find(
            (d) => d.id === command.id,
          );
          queued = {
            id: command.id,
            actor: profile.id,
            action: action as Draft["action"],
            payload,
            created_at: previous?.created_at ?? command.created_at,
            status: "pending",
          };
          await writeDraft(queued);
          if (!navigator.onLine) {
            const pending = await readDrafts(profile.id);
            setDrafts(pending);
            if (isCloud || action === "image") {
              setData(projectDrafts(data, profile, pending, isClinical));
              setSummary(
                summarize(projectDrafts(data, profile, pending, isClinical)),
              );
            }
            return "queued" as const;
          }
          if (
            action === "image" &&
            !retryId &&
            (await readDrafts(profile.id)).some(
              (d) =>
                (d.action ?? "register") === "register" &&
                d.payload.patient_id === payload.patient_id,
            )
          ) {
            const pending = await readDrafts(profile.id);
            setDrafts(pending);
            setData(projectDrafts(data, profile, pending, isClinical));
            return "queued" as const;
          }
          await writeDraft({ ...queued, status: "uploading" });
          setDrafts(await readDrafts(profile.id));
        } else if (!navigator.onLine)
          throw new Error(
            "Reconnect before changing clinical records. Screenings and photos can be saved to the offline queue.",
          );
        if (isCloud && action === "delete_image")
          await careApi("delete", {
            kind: "oral",
            id: payload.image_id ?? payload.id,
          });
        else if (isCloud && action === "image")
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
        if (queued) await deleteDraft(profile.id, command.id);
        await refresh(profile);
        return "saved" as const;
      } catch (e) {
        if (queued) {
          await writeDraft({ ...queued, status: "failed", error: message(e) });
          const pending = await readDrafts(profile.id);
          setDrafts(pending);
          if (isCloud)
            setData(projectDrafts(data, profile, pending, isClinical));
        }
        throw e;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [
      profile,
      refresh,
      scope,
      mfaRequired,
      data,
      readDrafts,
      writeDraft,
      deleteDraft,
    ],
  );

  const sync = useCallback(async () => {
    if (!profile || mfaRequired || syncing.current || !navigator.onLine) return;
    if (lock.current) return;
    syncing.current = true;
    let failure = "";
    try {
      const pending = await readDrafts(profile.id);
      if (!pending.length) return;
      // Revalidate the account, workspace and MFA with the server before replay.
      if (isCloud) {
        const actor = await fetchProfile(profile.id);
        if (
          actor.role !== profile.role ||
          actor.facility_id !== profile.facility_id
        )
          throw new Error(
            "Your staff access changed. Sign in again before syncing.",
          );
        await verifyClinicalWorkspace();
        const assurance =
          await supabase!.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance.error) throw assurance.error;
        if (
          requiresSecondFactor(
            actor.role,
            assurance.data.currentLevel,
            assurance.data.nextLevel,
          )
        )
          throw new Error("Verify your authenticator code before syncing.");
      }
      const blocked = new Set<string>();
      for (const draft of pending) {
        if (!navigator.onLine) break;
        const patientId = String(draft.payload.patient_id);
        if (blocked.has(patientId)) continue;
        try {
          await execute(draft.action ?? "register", draft.payload, draft.id);
        } catch (e) {
          blocked.add(patientId);
          failure = message(e);
          setError(failure);
        }
      }
    } finally {
      syncing.current = false;
    }
    if (failure) throw new Error(failure);
  }, [profile, scope, execute, mfaRequired, readDrafts]);
  useEffect(() => {
    if (online && profile && !mfaRequired)
      void sync().catch((e) => setError(message(e)));
  }, [online, profile?.id, mfaRequired]); // Retry only on reconnect/session change.
  useEffect(() => {
    // Also recover API outages while the browser still reports an online link.
    const timer = setInterval(() => {
      if (navigator.onLine) void sync().catch((e) => setError(message(e)));
    }, 30000);
    return () => clearInterval(timer);
  }, [sync]);
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
      if (profile && isCloud) {
        await saveOffline(scope, profile.id, "session", null);
        await saveOffline(scope, profile.id, "form", null);
      }
      setDrafts([]);
    },
    saveForm: async (value: unknown) => {
      if (isCloud && profile) {
        if (!navigator.onLine) {
          const cached = await loadOffline<OfflineSession>(
            scope,
            profile.id,
            "session",
          );
          if (
            !validOfflineSession(cached, profile.id, sessionExpiresAt.current)
          )
            throw new Error(
              "Reconnect and sign in before saving offline on this device.",
            );
        }
        return saveOffline(scope, profile.id, "form", value);
      }
      if (profile) await setLocal(`form:${scope}:${profile.id}`, value);
    },
    loadForm: async () =>
      isCloud && profile
        ? await loadOffline<Record<string, unknown>>(scope, profile.id, "form")
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
