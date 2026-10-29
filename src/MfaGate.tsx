import { localize } from "./lib/localize";
import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "./lib/client";
import type { Language } from "./lib/types";

export default function MfaGate({
  lang,
  onVerified,
  onSignOut,
}: {
  lang: Language;
  onVerified: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [factors, setFactors] = useState<{ id: string; name: string }[]>([]);
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<{
    qr: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const l = (en: string, te: string) => localize(lang, en, te);

  useEffect(() => {
    let active = true;
    void supabase!.auth.mfa
      .listFactors()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        else {
          const available = data.totp
            .filter((f) => f.status === "verified")
            .map((f) => ({
              id: f.id,
              name: f.friendly_name || "Authenticator",
            }));
          setFactors(available);
          setFactorId(available[0]?.id || "");
        }
        setLoading(false);
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not check your authenticator. Retry.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function enroll() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // Only discard abandoned, unverified factors from this application's flow.
      // Existing verified factors are never removed by enrollment.
      const listed = await supabase!.auth.mfa.listFactors();
      if (listed.error) throw listed.error;
      const verified = listed.data.totp.filter((f) => f.status === "verified");
      if (verified.length) {
        setFactors(
          verified.map((f) => ({
            id: f.id,
            name: f.friendly_name || "Authenticator",
          })),
        );
        setFactorId(verified[0].id);
        return;
      }
      for (const factor of listed.data.all.filter(
        (f) =>
          f.status === "unverified" && f.friendly_name === "Aarogya Drishti",
      )) {
        const removed = await supabase!.auth.mfa.unenroll({
          factorId: factor.id,
        });
        if (removed.error) throw removed.error;
      }
      const { data, error } = await supabase!.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Aarogya Drishti",
      });
      if (error) throw error;
      setFactorId(data.id);
      setEnrollment({ qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Authenticator setup failed. Retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (busy || !/^\d{6}$/.test(code) || !factorId) return;
    setBusy(true);
    setError("");
    try {
      const result = await supabase!.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });
      if (result.error) throw result.error;
      const assurance =
        await supabase!.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw assurance.error;
      if (assurance.data.currentLevel !== "aal2")
        throw new Error("Verification did not complete. Try a fresh code.");
      setCode("");
      setEnrollment(null);
      onVerified();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Verification failed. Try a fresh code.",
      );
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mfa-page">
      <section className="mfa-card" aria-labelledby="mfa-title">
        <img src="/icon.svg" alt="" width="42" height="42" />
        <p className="eyebrow">{localize(lang, "AAROGYA DRISHTI")}</p>
        <ShieldCheck aria-hidden="true" size={32} />
        <h1 id="mfa-title">
          {l("Verify your identity", "మీ గుర్తింపును నిర్ధారించండి")}
        </h1>
        <p>
          {l(
            "Use your authenticator app to finish signing in. Clinical and administrator accounts require this extra step.",
            "సైన్ ఇన్ పూర్తి చేయడానికి మీ ఆథెంటికేటర్ యాప్‌ను ఉపయోగించండి. వైద్య మరియు నిర్వాహక ఖాతాలకు ఈ అదనపు దశ అవసరం.",
          )}
        </p>
        {loading ? (
          <p role="status">
            {l(
              "Checking your authenticator…",
              "ఆథెంటికేటర్‌ను తనిఖీ చేస్తున్నాము…",
            )}
          </p>
        ) : (
          <>
            {!factorId && !error && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void enroll()}
              >
                {l("Set up authenticator", "ఆథెంటికేటర్‌ను సెటప్ చేయండి")}
              </button>
            )}
            {enrollment && (
              <div className="mfa-enrollment">
                <p>
                  {l(
                    "Scan this QR code with your authenticator app, then enter its six-digit code below.",
                    "మీ ఆథెంటికేటర్ యాప్‌తో ఈ QR కోడ్‌ను స్కాన్ చేసి, ఆరు అంకెల కోడ్‌ను నమోదు చేయండి.",
                  )}
                </p>
                <img
                  className="mfa-qr"
                  src={
                    enrollment.qr.startsWith("data:")
                      ? enrollment.qr
                      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr)}`
                  }
                  alt={l(
                    "Authenticator setup QR code",
                    "ఆథెంటికేటర్ సెటప్ QR కోడ్",
                  )}
                />
                <details>
                  <summary>
                    {l(
                      "Enter setup key manually",
                      "సెటప్ కీని చేతితో నమోదు చేయండి",
                    )}
                  </summary>
                  <code className="mfa-secret">{enrollment.secret}</code>
                </details>
                <p className="small">
                  {l(
                    "Keep this setup key private. Do not include it in screenshots or recordings.",
                    "ఈ సెటప్ కీని గోప్యంగా ఉంచండి. స్క్రీన్‌షాట్‌లు లేదా రికార్డింగ్‌లలో చూపవద్దు.",
                  )}
                </p>
              </div>
            )}
            {factorId && (
              <form onSubmit={verify}>
                {factors.length > 1 && (
                  <label>
                    {l("Authenticator", "ఆథెంటికేటర్")}
                    <select
                      value={factorId}
                      onChange={(e) => setFactorId(e.target.value)}
                    >
                      {factors.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label htmlFor="mfa-code">
                  {l(
                    "Six-digit authenticator code",
                    "ఆరు అంకెల ఆథెంటికేటర్ కోడ్",
                  )}
                </label>
                <input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  disabled={busy}
                />
                <button
                  className="button primary"
                  disabled={busy || code.length !== 6}
                >
                  {l("Verify and continue", "నిర్ధారించి కొనసాగించండి")}
                </button>
              </form>
            )}
          </>
        )}
        {error && (
          <div className="error-box" role="alert">
            {localize(lang, error)}
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setError("");
                if (!factorId) void enroll();
              }}
            >
              {l("Retry", "మళ్లీ ప్రయత్నించండి")}
            </button>
          </div>
        )}
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void onSignOut()}
        >
          {l("Sign out", "సైన్ అవుట్")}
        </button>
        <p className="small muted">
          {l(
            "Lost your authenticator? Contact your project administrator for account recovery.",
            "ఆథెంటికేటర్ అందుబాటులో లేదా? ఖాతా పునరుద్ధరణ కోసం మీ ప్రాజెక్ట్ నిర్వాహకుడిని సంప్రదించండి.",
          )}
        </p>
      </section>
    </main>
  );
}
