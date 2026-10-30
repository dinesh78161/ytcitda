import LanguageSelector from "./LanguageSelector";
import { initialLanguage } from "./lib/languages";
import { localize } from "./lib/localize";
import { localeForLanguage, languageName } from "./lib/languages";
import { greetings } from "./lib/greetings";
import { useLoginGreeting } from "./lib/use-login-greeting";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Cloud,
  CloudOff,
  Database,
  Eye,
  FileText,
  HeartHandshake,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MapPin,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UploadCloud,
  UsersRound,
  Video,
  Volume2,
  Wifi,
  X,
} from "lucide-react";
import {
  configurationError,
  isCloud,
  isClinical,
  supabase,
} from "./lib/client";
import { demoProfiles } from "./lib/demo";
import { inspectImage } from "./lib/image-quality";
import { roleLabel, statusLabel, translator, type Label } from "./lib/i18n";
import { message, useWorkspace } from "./lib/use-workspace";
import type { Language, Page, Patient, Role } from "./lib/types";
import {
  AppointmentTools,
  ConsentPanel,
  IntegrationStatus,
  OutreachPanel,
  PatientCare,
  RemindersPanel,
} from "./CarePanels";
import { hasConsent } from "./lib/care-workflows";
import { latestScreening, stages } from "./lib/journey";
import MfaGate from "./MfaGate";
import Registration, { IntakeFacts } from "./ScreeningIntake";
import OralAnalysis from "./OralAnalysis";
import LiveCameraModal from "./LiveCameraModal";
import {
  GuidedJourney,
  CaseDecisions,
  PatientAppointments,
  JourneyMetrics,
} from "./PatientJourney";

type Workspace = ReturnType<typeof useWorkspace>;
const Context = createContext<{
  w: Workspace;
  lang: Language;
  t: ReturnType<typeof translator>;
  notify: (text: string, error?: boolean) => void;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<boolean>;
}>(null!);
export const useApp = () => useContext(Context);
const navItems: { id: Page; icon: typeof Activity }[] = [
  { id: "overview", icon: LayoutDashboard },
  { id: "patients", icon: UsersRound },
  { id: "screenings", icon: ClipboardCheck },
  { id: "appointments", icon: CalendarDays },
  { id: "followups", icon: HeartHandshake },
  { id: "reports", icon: Activity },
];
const dateLabel = (value: string, lang: Language, withTime = false) =>
  new Intl.DateTimeFormat(localeForLanguage(lang), {
    day: "numeric",
    month: "short",
    ...(withTime
      ? { hour: "numeric" as const, minute: "2-digit" as const }
      : {}),
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
const shortId = (id: string) => `AD-${id.slice(-6).toUpperCase()}`;
const clinician = (role?: Role) =>
  role === "medical_officer" || role === "specialist";

export default function App() {
  const w = useWorkspace(),
    [lang, setLang] = useState<Language>(() =>
      initialLanguage(localStorage.getItem("aarogya-language")),
    );
  const greeting = useLoginGreeting(
    lang,
    !!w.profile && !w.loading && !w.mfaRequired,
  );
  const [page, setPage] = useState<Page>("overview"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [registration, setRegistration] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const t = translator(lang, isClinical);
  const notify = (text: string, error = false) =>
    setToast({ text: localize(lang, text), error });
  const run = async (
    fn: () => Promise<unknown>,
    success: string = t("saved"),
  ) => {
    try {
      await fn();
      notify(success);
      return true;
    } catch (e) {
      notify(message(e), true);
      return false;
    }
  };
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("aarogya-language", lang);
  }, [lang]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    setSelected(null);
    setPage("overview");
    setSearch("");
  }, [w.profile?.id]);
  const navigate = (next: Page) => {
    setSelected(null);
    setPage(next);
    setMobileNav(false);
  };
  const allowedNav =
    w.profile?.role === "district_admin"
      ? navItems.filter((n) => ["overview", "reports"].includes(n.id))
      : w.profile?.role === "navigator"
        ? navItems.filter((n) => n.id !== "screenings")
        : navItems;
  const patient = w.data.patients.find((p) => p.id === selected);
  return (
    <Context.Provider value={{ w, lang, t, notify, run }}>
      {!w.profile ? (
        <Login lang={lang} setLang={setLang} greeting={greeting} />
      ) : w.mfaRequired ? (
        <MfaGate lang={lang} onVerified={w.completeMfa} onSignOut={w.signOut} />
      ) : (
        <div className="app-shell">
          {mobileNav && (
            <button
              className="nav-scrim"
              aria-label={t("close")}
              onClick={() => setMobileNav(false)}
            />
          )}
          <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
            <a
              className="brand"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate("overview");
              }}
            >
              <img
                src="/aarogya-logo.png"
                alt="Aarogya Drishti"
                width="144"
                height="144"
              />
            </a>
            <div className="sidebar-rule" />
            <div className="nav-label">{t("workspace")}</div>
            <nav aria-label={t("workspace")}>
              {allowedNav.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  className={`nav-item ${page === id && !selected ? "active" : ""}`}
                  onClick={() => navigate(id)}
                >
                  <Icon size={19} />
                  <span>{t(id)}</span>
                  {id === "screenings" &&
                    w.data.screenings.filter(
                      (s) => s.status === "awaiting_clinician",
                    ).length > 0 && (
                      <span className="nav-count">
                        {
                          w.data.screenings.filter(
                            (s) => s.status === "awaiting_clinician",
                          ).length
                        }
                      </span>
                    )}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <button
                className={`nav-item ${page === "settings" ? "active" : ""}`}
                onClick={() => navigate("settings")}
              >
                <Settings2 size={19} />
                {t("settings")}
              </button>
              <div className="sidebar-foot">
                <ShieldCheck size={15} />
                {localize(
                  lang,
                  "Secure Health Network",
                  "సురక్షిత ఆరోగ్య నెట్‌వర్క్",
                )}
              </div>
            </div>
          </aside>
          <div className="workspace">
            <header className="topbar">
              <div className="topbar-left">
                <button
                  className="icon-button mobile-menu"
                  aria-label={t("menu")}
                  onClick={() => setMobileNav(true)}
                >
                  <Menu size={22} />
                </button>
                <span className="breadcrumb">
                  {t("workspace")}
                  <ChevronRight size={14} />
                  <strong>{selected ? t("patientRecord") : t(page)}</strong>
                </span>
                {isClinical && (
                  <small className="workspace-mode">
                    {localize(lang, "Clinical workspace", "వైద్య కార్యస్థలం")}
                  </small>
                )}
              </div>
              <div className="topbar-right">
                <span
                  className={`connection-pill ${!w.online ? "offline" : ""}`}
                >
                  {w.online ? (
                    <span className="status-dot" />
                  ) : (
                    <CloudOff size={13} />
                  )}
                  <span>{w.online ? t("online") : t("offline")}</span>
                </span>
                <LanguageSelector language={lang} onChange={setLang} />
                <button
                  className="icon-button"
                  aria-label={greetings[lang].playLabel}
                  title={`${greetings[lang].playLabel}: ${greetings[lang].text}`}
                  onClick={greeting.play}
                  disabled={w.loading}
                >
                  <Volume2 size={18} />
                </button>
                <div className="header-divider" />
                <button
                  className="user-button"
                  onClick={() => navigate("settings")}
                  aria-label={t("settings")}
                >
                  <span className="avatar">
                    {w.profile.role === "health_worker"
                      ? "HW"
                      : w.profile.role === "medical_officer"
                        ? "MO"
                        : w.profile.role === "district_admin"
                          ? "DA"
                          : w.profile.role === "navigator"
                            ? "CN"
                            : "SP"}
                  </span>
                  <span className="user-copy">
                    <strong>{roleLabel(w.profile.role, lang)}</strong>
                    <small>
                      {isCloud
                        ? localize(
                            lang,
                            "Connected Care Network",
                            "కనెక్ట్ చేయబడిన నెట్‌వర్క్",
                          )
                        : localize(
                            lang,
                            "Training workspace",
                            "క్లినికల్ కేర్ నోడ్",
                          )}
                    </small>
                  </span>
                </button>
              </div>
            </header>
            <main id="main-content">
              {!isCloud && (
                <div className="demo-notice">
                  <span>
                    <span className="notice-dot" />
                    {localize(
                      lang,
                      "Staff training · Test records stored in this browser",
                      "క్లినికల్ డెసిషన్ సపోర్ట్ మోడ్ · స్థానిక ఆఫ్‌లైన్ కాష్ క్రియాశీలకంగా ఉంది",
                    )}
                  </span>
                  <select
                    aria-label={localize(
                      lang,
                      "Training role selection",
                      "వైద్యుని పాత్ర ఎంపిక",
                    )}
                    value={w.profile.role}
                    disabled={w.busy}
                    onChange={(e) =>
                      void run(
                        () => w.changeRole(e.target.value as Role),
                        roleLabel(e.target.value as Role, lang),
                      )
                    }
                  >
                    {demoProfiles.map((p) => (
                      <option key={p.role} value={p.role}>
                        {roleLabel(p.role, lang)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {w.error && (
                <div className="error-box" role="alert">
                  {localize(lang, w.error)}
                  <button
                    className="text-button"
                    onClick={() => void run(w.refresh)}
                  >
                    {t("retry")}
                  </button>
                </div>
              )}
              {w.drafts.length > 0 && (
                <button
                  className="queue-banner"
                  onClick={() => navigate("settings")}
                >
                  <CloudOff size={18} />
                  {w.drafts.length} · {t("drafts")}
                  <ArrowRight size={16} />
                </button>
              )}
              {w.loading ? (
                <div className="loading">
                  <LoaderCircle className="spin" />
                  {t("loading")}
                </div>
              ) : patient ? (
                <PatientDetail
                  patient={patient}
                  back={() => setSelected(null)}
                  onReports={() => navigate("reports")}
                />
              ) : page === "overview" ? (
                <Overview
                  openPatient={setSelected}
                  navigate={navigate}
                  register={() => setRegistration(true)}
                />
              ) : page === "patients" || page === "screenings" ? (
                <>
                  <PageHeading
                    title={t(page)}
                    subtitle={
                      page === "patients" ? t("intro") : t("reviewHint")
                    }
                    action={
                      w.profile.role === "health_worker" ? (
                        <button
                          className="button primary"
                          onClick={() => setRegistration(true)}
                        >
                          <Plus size={18} />
                          {t("newPatient")}
                        </button>
                      ) : null
                    }
                  />
                  <PatientTable
                    search={search}
                    setSearch={setSearch}
                    screeningOnly={page === "screenings"}
                    onOpen={setSelected}
                  />
                </>
              ) : page === "appointments" ? (
                <Appointments openPatient={setSelected} />
              ) : page === "followups" ? (
                <FollowUps openPatient={setSelected} />
              ) : page === "reports" ? (
                <Reports />
              ) : (
                <WorkspaceSettings />
              )}
              <footer className="page-footer">
                <span>
                  © 2026 Aarogya Drishti <span>·</span> AAROHAN
                </span>
                <span>
                  <ShieldCheck size={13} />
                  {localize(
                    lang,
                    "Clinical Decision Support System · ITDA Health Network",
                    "క్లినికల్ డెసిషన్ సపోర్ట్ సిస్టమ్ · ITDA హెల్త్ నెట్‌వర్క్",
                  )}
                </span>
              </footer>
            </main>
          </div>
        </div>
      )}
      {registration && <Registration onClose={() => setRegistration(false)} />}
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleHelp size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.text}</span>
          <button
            className="icon-button"
            aria-label={t("close")}
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}

function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  const { lang } = useApp();
  return (
    <span className={`badge badge-${status}`}>
      <span />
      {statusLabel(status, lang)}
    </span>
  );
}
function Empty({ text }: { text?: string }) {
  const { t } = useApp();
  return (
    <div className="empty">
      <ClipboardCheck size={30} />
      <strong>{text ?? t("noRecords")}</strong>
    </div>
  );
}

function Overview({
  openPatient,
  navigate,
  register,
}: {
  openPatient: (id: string) => void;
  navigate: (page: Page) => void;
  register: () => void;
}) {
  const { w, t, lang } = useApp(),
    admin = w.profile?.role === "district_admin",
    worker = w.profile?.role === "health_worker";
  const copy = (en: string, te: string) => localize(lang, en, te);
  const waiting = w.data.screenings.filter(
    (s) => s.status === "awaiting_clinician" || s.status === "screened",
  ).length;
  const metrics = [
    {
      label: t("total"),
      value: w.summary.patients,
      icon: UsersRound,
      help: t("recorded"),
      color: "green",
      page: "patients" as Page,
    },
    {
      label: admin ? t("screening") : t("waiting"),
      value: admin ? w.summary.screenings : waiting,
      icon: ClipboardCheck,
      help: t("reviewHint"),
      color: "orange",
      page: "screenings" as Page,
    },
    {
      label: t("referrals"),
      value: w.summary.referrals,
      icon: Stethoscope,
      help: t("referralHint"),
      color: "blue",
      page: "patients" as Page,
    },
    {
      label: t("pending"),
      value: w.summary.pending_follow_ups,
      icon: HeartHandshake,
      help: t("followupHint"),
      color: "purple",
      page: "followups" as Page,
    },
  ];
  return (
    <>
      <PageHeading
        title={t("hello")}
        subtitle={t("intro")}
        action={
          w.profile?.role === "health_worker" ? (
            <button className="button primary" onClick={register}>
              <Plus size={18} />
              {t("newPatient")}
            </button>
          ) : (
            <button
              className="button secondary"
              onClick={() =>
                navigate(
                  admin
                    ? "reports"
                    : w.profile?.role === "navigator"
                      ? "followups"
                      : "screenings",
                )
              }
            >
              <ArrowUpRight size={18} />
              {t(
                admin
                  ? "reports"
                  : w.profile?.role === "navigator"
                    ? "followups"
                    : "screenings",
              )}
            </button>
          )
        }
      />
      <section className={`hero ${worker ? "worker-hero" : ""}`}>
        <div className="hero-copy">
          <div className="eyebrow">
            <span />
            {t("programme")}
          </div>
          <h2>
            {worker
              ? copy(
                  "Aarogya Drishti · ITDA Paderu",
                  "ఆరోగ్య దృష్టి · ఐటీడీఏ పాడేరు",
                )
              : t("journey")}
          </h2>
          <p>
            {worker
              ? copy(
                  "Screen, record, and connect your community to care. Start a new intake or follow up on an existing screening.",
                  "పరీక్షించండి, వివరాలు నమోదు చేయండి, సంరక్షణకు అనుసంధానించండి. కొత్త పరీక్ష ప్రారంభించండి లేదా మునుపటి పరీక్షను అనుసరించండి.",
                )
              : t("journeyText")}
          </p>
          <div className="journey-steps">
            {(
              [
                "registration",
                "screening",
                "review",
                "referral",
                "care",
              ] as Label[]
            ).map((key, i) => (
              <span key={key}>
                <b>{i + 1}</b>
                {t(key)}
                {i < 4 && <ChevronRight size={13} />}
              </span>
            ))}
          </div>
        </div>
        {worker ? (
          <div className="worker-hero-actions">
            <button className="button" onClick={register}>
              <Plus size={18} />
              {copy("Start screening", "పరీక్ష ప్రారంభించండి")}
            </button>
            <button
              className="button worker-review"
              onClick={() => navigate("screenings")}
            >
              <ClipboardCheck size={18} />
              {copy("View pending reviews", "పెండింగ్ సమీక్షలు చూడండి")}
              <span>{waiting}</span>
            </button>
          </div>
        ) : (
          <Landscape />
        )}
      </section>
      <section className="metric-grid" aria-label={t("overview")}>
        {metrics.map((m) => (
          <article className="metric-card" key={m.label}>
            {worker && (
              <button
                className="metric-link"
                aria-label={`${m.label}: ${m.value}`}
                onClick={() => navigate(m.page)}
              />
            )}
            <div className="metric-top">
              <span>{m.label}</span>
              <span className={`metric-icon ${m.color}`}>
                <m.icon size={19} />
              </span>
            </div>
            <strong>{String(m.value).padStart(2, "0")}</strong>
            <span className="metric-help">{m.help}</span>
          </article>
        ))}
      </section>
      {worker && (
        <section
          className="worker-shortcuts"
          aria-label={copy(
            "Health worker shortcuts",
            "ఆరోగ్య కార్యకర్త సత్వర మార్గాలు",
          )}
        >
          {[
            {
              icon: ClipboardCheck,
              title: copy("New screening", "కొత్త పరీక్ష"),
              detail: copy(
                "Patient details, habits, findings, and consent in one guided intake.",
                "రోగి వివరాలు, అలవాట్లు, పరిశీలనలు, సమ్మతి కోసం దశలవారీ నమోదు.",
              ),
              action: register,
            },
            {
              icon: CalendarDays,
              title: t("appointments"),
              detail: copy(
                "Check booked visits and help patients reach their next appointment.",
                "బుక్ చేసిన సందర్శనలు చూసి తదుపరి అపాయింట్‌మెంట్‌కు సహాయపడండి.",
              ),
              action: () => navigate("appointments"),
            },
            {
              icon: HeartHandshake,
              title: copy("Follow-ups", "ఫాలో అప్‌లు"),
              detail: copy(
                "Contact patients, track missed visits, and complete care tasks.",
                "రోగులను సంప్రదించండి, మిస్సైన సందర్శనలు, సంరక్షణ పనులను అనుసరించండి.",
              ),
              action: () => navigate("followups"),
            },
          ].map(({ icon: Icon, title, detail, action }) => (
            <button key={title} className="worker-shortcut" onClick={action}>
              <span className="worker-shortcut-icon">
                <Icon size={21} />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </span>
              <ArrowUpRight size={17} />
            </button>
          ))}
        </section>
      )}
      <div className="overview-grid">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>
                {admin
                  ? t("reports")
                  : worker
                    ? copy("Recent screenings", "ఇటీవలి పరీక్షలు")
                    : t("recent")}
              </h2>
              <p>{admin ? t("reportsText") : t("protected")}</p>
            </div>
            {!admin && (
              <button
                className="text-button"
                onClick={() => navigate("patients")}
              >
                {t("viewAll")}
                <ArrowRight size={15} />
              </button>
            )}
          </div>
          {admin ? (
            <AggregateChart />
          ) : (
            <PatientTable onOpen={openPatient} compact />
          )}
        </section>
        <div className="right-rail">
          <section className="panel attention-panel">
            <div className="panel-heading">
              <div>
                <h2>{t("attention")}</h2>
                <p>{t("attentionText")}</p>
              </div>
              <span className="attention-dot" />
            </div>
            {[
              {
                label: t("reviewQueue"),
                value: waiting,
                icon: ClipboardCheck,
                page: "screenings" as Page,
                color: "orange",
              },
              {
                label: t("missed"),
                value: w.summary.missed_appointments,
                icon: CalendarDays,
                page: "appointments" as Page,
                color: "pink",
              },
              {
                label: t("openTasks"),
                value: w.summary.pending_follow_ups,
                icon: HeartHandshake,
                page: "followups" as Page,
                color: "green",
              },
            ]
              .filter(
                (x) =>
                  !admin &&
                  !(w.profile?.role === "navigator" && x.page === "screenings"),
              )
              .map((item) => (
                <button
                  className="attention-item"
                  key={item.page}
                  onClick={() => navigate(item.page)}
                >
                  <span className={`metric-icon ${item.color}`}>
                    <item.icon size={18} />
                  </span>
                  <span>{item.label}</span>
                  <b>{item.value}</b>
                  <ChevronRight size={15} />
                </button>
              ))}
            {admin && (
              <button
                className="attention-item"
                onClick={() => navigate("reports")}
              >
                <Activity size={22} />
                <span>{t("reports")}</span>
                <ArrowRight size={18} />
              </button>
            )}
          </section>
          <section className="quick-card">
            <div className="quick-icon">
              <HeartHandshake size={23} />
            </div>
            <h3>
              {t(w.profile?.role === "health_worker" ? "quick" : "journey")}
            </h3>
            <p>
              {w.profile?.role === "health_worker"
                ? localize(
                    lang,
                    "Register a patient and start a clinical oral screening.",
                    "రోగిని నమోదు చేసి క్లినికల్ ఓరల్ స్క్రీనింగ్ ప్రారంభించండి.",
                  )
                : t("journeyText")}
            </p>
            <button
              className="text-button"
              onClick={
                w.profile?.role === "health_worker"
                  ? register
                  : () => navigate(admin ? "reports" : "followups")
              }
            >
              {t(
                w.profile?.role === "health_worker"
                  ? "newPatient"
                  : admin
                    ? "reports"
                    : "followups",
              )}
              <ArrowRight size={16} />
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
function Landscape() {
  return (
    <svg className="landscape" viewBox="0 0 360 210" aria-hidden="true">
      <circle cx="272" cy="49" r="29" fill="#eac486" />
      <circle
        cx="272"
        cy="49"
        r="39"
        fill="none"
        stroke="#eac486"
        opacity=".15"
      />
      <path d="M0 153 100 43l101 110 60-77 99 91v43H0Z" fill="#3f7461" />
      <path d="m61 86 39-43 43 47-41-13Z" fill="#88a892" />
      <path d="m0 182 119-75 131 75 110-50v78H0Z" fill="#669378" />
      <path d="M0 197q91-41 172-13t188-8v34H0Z" fill="#91af8b" />
      <path
        d="M169 210q-44-36 2-48"
        fill="none"
        stroke="#cfd1aa"
        strokeWidth="12"
      />
      <g transform="translate(232 125)">
        <path d="M-22 12 15-14 52 12Z" fill="#d6a771" />
        <path d="M-14 12h58v35h-58z" fill="#ead9b2" />
        <path d="M9 24h14v23H9Z" fill="#537d64" />
        <path d="M-8 21h10v10H-8zM29 21h10v10H29Z" fill="#719378" />
      </g>
      <g fill="#224f42">
        <path d="M66 172h5v-41h-5z" />
        <circle cx="68" cy="121" r="20" />
        <circle cx="55" cy="131" r="16" />
        <circle cx="80" cy="132" r="17" />
        <path d="M320 181h4v-31h-4z" />
        <circle cx="322" cy="142" r="17" />
      </g>
      <path
        d="m33 41 5-3 5 3m-1-13 5-3 5 3"
        stroke="#92b49a"
        fill="none"
        strokeWidth="2"
      />
    </svg>
  );
}

function PatientTable({
  onOpen,
  compact = false,
  search = "",
  setSearch,
  screeningOnly = false,
}: {
  onOpen: (id: string) => void;
  compact?: boolean;
  search?: string;
  setSearch?: (s: string) => void;
  screeningOnly?: boolean;
}) {
  const { w, t, lang } = useApp(),
    [filter, setFilter] = useState("all"),
    [limit, setLimit] = useState(10);
  const workerRecent = compact && w.profile?.role === "health_worker";
  const rows = [...w.data.patients]
    .sort((a, b) =>
      (workerRecent
        ? (latestScreening(w.data, b.id)?.created_at ?? b.created_at)
        : b.created_at
      ).localeCompare(
        workerRecent
          ? (latestScreening(w.data, a.id)?.created_at ?? a.created_at)
          : a.created_at,
      ),
    )
    .filter((p) => {
      const s = latestScreening(w.data, p.id);
      const matches = `${p.display_name} ${p.village} ${shortId(p.id)}`
        .toLowerCase()
        .includes(search.toLowerCase());
      return (
        matches &&
        (!screeningOnly ||
          s?.status === "awaiting_clinician" ||
          s?.status === "screened") &&
        (filter === "all" || s?.status === filter)
      );
    });
  return (
    <div className={compact ? "" : "panel registry-panel"}>
      {!compact && (
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label={t("search")}
              value={search}
              onChange={(e) => setSearch?.(e.target.value)}
              placeholder={t("search")}
            />
          </label>
          <select
            aria-label={t("stage")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{t("all")}</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, lang)}
              </option>
            ))}
          </select>
          <span className="record-count">
            {rows.length} {t("patients").toLowerCase()}
          </span>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("patient")}</th>
              <th>{t("village")}</th>
              <th>{t("stage")}</th>
              {(!compact || workerRecent) && (
                <th>
                  {workerRecent
                    ? localize(lang, "Screened on", "పరీక్ష తేదీ")
                    : t("registered")}
                </th>
              )}
              <th>
                <span className="sr-only">{t("open")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, compact ? 5 : limit).map((p, i) => {
              const s = latestScreening(w.data, p.id);
              return (
                <tr key={p.id}>
                  <td>
                    <button
                      className="patient-link"
                      onClick={() => onOpen(p.id)}
                    >
                      <span className={`patient-avatar avatar-${i % 4}`}>
                        {p.display_name
                          .split(" ")
                          .map((x) => x[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span>
                        <strong>{p.display_name}</strong>
                        <small>
                          {shortId(p.id)} <span>·</span> {p.age_years}{" "}
                          {t("years")}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className="village-cell">
                      <MapPin size={13} />
                      {p.village}
                    </span>
                  </td>
                  <td>
                    {s ? (
                      <Badge status={s.status} />
                    ) : (
                      <span className="muted">{t("protected")}</span>
                    )}
                  </td>
                  {(!compact || workerRecent) && (
                    <td className="muted">
                      {workerRecent
                        ? s
                          ? dateLabel(s.created_at, lang)
                          : "—"
                        : dateLabel(p.created_at, lang)}
                    </td>
                  )}
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`${t("open")}: ${p.display_name}`}
                      onClick={() => onOpen(p.id)}
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <Empty text={search ? t("noResults") : t("noRecords")} />
      )}{" "}
      {!compact && rows.length > limit && (
        <button
          className="button load-more"
          onClick={() => setLimit((n) => n + 10)}
        >
          {t("viewAll")} ({rows.length - limit})
        </button>
      )}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { lang } = useApp();

  const ref = useRef<HTMLDialogElement>(null),
    { t } = useApp();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow dark">
            {localize(lang, "AAROGYA DRISHTI")}
          </span>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={t("close")}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function PatientDetail({
  patient,
  back,
  onReports,
}: {
  patient: Patient;
  back: () => void;
  onReports: () => void;
}) {
  const { w, t, lang, run, notify } = useApp(),
    [tab, setTab] = useState<
      "clinical" | "photos" | "timeline" | "care" | "appointments"
    >("clinical"),
    [findings, setFindings] = useState(""),
    [decision, setDecision] = useState("refer"),
    [priority, setPriority] = useState("routine"),
    [diagnosis, setDiagnosis] = useState(""),
    [booking, setBooking] = useState(false),
    [imageBusy, setImageBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    stage: "inspecting" | "uploading" | "complete";
    percent: number;
    previewUrl?: string;
  } | null>(null);
  const [liveCameraOpen, setLiveCameraOpen] = useState(false);
  const [oralView, setOralView] = useState("cheek");
  const [followupAt, setFollowupAt] = useState("");
  const screening = latestScreening(w.data, patient.id),
    reviews = w.data.clinical_reviews.filter(
      (r) => r.patient_id === patient.id,
    ),
    referrals = w.data.referrals.filter((r) => r.patient_id === patient.id),
    images = w.data.images.filter((i) => i.patient_id === patient.id),
    investigations = w.data.investigations.filter(
      (i) => i.patient_id === patient.id,
    ),
    isClinician = clinician(w.profile?.role),
    isNavigator = w.profile?.role === "navigator";
  const photoConsent = hasConsent(w.data, patient.id, "image_capture");
  const upload = async (file?: File) => {
    if (!file) return;
    setImageBusy(true);
    const objectUrl = URL.createObjectURL(file);
    setUploadProgress({
      stage: "inspecting",
      percent: 25,
      previewUrl: objectUrl,
    });
    try {
      const result = await inspectImage(file);
      setUploadProgress({
        stage: "uploading",
        percent: 70,
        previewUrl: result.preview || objectUrl,
      });
      await w.execute("image", {
        patient_id: patient.id,
        oral_view: oralView,
        ...result,
      });
      setUploadProgress({
        stage: "complete",
        percent: 100,
        previewUrl: result.preview || objectUrl,
      });
      notify(
        t(result.quality_status === "acceptable" ? "acceptable" : "recapture"),
      );
    } catch (e) {
      notify(message(e), true);
    } finally {
      setTimeout(() => {
        setUploadProgress(null);
        setImageBusy(false);
      }, 700);
    }
  };
  return (
    <>
      <button className="back-link" onClick={back}>
        <ChevronLeft size={17} />
        {t("back")}
      </button>
      <PageHeading
        title={patient.display_name}
        subtitle={`${shortId(patient.id)} · ${patient.age_years} ${t("years")} · ${patient.village}`}
        action={screening ? <Badge status={screening.status} /> : null}
      />
      <GuidedJourney
        patient={patient}
        onNavigate={(target) => {
          if (target === "reports") onReports();
          else
            setTab(
              isNavigator && target !== "appointments" ? "timeline" : target,
            );
        }}
      />
      <div className="detail-layout">
        <section className="panel">
          <div className="tabs" role="tablist">
            {(
              [
                "clinical",
                "photos",
                "care",
                "appointments",
                "timeline",
              ] as const
            )
              .filter(
                (key) =>
                  (!isNavigator ||
                    key === "timeline" ||
                    key === "appointments") &&
                  (key !== "care" || isClinician),
              )
              .map((key) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={
                    (isNavigator && tab !== "appointments"
                      ? "timeline"
                      : tab) === key
                  }
                  onClick={() => setTab(key)}
                >
                  {key === "care"
                    ? localize(lang, "Care plan", "చికిత్స ప్రణాళిక")
                    : t(key)}
                </button>
              ))}
          </div>
          <div className="detail-body">
            {tab === "appointments" ? (
              <PatientAppointments
                patient={patient}
                onBook={() => setBooking(true)}
              />
            ) : tab === "care" && isClinician ? (
              <PatientCare key={patient.id} patient={patient} />
            ) : tab === "photos" && !isNavigator ? (
              <>
                <h2>{t("photos")}</h2>
                <p className="muted">
                  {localize(
                    lang,
                    "Standardized intraoral clinical views · JPEG, PNG or WebP up to 10 MB",
                    "ప్రామాణిక ఇంట్రాఓరల్ క్లినికల్ వీక్షణలు · JPEG, PNG లేదా WebP 10 MB వరకు",
                  )}
                </p>
                <div className="form-notice">
                  {localize(
                    lang,
                    "Quality guidance verifies exposure, sharpness and mucosal framing prior to clinician review.",
                    "వైద్యుల సమీక్షకు ముందు ఎక్స్‌పోజర్, స్పష్టత మరియు ఫోకస్‌ను నాణ్యతా మార్గదర్శకాలు ధృవీకరిస్తాయి.",
                  )}
                </div>
                <Field label={localize(lang, "Oral view", "నోటి భాగం")}>
                  <select
                    value={oralView}
                    onChange={(e) => setOralView(e.target.value)}
                  >
                    {[
                      ["cheek", "Cheek", "చెంప"],
                      ["tongue", "Tongue", "నాలుక"],
                      ["palate", "Palate", "అంగిలి"],
                      ["gums", "Gums", "చిగుళ్లు"],
                      ["floor_of_mouth", "Floor of mouth", "నోటి అడుగు భాగం"],
                    ].map(([value, en, te]) => (
                      <option key={value} value={value}>
                        {localize(lang, en, te)}
                      </option>
                    ))}
                  </select>
                </Field>
                {isCloud && !w.services.files ? (
                  <div className="empty">
                    <Camera size={30} />
                    <p>{t("cloudPhoto")}</p>
                  </div>
                ) : !photoConsent ? (
                  <div className="form-notice">{t("photoMissing")}</div>
                ) : (
                  <div className="capture-methods-wrapper">
                    <div className="capture-methods-grid">
                      <button
                        type="button"
                        className="capture-method-card live-camera-trigger"
                        onClick={() => setLiveCameraOpen(true)}
                        disabled={imageBusy || w.busy}
                      >
                        <div className="method-icon-box primary-cam">
                          <Camera size={26} />
                        </div>
                        <div className="method-details">
                          <div className="method-title-row">
                            <strong>
                              {localize(
                                lang,
                                "Take live photo with camera",
                                "కెమెరాతో లైవ్ ఫోటో తీయండి",
                              )}
                            </strong>
                            <span className="badge badge-completed">
                              {localize(lang, "Live Cam", "లైవ్ కెమెరా")}
                            </span>
                          </div>
                          <span>
                            {localize(
                              lang,
                              "Live viewfinder with focus, lighting and oral framing guidance",
                              "రియల్ టైమ్ Google MedGemma నాణ్యత గైడ్ మరియు ఓరల్ ఫ్రేమింగ్",
                            )}
                          </span>
                        </div>
                      </button>

                      <label
                        className={`upload-area capture-method-upload ${imageBusy ? "disabled" : ""}`}
                      >
                        <div className="method-icon-box">
                          <UploadCloud size={26} />
                        </div>
                        <div className="method-details">
                          <div className="method-title-row">
                            <strong>
                              {localize(
                                lang,
                                "Upload clinical photograph",
                                "క్లినికల్ ఫోటోను అప్‌లోడ్ చేయండి",
                              )}
                            </strong>
                            <span className="badge badge-subtle">
                              {localize(lang, "File upload", "ఫైల్ అప్‌లోడ్")}
                            </span>
                          </div>
                          <span>
                            {localize(
                              lang,
                              "JPEG, PNG or WebP · High-resolution clinical images",
                              "JPEG, PNG లేదా WebP · అధిక నాణ్యత క్లినికల్ చిత్రాలు",
                            )}
                          </span>
                        </div>
                        <input
                          aria-label={t("capture")}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          disabled={imageBusy || w.busy}
                          onChange={(e) => {
                            const file = e.currentTarget.files?.[0];
                            e.currentTarget.value = "";
                            void upload(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}
                {liveCameraOpen && (
                  <LiveCameraModal
                    oralView={oralView}
                    lang={lang}
                    onCapture={(file) => {
                      setLiveCameraOpen(false);
                      void upload(file);
                    }}
                    onClose={() => setLiveCameraOpen(false)}
                  />
                )}
                {uploadProgress && (
                  <div
                    className="upload-active-card"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="upload-active-thumb">
                      {uploadProgress.previewUrl ? (
                        <img
                          src={uploadProgress.previewUrl}
                          alt="Uploading preview"
                        />
                      ) : (
                        <Camera size={24} />
                      )}
                      <div className="thumb-scan-line" />
                    </div>
                    <div className="upload-active-details">
                      <div className="upload-active-header">
                        <div className="upload-active-title">
                          <UploadCloud
                            size={18}
                            className="upload-active-icon pulse"
                          />
                          <strong>
                            {uploadProgress.stage === "inspecting"
                              ? localize(
                                  lang,
                                  "Checking focus and lighting…",
                                  "ఫోకస్ & కాంతిని తనిఖీ చేస్తోంది (గూగుల్ మెడ్‌జెమ్మా)…",
                                )
                              : uploadProgress.stage === "uploading"
                                ? localize(
                                    lang,
                                    "Uploading oral photograph…",
                                    "నోటి చిత్రాన్ని అప్‌లోడ్ చేస్తోంది…",
                                  )
                                : localize(
                                    lang,
                                    "Capture synchronized successfully!",
                                    "చిత్రం విజయవంతంగా భద్రపరచబడింది!",
                                  )}
                          </strong>
                        </div>
                        <span className="upload-active-pct">
                          {uploadProgress.percent}%
                        </span>
                      </div>
                      <div className="upload-active-bar-track">
                        <div
                          className="upload-active-bar-fill"
                          style={{ width: `${uploadProgress.percent}%` }}
                        />
                      </div>
                      <div className="upload-active-steps">
                        <span
                          className={
                            uploadProgress.percent >= 25 ? "step-active" : ""
                          }
                        >
                          ✓ {localize(lang, "Capture", "చిత్రం")}
                        </span>
                        <span
                          className={
                            uploadProgress.percent >= 70 ? "step-active" : ""
                          }
                        >
                          {uploadProgress.percent >= 70 ? "✓" : "○"}{" "}
                          {localize(
                            lang,
                            "Image quality check",
                            "నాణ్యత తనిఖీ",
                          )}
                        </span>
                        <span
                          className={
                            uploadProgress.percent >= 100 ? "step-active" : ""
                          }
                        >
                          {uploadProgress.percent >= 100 ? "✓" : "○"}{" "}
                          {localize(lang, "Cloud Sync", "క్లౌడ్ నిల్వ")}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {images.length === 0 && !uploadProgress && (
                  <Empty
                    text={localize(
                      lang,
                      "No clinical oral photographs attached",
                      "క్లినికల్ ఓరల్ చిత్రాలు జత చేయలేదు",
                    )}
                  />
                )}
                <div className="photo-grid analysis-gallery">
                  {images.map((image) => (
                    <OralAnalysis
                      key={image.id}
                      image={image}
                      consent={photoConsent}
                    />
                  ))}
                </div>
                {isCloud && !w.services.ai && (
                  <p className="form-notice">
                    {localize(
                      lang,
                      "Image AI is not connected. Ask your workspace administrator to finish setup. Image quality checks remain available.",
                      "పరీక్ష మోడల్ ఇంకా అనుసంధానం కాలేదు.",
                    )}
                  </p>
                )}
              </>
            ) : tab === "timeline" || isNavigator ? (
              <div className="timeline">
                {[
                  {
                    date: patient.created_at,
                    label: t("registration"),
                    text: shortId(patient.id),
                  },
                  ...reviews.map((r) => ({
                    date: r.signed_at,
                    label: t("review"),
                    text: r.findings,
                  })),
                  ...w.data.appointments
                    .filter((a) => a.patient_id === patient.id)
                    .map((a) => ({
                      date: a.created_at,
                      label: t("appointments"),
                      text: statusLabel(a.status, lang),
                    })),
                  ...investigations.map((i) => ({
                    date: i.created_at,
                    label: t("pathology"),
                    text: i.clinician_diagnosis,
                  })),
                  ...w.data.treatment_events
                    .filter((e) => e.patient_id === patient.id)
                    .map((e) => ({
                      date: e.created_at,
                      label: localize(
                        lang,
                        "Treatment progress",
                        "చికిత్స పురోగతి",
                      ),
                      text: e.notes,
                    })),
                  ...w.data.consents
                    .filter((c) => c.patient_id === patient.id)
                    .map((c) => ({
                      date: c.recorded_at,
                      label: localize(lang, "Consent history", "సమ్మతి చరిత్ర"),
                      text: `${c.purpose.replaceAll("_", " ")} · ${c.granted ? localize(lang, "Granted", "అంగీకరించారు") : localize(lang, "Withdrawn", "ఉపసంహరించారు")}`,
                    })),
                ]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((event, i) => (
                    <article key={i}>
                      <span className="timeline-dot" />
                      <div>
                        <small>{dateLabel(event.date, lang, true)}</small>
                        <h3>{event.label}</h3>
                        <p>{event.text}</p>
                      </div>
                    </article>
                  ))}
              </div>
            ) : (
              <>
                <div className="section-label">
                  <ClipboardCheck size={18} />
                  {t("history")}
                </div>
                <dl className="clinical-facts">
                  <div>
                    <dt>{t("language")}</dt>
                    <dd>{languageName(patient.preferred_language)}</dd>
                  </div>
                </dl>
                {screening && (
                  <IntakeFacts
                    tobacco={screening.tobacco_history}
                    findings={screening.symptoms}
                  />
                )}
                <div className="observation">
                  <span>{t("notes")}</span>
                  <p>{screening?.examination_notes || "—"}</p>
                </div>
                {reviews.map((review) => (
                  <article className="review-card" key={review.id}>
                    <div>
                      <ShieldCheck size={17} />
                      <strong>{t("review")}</strong>
                      <small>{dateLabel(review.signed_at, lang)}</small>
                    </div>
                    <p>{review.findings}</p>
                    <span className="small muted">
                      {statusLabel(review.clinical_decision, lang)}
                    </span>
                  </article>
                ))}
                {isClinician && screening && screening.status !== "closed" ? (
                  <form
                    className="review-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        await run(() =>
                          w.execute("review", {
                            patient_id: patient.id,
                            revision: screening.revision,
                            findings,
                            decision,
                            priority,
                            followup_at: followupAt
                              ? new Date(followupAt).toISOString()
                              : undefined,
                          }),
                        )
                      )
                        setFindings("");
                    }}
                  >
                    <h2>{t("independent")}</h2>
                    <p className="muted small">{t("reviewNote")}</p>
                    <Field label={t("findings")}>
                      <textarea
                        required
                        maxLength={5000}
                        rows={4}
                        value={findings}
                        onChange={(e) => setFindings(e.target.value)}
                      />
                    </Field>
                    <div className="form-grid">
                      <Field label={t("decision")}>
                        <select
                          value={decision}
                          onChange={(e) => setDecision(e.target.value)}
                        >
                          <option value="refer">{t("refer")}</option>
                          <option value="follow_up">{t("follow_up")}</option>
                          <option value="close">{t("closeCase")}</option>
                        </select>
                      </Field>
                      {decision === "refer" && (
                        <Field label={t("priority")}>
                          <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                          >
                            <option value="routine">{t("routine")}</option>
                            <option value="priority">
                              {t("priorityValue")}
                            </option>
                            <option value="urgent">{t("urgent")}</option>
                          </select>
                        </Field>
                      )}
                      {decision === "follow_up" && (
                        <Field
                          label={localize(
                            lang,
                            "Follow-up date",
                            "ఫాలో అప్ తేదీ",
                          )}
                        >
                          <input
                            type="datetime-local"
                            required
                            value={followupAt}
                            onChange={(e) => setFollowupAt(e.target.value)}
                          />
                        </Field>
                      )}
                    </div>
                    <button className="button primary" disabled={w.busy}>
                      <CheckCircle2 size={17} />
                      {t("sign")}
                    </button>
                  </form>
                ) : (
                  !isClinician && (
                    <div className="form-notice">
                      <Stethoscope size={19} />
                      {t("onlyDoctor")}
                    </div>
                  )
                )}
                {isClinician &&
                  referrals.length > 0 &&
                  screening?.status !== "closed" && (
                    <form
                      className="review-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (
                          await run(() =>
                            w.execute("diagnosis", {
                              referral_id: referrals[0].id,
                              diagnosis,
                            }),
                          )
                        )
                          setDiagnosis("");
                      }}
                    >
                      <h2>{t("pathology")}</h2>
                      <Field label={t("diagnosis")}>
                        <textarea
                          required
                          rows={3}
                          maxLength={5000}
                          value={diagnosis}
                          onChange={(e) => setDiagnosis(e.target.value)}
                        />
                      </Field>
                      <button className="button secondary" disabled={w.busy}>
                        <FileText size={17} />
                        {t("saveOutcome")}
                      </button>
                    </form>
                  )}
                {investigations.map((i) => (
                  <article key={i.id} className="review-card">
                    <strong>{t("pathology")}</strong>
                    <p>{i.clinician_diagnosis}</p>
                  </article>
                ))}
              </>
            )}
          </div>
        </section>
        <aside className="detail-side">
          {!isNavigator && <ConsentPanel patient={patient} />}
          {referrals.length > 0 &&
            tab !== "appointments" &&
            screening?.status !== "closed" &&
            (isClinician || isNavigator) && (
              <section className="panel detail-card">
                <CalendarDays size={25} />
                <h3>{t("appointments")}</h3>
                <p>{t("videoHelp")}</p>
                <button
                  className="button primary"
                  onClick={() => setBooking(true)}
                >
                  <Plus size={16} />
                  {t("booking")}
                </button>
              </section>
            )}
        </aside>
      </div>
      {isClinician && <CaseDecisions key={patient.id} patient={patient} />}
      {booking && (
        <Booking
          referralId={referrals[0].id}
          onClose={() => setBooking(false)}
        />
      )}
    </>
  );
}

function Booking({
  referralId,
  onClose,
}: {
  referralId: string;
  onClose: () => void;
}) {
  const { w, t, run } = useApp();
  const [starts, setStarts] = useState(""),
    [mode, setMode] = useState("in_person");
  return (
    <Modal title={t("booking")} onClose={onClose}>
      <form
        className="registration-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(() =>
              w.execute("appoint", {
                referral_id: referralId,
                starts_at: new Date(starts).toISOString(),
                mode,
              }),
            )
          )
            onClose();
        }}
      >
        <Field label={t("date")}>
          <input
            type="datetime-local"
            required
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
          />
        </Field>
        <Field label={t("mode")}>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="in_person">{t("inPerson")}</option>
            <option value="video">{t("video")}</option>
          </select>
        </Field>
        {mode === "video" && (
          <div className="form-notice">{t("videoHelp")}</div>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="button primary" disabled={w.busy}>
            {t("book")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Appointments({ openPatient }: { openPatient: (id: string) => void }) {
  const { w, t, lang, run } = useApp(),
    canEdit = clinician(w.profile?.role) || w.profile?.role === "navigator";
  return (
    <>
      <PageHeading title={t("appointments")} subtitle={t("referralHint")} />
      <div className="form-notice">
        <Video size={19} />
        {t("videoHelp")}
      </div>
      <div className="appointment-grid">
        {[...w.data.appointments]
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          .map((a) => (
            <article className="panel appointment-card" key={a.id}>
              <div className="appointment-top">
                <span
                  className={`metric-icon ${a.mode === "video" ? "blue" : "green"}`}
                >
                  {a.mode === "video" ? (
                    <Video size={22} />
                  ) : (
                    <Stethoscope size={22} />
                  )}
                </span>
                <Badge status={a.status} />
              </div>
              <h2>
                {w.data.patients.find((p) => p.id === a.patient_id)
                  ?.display_name ?? shortId(a.patient_id)}
              </h2>
              <p>
                <CalendarDays size={15} />
                {dateLabel(a.starts_at, lang, true)}
                {localize(lang, "IST")}
              </p>
              <p>
                <MapPin size={15} />
                {a.mode === "video" ? t("video") : t("inPerson")}
              </p>
              {a.mode === "video" && (
                <span className="small muted">
                  {isCloud && w.services.video
                    ? localize(
                        lang,
                        "Consent and appointment time required to join",
                        "సమ్మతి మరియు అపాయింట్‌మెంట్ సమయం అవసరం",
                      )
                    : t("videoPending")}
                </span>
              )}
              <div className="appointment-actions">
                <button
                  className="text-button"
                  onClick={() => openPatient(a.patient_id)}
                >
                  {t("open")}
                  <ArrowUpRight size={16} />
                </button>
                {canEdit &&
                  ["confirmed", "requested", "rescheduled"].includes(
                    a.status,
                  ) && (
                    <div className="action-pair">
                      <button
                        className="button secondary"
                        disabled={w.busy}
                        onClick={() =>
                          void run(() =>
                            w.execute("attendance", {
                              appointment_id: a.id,
                              status: "completed",
                            }),
                          )
                        }
                      >
                        {t("markComplete")}
                      </button>
                      <button
                        className="button subtle"
                        disabled={w.busy}
                        onClick={() =>
                          void run(() =>
                            w.execute("attendance", {
                              appointment_id: a.id,
                              status: "missed",
                            }),
                          )
                        }
                      >
                        {t("markMissed")}
                      </button>
                    </div>
                  )}
              </div>
              <AppointmentTools appointment={a} />
            </article>
          ))}
      </div>
      {w.data.appointments.length === 0 && <Empty text={t("noAppointments")} />}
      <RemindersPanel />
    </>
  );
}

function FollowUps({ openPatient }: { openPatient: (id: string) => void }) {
  const { w, t, lang, run } = useApp(),
    [showAll, setShowAll] = useState(false),
    canEdit = clinician(w.profile?.role) || w.profile?.role === "navigator";
  const tasks = w.data.navigation_tasks.filter(
    (task) => showAll || task.status === "pending",
  );
  return (
    <>
      <PageHeading title={t("followupTitle")} subtitle={t("followupText")} />
      <div className="filter-tabs">
        <button
          className={!showAll ? "selected" : ""}
          onClick={() => setShowAll(false)}
        >
          {t("pending")}{" "}
          <b>
            {
              w.data.navigation_tasks.filter((t) => t.status === "pending")
                .length
            }
          </b>
        </button>
        <button
          className={showAll ? "selected" : ""}
          onClick={() => setShowAll(true)}
        >
          {t("all")}
        </button>
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <article className="panel task-card" key={task.id}>
            <span
              className={`metric-icon ${task.task_type === "missed_visit" ? "orange" : "green"}`}
            >
              <HeartHandshake size={24} />
            </span>
            <div className="task-copy">
              <span className="eyebrow dark">
                {statusLabel(task.task_type, lang)}
              </span>
              <button
                className="text-button task-name"
                onClick={() => openPatient(task.patient_id)}
              >
                {w.data.patients.find((p) => p.id === task.patient_id)
                  ?.display_name ?? shortId(task.patient_id)}
                <ArrowUpRight size={14} />
              </button>
              <small>
                {t("due")} {dateLabel(task.due_at, lang)} ·{" "}
                {shortId(task.patient_id)}
              </small>
            </div>
            <Badge status={task.status} />
            {canEdit && task.status === "pending" && (
              <div className="task-actions">
                <button
                  className="button secondary"
                  disabled={w.busy}
                  onClick={() =>
                    void run(() =>
                      w.execute("followup", {
                        task_id: task.id,
                        status: "completed",
                      }),
                    )
                  }
                >
                  <Check size={16} />
                  {t("completeTask")}
                </button>
                <button
                  className="text-button muted"
                  disabled={w.busy}
                  onClick={() =>
                    void run(() =>
                      w.execute("followup", {
                        task_id: task.id,
                        status: "lost_contact",
                      }),
                    )
                  }
                >
                  {t("lostContact")}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {tasks.length === 0 && <Empty text={t("emptyTask")} />}
    </>
  );
}

function AggregateChart() {
  const { w, t } = useApp();
  const rows = [
    { label: t("total"), value: w.summary.patients },
    { label: t("screening"), value: w.summary.screenings },
    { label: t("referrals"), value: w.summary.referrals },
    { label: t("pending"), value: w.summary.pending_follow_ups },
  ];
  return (
    <div className="aggregate-chart">
      {rows.map((r, i) => (
        <div className="chart-row" key={r.label}>
          <span>{r.label}</span>
          <div>
            <span
              style={{
                width: `${Math.max(2, (r.value / Math.max(w.summary.patients, w.summary.screenings, 1)) * 100)}%`,
                opacity: 1 - i * 0.14,
              }}
            />
          </div>
          <strong>{r.value}</strong>
        </div>
      ))}
    </div>
  );
}
function Reports() {
  const { w, t } = useApp();
  const rate = w.summary.screenings
    ? Math.round((w.summary.referrals / w.summary.screenings) * 100)
    : 0;
  const download = () => {
    const blob = new Blob(
      [
        "metric,count\n" +
          Object.entries(w.summary)
            .flatMap(([key, value]) =>
              typeof value === "object"
                ? Object.entries(value).map(
                    ([stage, count]) => `stage_${stage},${count}`,
                  )
                : [`${key},${value}`],
            )
            .join("\n"),
      ],
      { type: "text/csv;charset=utf-8;" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "aarogya-clinical-summary.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <PageHeading
        title={t("reportsTitle")}
        subtitle={t("reportsText")}
        action={
          <button className="button secondary" onClick={download}>
            <ArrowDownToLine size={18} />
            {t("export")}
          </button>
        }
      />
      <div className="report-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>{t("journey")}</h2>
            <Activity size={20} />
          </div>
          <AggregateChart />
        </section>
        <section className="panel coverage">
          <div
            className="donut"
            style={{
              background: `conic-gradient(var(--green) ${Math.min(rate, 100)}%, #e8efeb 0)`,
            }}
          >
            <div>
              <strong>{rate}%</strong>
              <span>{t("referral")}</span>
            </div>
          </div>
          <h2>{t("referralRate")}</h2>
          <p>{t("referralRateHelp")}</p>
        </section>
      </div>
      <OutreachPanel />
      <JourneyMetrics />
    </>
  );
}

function WorkspaceSettings() {
  const { w, t, lang, run } = useApp();
  return (
    <>
      <PageHeading
        title={t("settingsTitle")}
        subtitle={localize(
          lang,
          "District Screening & Teleconsultation Node · ITDA Paderu",
          "జిల్లా స్క్రీనింగ్ & టెలిమెడిసిన్ కేంద్రం · ITDA పాడేరు",
        )}
      />
      <div className="settings-grid">
        <IntegrationStatus />
        <section className="panel settings-card">
          <span className="metric-icon green">
            <Database size={23} />
          </span>
          <h2>{t("connection")}</h2>
          <Badge status={isCloud ? "confirmed" : "pending"} />
          <h3>
            {isCloud
              ? localize(
                  lang,
                  "Connected Care Cloud",
                  "కనెక్ట్ చేయబడిన ఆరోగ్య నెట్‌వర్క్",
                )
              : localize(
                  lang,
                  "Local training records",
                  "ఆఫ్‌లైన్ క్లినికల్ డేటాబేస్",
                )}
          </h3>
          <p>
            {isCloud
              ? localize(
                  lang,
                  "Authenticated staff session · Assigned facility records",
                  "ధృవీకరించబడిన సురక్షిత సెషన్ · కేటాయించిన రికార్డులు",
                )
              : localize(
                  lang,
                  "Training records stay in this browser and do not sync to the clinical workspace.",
                  "స్థానిక ఆఫ్‌లైన్ మోడ్‌లో పనిచేస్తోంది · కేంద్ర సర్వర్‌లతో సమకాలీకరించబడే వరకు క్లినికల్ రికార్డులు ఈ పరికరంలో సురక్షితంగా నిల్వ చేయబడతాయి.",
                )}
          </p>
          {isCloud ? (
            <button
              className="button secondary"
              onClick={() => void run(w.signOut, t("signOut"))}
            >
              <LogOut size={16} />
              {t("signOut")}
            </button>
          ) : (
            <>
              <Field
                label={localize(
                  lang,
                  "Active clinician role",
                  "క్రియాశీల వైద్యుని పాత్ర",
                )}
              >
                <select
                  value={w.profile?.role}
                  onChange={(e) =>
                    void run(
                      () => w.changeRole(e.target.value as Role),
                      roleLabel(e.target.value as Role, lang),
                    )
                  }
                >
                  {demoProfiles.map((p) => (
                    <option key={p.role} value={p.role}>
                      {roleLabel(p.role, lang)}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="small muted">
                {localize(
                  lang,
                  "Switch roles to test the workflow with fictional records.",
                  "ITDA పాడేరు మార్గదర్శకాల ప్రకారం క్లినికల్ ట్రయాజ్ మరియు పనుల కోసం పాత్రను మార్చండి.",
                )}
              </p>
              <button
                className="button secondary"
                disabled={w.busy}
                onClick={() => {
                  if (
                    window.confirm(
                      localize(
                        lang,
                        "Clear local session cache? This will refresh workspace data.",
                        "స్థానిక సెషన్ కాష్‌ను క్లియర్ చేయాలా? ఇది వర్క్‌స్పేస్ డేటాను రిఫ్రెష్ చేస్తుంది.",
                      ),
                    )
                  )
                    void run(w.reset);
                }}
              >
                <RefreshCw size={16} />
                {localize(
                  lang,
                  "Reset local session",
                  "స్థానిక సెషన్‌ను రీసెట్ చేయండి",
                )}
              </button>
            </>
          )}
        </section>
        <section className="panel settings-card">
          <span className="metric-icon blue">
            <Cloud size={23} />
          </span>
          <h2>{t("drafts")}</h2>
          <p>{t("queuedHelp")}</p>
          {w.drafts.length === 0 ? (
            <Empty text={t("noDrafts")} />
          ) : (
            w.drafts.map((d) => (
              <div key={d.id} className="draft-row">
                <strong>{String(d.payload.display_name)}</strong>
                <Badge status={d.status} />
                {d.error && <p className="error-text">{d.error}</p>}
              </div>
            ))
          )}
          <button
            className="button primary"
            disabled={w.busy || !w.online || w.drafts.length === 0}
            onClick={() => void run(w.sync)}
          >
            <RefreshCw size={16} />
            {t("sync")}
          </button>
        </section>
      </div>
    </>
  );
}

function Login({
  lang,
  setLang,
  greeting,
}: {
  lang: Language;
  setLang: (lang: Language) => void;
  greeting: ReturnType<typeof useLoginGreeting>;
}) {
  const { w, t } = useApp(),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const login = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!supabase)
        throw new Error(configurationError ?? "Workspace is loading.");
      greeting.begin();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (e) {
      greeting.cancel();
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <section className="login-brand">
        <div className="brand">
          <img
            src="/aarogya-logo.png"
            alt="Aarogya Drishti"
            width="180"
            height="180"
          />
        </div>
        <h1>{t("hello")}</h1>
        <p>{t("intro")}</p>
        <Landscape />
        <span className="eyebrow">{t("programme")}</span>
      </section>
      <section className="login-form">
        <LanguageSelector language={lang} onChange={setLang} />
        {w.loading ? (
          <div className="loading">
            <LoaderCircle className="spin" />
            {t("loading")}
          </div>
        ) : (
          <>
            <span className="metric-icon green">
              <ShieldCheck size={25} />
            </span>
            <h2>{t("signIn")}</h2>
            <p>{t("loginText")}</p>
            <form onSubmit={login}>
              <Field label={t("email")}>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label={t("password")}>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {(error || w.error) && (
                <div className="error-box" role="alert">
                  {localize(lang, error || w.error || "")}
                </div>
              )}
              <button
                className="button primary"
                disabled={busy || !!configurationError}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <ArrowRight size={17} />
                )}{" "}
                {t("signIn")}
              </button>
            </form>
            <p className="small muted">
              {localize(
                lang,
                "Clinical Decision Support System · Authorized medical personnel only",
                "క్లినికల్ డెసిషన్ సపోర్ట్ సిస్టమ్ · అధీకృత వైద్య సిబ్బంది మాత్రమే",
              )}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
