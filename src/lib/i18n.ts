import { localize } from "./localize.ts";
import type { Language, Role } from "./types";
export function oralViewLabel(value: string, language: Language) {
  const views: Record<string, [string, string]> = {
    cheek: ["Cheek", "చెంప"],
    tongue: ["Tongue", "నాలుక"],
    palate: ["Palate", "అంగిలి"],
    gums: ["Gums", "చిగుళ్లు"],
    floor_of_mouth: ["Floor of mouth", "నోటి అడుగు భాగం"],
  };
  return views[value]
    ? localize(language, ...views[value])
    : value.replaceAll("_", " ");
}
export const labels = {
  duplicateWarning: [
    "Possible existing record among your assigned patients. Check before registering another person:",
    "మీకు కేటాయించిన రోగులలో ఇదే వ్యక్తి రికార్డు ఉండవచ్చు. కొత్త నమోదు ముందు తనిఖీ చేయండి:",
  ],
  overview: ["Overview", "అవలోకనం"],
  patients: ["Patient registry", "రోగుల నమోదు"],
  screenings: ["Screening queue", "పరీక్షల జాబితా"],
  appointments: ["Appointments", "అపాయింట్‌మెంట్‌లు"],
  followups: ["Care navigation", "సంరక్షణ సమన్వయం"],
  reports: ["District reports", "జిల్లా నివేదికలు"],
  settings: ["Workspace settings", "వర్క్‌స్పేస్ సెట్టింగ్‌లు"],
  workspace: ["CARE WORKSPACE", "సంరక్షణ కేంద్రం"],
  programme: ["AAROHAN 2026 · ITDA PADERU", "ఆరోహణ్ 2026 · ఐటీడీఏ పాడేరు"],
  tagline: ["Community care, connected.", "సమాజ ఆరోగ్యానికి అనుసంధానం."],
  hello: ["A clearer path to care.", "మెరుగైన సంరక్షణకు స్పష్టమైన మార్గం."],
  intro: [
    "Every screening is a first step. Keep the next one within reach.",
    "ప్రతి పరీక్ష ఒక తొలి అడుగు. తదుపరి సంరక్షణను అందుబాటులో ఉంచండి.",
  ],
  newPatient: ["Register patient", "రోగిని నమోదు చేయండి"],
  search: [
    "Search by name, village or ID…",
    "పేరు, గ్రామం లేదా ఐడీతో వెతకండి…",
  ],
  all: ["All records", "అన్ని రికార్డులు"],
  total: ["Patients registered", "నమోదైన రోగులు"],
  waiting: ["Awaiting review", "సమీక్ష కోసం వేచి ఉన్నవి"],
  referrals: ["Specialist referrals", "నిపుణులకు సిఫార్సులు"],
  pending: ["Pending follow-ups", "పెండింగ్ ఫాలో అప్‌లు"],
  recorded: ["Recorded in this workspace", "ఈ కేంద్రంలో నమోదైనవి"],
  reviewHint: ["Independent clinician review", "వైద్యుని స్వతంత్ర సమీక్ష"],
  referralHint: ["Connected to specialist care", "నిపుణుల సంరక్షణకు అనుసంధానం"],
  followupHint: [
    "Keep the care journey moving",
    "సంరక్షణ ప్రయాణాన్ని కొనసాగించండి",
  ],
  journey: ["From screening to care", "పరీక్ష నుంచి సంరక్షణ వరకు"],
  journeyText: [
    "One connected record. Every step accounted for.",
    "ఒకే రికార్డు. ప్రతి దశకు సమాచారం.",
  ],
  registration: ["Registration", "నమోదు"],
  screening: ["Screening", "పరీక్ష"],
  review: ["Doctor review", "వైద్య సమీక్ష"],
  referral: ["Referral", "సిఫార్సు"],
  care: ["Follow-up", "ఫాలో అప్"],
  recent: ["Recent patients", "ఇటీవలి రోగులు"],
  viewAll: ["View all patients", "రోగులందరినీ చూడండి"],
  patient: ["Patient", "రోగి"],
  village: ["Village / mandal", "గ్రామం / మండలం"],
  stage: ["Care stage", "సంరక్షణ దశ"],
  registered: ["Registered", "నమోదు తేదీ"],
  open: ["Open record", "రికార్డు తెరవండి"],
  noRecords: ["No records here yet", "ఇక్కడ ఇంకా రికార్డులు లేవు"],
  noResults: [
    "No matching patients. Try another name or village.",
    "రోగులు కనబడలేదు. మరో పేరు లేదా గ్రామంతో వెతకండి.",
  ],
  attention: ["Needs attention", "శ్రద్ధ అవసరం"],
  attentionText: [
    "Small actions that keep care on track.",
    "సంరక్షణ కొనసాగడానికి చిన్న చర్యలు.",
  ],
  reviewQueue: ["Review the screening queue", "పరీక్షల జాబితాను సమీక్షించండి"],
  missed: ["Missed appointments", "హాజరుకాని అపాయింట్‌మెంట్‌లు"],
  openTasks: ["Open follow-up tasks", "పెండింగ్ పనులు"],
  quick: ["Your next step", "మీ తదుపరి అడుగు"],
  quickText: [
    "Register a synthetic patient and start a screening.",
    "కల్పిత రోగిని నమోదు చేసి పరీక్ష ప్రారంభించండి.",
  ],
  protected: ["Assigned records only", "కేటాయించిన రికార్డులు మాత్రమే"],
  synthetic: ["SYNTHETIC DATA ONLY", "కల్పిత డేటా మాత్రమే"],
  nonclinical: [
    "Research demonstration · NOT FOR CLINICAL USE",
    "పరిశోధన ప్రదర్శన · వైద్య వినియోగానికి కాదు",
  ],
  demo: ["Local demo", "స్థానిక డెమో"],
  cloud: ["Supabase workspace", "సుపాబేస్ వర్క్‌స్పేస్"],
  online: ["Online", "ఆన్‌లైన్"],
  offline: ["Offline", "ఆఫ్‌లైన్"],
  demoNote: [
    "Synthetic demo · Changes stay in this browser. Role switching is for demonstration only.",
    "కల్పిత డెమో · మార్పులు ఈ బ్రౌజర్‌లోనే ఉంటాయి. పాత్ర మార్పు ప్రదర్శన కోసం మాత్రమే.",
  ],
  name: ["Full name (synthetic)", "పూర్తి పేరు (కల్పిత)"],
  age: ["Age in years", "వయస్సు"],
  phone: ["Contact number (optional)", "సంప్రదింపు సంఖ్య (ఐచ్ఛికం)"],
  language: ["Preferred language", "ఇష్టమైన భాష"],
  details: ["Patient details", "రోగి వివరాలు"],
  history: ["Screening intake", "పరీక్ష వివరాలు"],
  tobacco: ["Tobacco history", "పొగాకు వినియోగ చరిత్ర"],
  never: ["Never", "ఎప్పుడూ లేదు"],
  former: ["Former use", "గతంలో ఉపయోగించారు"],
  current: ["Current use", "ప్రస్తుతం ఉపయోగిస్తున్నారు"],
  discomfort: ["Oral discomfort reported", "నోటి అసౌకర్యం ఉన్నట్లు తెలిపారు"],
  notes: ["Examiner observations", "పరీక్షకుని పరిశీలనలు"],
  consent: [
    "Screening consent recorded in the selected language",
    "ఎంచుకున్న భాషలో పరీక్ష సమ్మతి నమోదు చేశాను",
  ],
  photoConsent: [
    "Separate consent for educational oral photographs",
    "విద్యా నోటి చిత్రాల కోసం ప్రత్యేక సమ్మతి",
  ],
  consentHelp: [
    "Use fictional details and licensed educational media only.",
    "కల్పిత వివరాలు, అనుమతించిన విద్యా చిత్రాలను మాత్రమే ఉపయోగించండి.",
  ],
  save: ["Save screening", "పరీక్షను సేవ్ చేయండి"],
  saving: ["Saving…", "సేవ్ అవుతోంది…"],
  cancel: ["Cancel", "రద్దు"],
  close: ["Close", "మూసివేయండి"],
  draftSaved: ["Draft saved on this device", "డ్రాఫ్ట్ ఈ పరికరంలో సేవ్ అయింది"],
  draftQueued: ["Saved to the offline queue", "ఆఫ్‌లైన్ జాబితాలో సేవ్ అయింది"],
  saved: ["Record saved", "రికార్డు సేవ్ అయింది"],
  patientRecord: ["Patient record", "రోగి రికార్డు"],
  clinical: ["Clinical record", "వైద్య రికార్డు"],
  photos: ["Oral photographs", "నోటి చిత్రాలు"],
  timeline: ["Record timeline", "రికార్డు కాలక్రమం"],
  noPhotos: [
    "No educational photographs attached",
    "విద్యా చిత్రాలు జత చేయలేదు",
  ],
  capture: [
    "Capture / upload demo photo",
    "డెమో చిత్రం తీయండి / అప్‌లోడ్ చేయండి",
  ],
  photoHelp: [
    "JPEG, PNG or WebP · up to 10 MB · no real patient images",
    "JPEG, PNG లేదా WebP · 10 MB వరకు · నిజమైన రోగి చిత్రాలు వద్దు",
  ],
  photoMissing: [
    "Photo consent is required before capturing an image.",
    "చిత్రం తీసే ముందు సమ్మతి అవసరం.",
  ],
  cloudPhoto: [
    "Private file upload service is not connected yet. Intake and clinician review remain available.",
    "ప్రైవేట్ ఫైల్ అప్‌లోడ్ సేవ ఇంకా అనుసంధానం కాలేదు. పరీక్ష వివరాలు, వైద్య సమీక్ష అందుబాటులో ఉన్నాయి.",
  ],
  quality: ["Image quality", "చిత్ర నాణ్యత"],
  acceptable: ["Quality check passed", "నాణ్యత తనిఖీ పూర్తయింది"],
  recapture: ["Retake recommended", "మళ్లీ చిత్రం తీయండి"],
  analyze: ["Run mock AI", "మాక్ AI ప్రారంభించండి"],
  mockResult: [
    "Mock result: clinician review required. No medical prediction was made.",
    "మాక్ ఫలితం: వైద్య సమీక్ష అవసరం. వైద్య అంచనా చేయలేదు.",
  ],
  qualityNote: [
    "Prototype checks measure exposure and sharpness only. They do not detect disease.",
    "ప్రాథమిక తనిఖీలు కాంతి, స్పష్టతను మాత్రమే కొలుస్తాయి. వ్యాధిని గుర్తించవు.",
  ],
  independent: ["Independent clinician review", "స్వతంత్ర వైద్య సమీక్ష"],
  findings: ["Clinician findings", "వైద్యుని పరిశీలనలు"],
  decision: ["Clinical decision", "వైద్య నిర్ణయం"],
  refer: ["Refer to specialist", "నిపుణునికి సిఫార్సు"],
  follow_up: ["Continue follow-up", "ఫాలో అప్ కొనసాగించండి"],
  closeCase: ["Close this case", "ఈ కేసును ముగించండి"],
  priority: ["Referral priority", "సిఫార్సు ప్రాధాన్యత"],
  routine: ["Routine", "సాధారణ"],
  priorityValue: ["Priority", "ప్రాధాన్యత"],
  urgent: ["Urgent", "అత్యవసరం"],
  sign: ["Sign review", "సమీక్షపై సంతకం చేయండి"],
  reviewNote: [
    "Your clinical decision is independent of the mock AI result. Signed reviews are retained.",
    "మీ వైద్య నిర్ణయం మాక్ AI ఫలితంతో స్వతంత్రంగా ఉంటుంది. సంతకం చేసిన సమీక్షలు భద్రపరుస్తాం.",
  ],
  onlyDoctor: [
    "Switch to a clinician account to record an independent review.",
    "స్వతంత్ర సమీక్ష కోసం వైద్యుని ఖాతాను ఉపయోగించండి.",
  ],
  booking: ["Book appointment", "అపాయింట్‌మెంట్ బుక్ చేయండి"],
  date: ["Date and time", "తేదీ, సమయం"],
  mode: ["Consultation mode", "సంప్రదింపు విధానం"],
  video: ["Video consultation", "వీడియో సంప్రదింపు"],
  inPerson: ["In-person visit", "ప్రత్యక్ష సందర్శన"],
  book: ["Confirm appointment", "అపాయింట్‌మెంట్ నిర్ధారించండి"],
  completed: ["Completed", "పూర్తయింది"],
  markComplete: ["Mark attended", "హాజరు నమోదు చేయండి"],
  markMissed: ["Mark missed", "హాజరుకాలేదని నమోదు చేయండి"],
  videoPending: ["Video provider not connected", "వీడియో సేవ అనుసంధానం కాలేదు"],
  videoHelp: [
    "Booking works. A secure video provider must be configured before two-party calls are available.",
    "బుకింగ్ అందుబాటులో ఉంది. ఇద్దరి వీడియో కాల్ కోసం సురక్షిత వీడియో సేవ అవసరం.",
  ],
  noAppointments: ["No appointments booked yet", "ఇంకా అపాయింట్‌మెంట్‌లు లేవు"],
  pathology: ["Simulated diagnostics", "అనుకరణ పరీక్షలు"],
  diagnosis: [
    "Clinician-entered simulated outcome",
    "వైద్యుడు నమోదు చేసే కల్పిత ఫలితం",
  ],
  saveOutcome: ["Save simulated outcome", "కల్పిత ఫలితాన్ని సేవ్ చేయండి"],
  followupTitle: [
    "Keep every patient connected.",
    "ప్రతి రోగితో అనుసంధానం కొనసాగించండి.",
  ],
  followupText: [
    "Track attendance, arrange support and close the loop.",
    "హాజరును గమనించండి, సహాయం అందించండి, ఫాలో అప్ పూర్తి చేయండి.",
  ],
  completeTask: ["Complete task", "పని పూర్తి చేయండి"],
  lostContact: ["Lost contact", "సంప్రదింపు సాధ్యం కాలేదు"],
  declined: ["Declined", "నిరాకరించారు"],
  due: ["Due", "గడువు"],
  reportsTitle: ["A view of community care.", "సమాజ సంరక్షణ అవలోకనం."],
  reportsText: [
    "Aggregate counts only. No identifiable patient information.",
    "మొత్తం సంఖ్యలు మాత్రమే. వ్యక్తిగత రోగి సమాచారం లేదు.",
  ],
  export: ["Export summary CSV", "సారాంశం CSV ఎగుమతి"],
  referralRate: ["Referral coverage", "సిఫార్సుల నిష్పత్తి"],
  referralRateHelp: [
    "Referrals as a share of screening records; not a disease prevalence estimate.",
    "పరీక్షలలో సిఫార్సుల నిష్పత్తి; ఇది వ్యాధి వ్యాప్తి అంచనా కాదు.",
  ],
  settingsTitle: ["Your care workspace", "మీ సంరక్షణ వర్క్‌స్పేస్"],
  demoRole: ["Demo role", "డెమో పాత్ర"],
  demoRoleHelp: [
    "Explore the five roles using synthetic records. This is not an authentication system.",
    "కల్పిత రికార్డులతో ఐదు పాత్రలను చూడండి. ఇది ప్రమాణీకరణ వ్యవస్థ కాదు.",
  ],
  connection: ["Connection", "అనుసంధానం"],
  cloudHelp: [
    "Create your Supabase project, apply all five migrations, then configure the project URL and publishable key.",
    "సుపాబేస్ ప్రాజెక్ట్ సృష్టించి, ఐదు మైగ్రేషన్‌లను అమలు చేసి, URL మరియు పబ్లిషబుల్ కీని సెట్ చేయండి.",
  ],
  drafts: ["Offline registration queue", "ఆఫ్‌లైన్ నమోదు జాబితా"],
  sync: ["Retry pending registrations", "పెండింగ్ నమోదులను మళ్లీ పంపండి"],
  noDrafts: ["No pending registrations", "పెండింగ్ నమోదులు లేవు"],
  queuedHelp: [
    "Queued records stay on this device until acknowledged. Failed entries are retained for retry.",
    "నిర్ధారణ వచ్చే వరకు రికార్డులు ఈ పరికరంలో ఉంటాయి. విఫలమైనవి మళ్లీ పంపడానికి ఉంచుతాం.",
  ],
  reset: ["Reset synthetic demo", "కల్పిత డెమోను రీసెట్ చేయండి"],
  resetConfirm: [
    "Reset this browser’s synthetic records? This removes local demo changes.",
    "ఈ బ్రౌజర్ కల్పిత రికార్డులను రీసెట్ చేయాలా? స్థానిక మార్పులు తొలగుతాయి.",
  ],
  signOut: ["Sign out", "సైన్ అవుట్"],
  signIn: ["Sign in", "సైన్ ఇన్"],
  email: ["Email", "ఇమెయిల్"],
  password: ["Password", "పాస్‌వర్డ్"],
  loginText: [
    "Sign in with your provisioned care-team account.",
    "మీకు కేటాయించిన సంరక్షణ బృంద ఖాతాతో సైన్ ఇన్ చేయండి.",
  ],
  refresh: ["Refresh records", "రికార్డులను నవీకరించండి"],
  loading: ["Loading workspace…", "వర్క్‌స్పేస్ లోడ్ అవుతోంది…"],
  retry: ["Try again", "మళ్లీ ప్రయత్నించండి"],
  years: ["years", "సంవత్సరాలు"],
  back: ["Back to patients", "రోగుల జాబితాకు తిరిగి"],
  emptyTask: ["You’re all caught up.", "పెండింగ్ పనులు లేవు."],
  menu: ["Open navigation", "మెనూ తెరవండి"],
} as const;
export type Label = keyof typeof labels;
export const clinicalLabels: Partial<Record<Label, readonly [string, string]>> =
  {
    name: ["Full name", "పూర్తి పేరు"],
    quickText: [
      "Register a patient and start a screening.",
      "రోగిని నమోదు చేసి పరీక్ష ప్రారంభించండి.",
    ],
    cloud: ["Clinical workspace", "వైద్య కార్యస్థలం"],
    photoConsent: [
      "Consent for oral photographs recorded",
      "నోటి చిత్రాల కోసం సమ్మతి నమోదు చేశాను",
    ],
    consentHelp: [
      "Explain the screening and record the patient's consent before continuing.",
      "కొనసాగించే ముందు పరీక్ష గురించి వివరించి రోగి సమ్మతిని నమోదు చేయండి.",
    ],
    noPhotos: ["No oral photographs attached", "నోటి చిత్రాలు జత చేయలేదు"],
    capture: [
      "Capture / upload oral photograph",
      "నోటి చిత్రం తీయండి / అప్‌లోడ్ చేయండి",
    ],
    photoHelp: [
      "JPEG, PNG or WebP · up to 10 MB · patient consent required",
      "JPEG, PNG లేదా WebP · 10 MB వరకు · రోగి సమ్మతి అవసరం",
    ],
    reviewNote: [
      "Record your examination findings and sign your decision. Signed reviews are retained.",
      "పరీక్ష పరిశీలనలను నమోదు చేసి నిర్ణయంపై సంతకం చేయండి. సంతకం చేసిన సమీక్షలు భద్రపరుస్తాం.",
    ],
    diagnosis: ["Clinician-entered diagnosis", "వైద్యుడు నమోదు చేసిన నిర్ధారణ"],
    pathology: ["Diagnostic investigations", "నిర్ధారణ పరీక్షలు"],
    saveOutcome: ["Save diagnostic outcome", "నిర్ధారణ ఫలితాన్ని సేవ్ చేయండి"],
    draftSaved: [
      "Changes held for this session",
      "ఈ సెషన్‌లో మార్పులు ఉంచబడ్డాయి",
    ],
    drafts: ["Pending submissions", "పెండింగ్ సమర్పణలు"],
    cloudHelp: [
      "Contact your workspace administrator for connection and staff access settings.",
      "కనెక్షన్ మరియు సిబ్బంది ప్రవేశ సెట్టింగ్‌ల కోసం నిర్వాహకుడిని సంప్రదించండి.",
    ],
  };
export const translator =
  (language: Language, clinical = false) =>
  (key: Label) => {
    const pair = clinical ? (clinicalLabels[key] ?? labels[key]) : labels[key];
    return localize(language, pair[0], pair[1]);
  };
const roleNames = {
  health_worker: ["Health worker", "ఆరోగ్య కార్యకర్త"],
  medical_officer: ["Medical officer", "వైద్య అధికారి"],
  specialist: ["Specialist", "నిపుణుడు"],
  navigator: ["Care navigator", "సంరక్షణ సమన్వయకర్త"],
  district_admin: ["District admin", "జిల్లా అధికారి"],
};
export const roleLabel = (role: Role, language: Language) =>
  localize(language, roleNames[role][0], roleNames[role][1]);
export function statusLabel(status: string, language: Language) {
  const map: Record<string, [string, string]> = {
    assessed: ["Consultation completed", "సంప్రదింపు పూర్తయింది"],
    diagnostics_pending: ["Diagnostics in progress", "పరీక్షలు జరుగుతున్నాయి"],
    care_linked: ["Treatment / continuing care", "చికిత్స / తదుపరి సంరక్షణ"],
    rescheduled: ["Rescheduled", "సమయం మార్చారు"],
    planned: ["Planned", "ప్రణాళిక సిద్ధం"],
    active: ["Active", "కొనసాగుతోంది"],
    stopped: ["Stopped", "నిలిపివేశారు"],
    collected: ["Sample collected", "నమూనా సేకరించారు"],
    reported: ["Reported", "నివేదించారు"],
    sent: ["Sent", "పంపారు"],
    acknowledged: ["Contacted", "సంప్రదించారు"],
    failed: ["Delivery failed", "పంపిణీ విఫలమైంది"],
    awaiting_clinician: ["Awaiting review", "సమీక్ష కోసం వేచి ఉంది"],
    screened: ["Screened", "పరీక్షించారు"],
    reviewed: ["Reviewed", "సమీక్షించారు"],
    referral_planned: ["Referred", "సిఫార్సు చేశారు"],
    appointed: ["Appointment booked", "అపాయింట్‌మెంట్ బుక్ అయింది"],
    result_reviewed: ["Outcome reviewed", "ఫలితం సమీక్షించారు"],
    closed: ["Closed", "ముగిసింది"],
    confirmed: ["Confirmed", "నిర్ధారించారు"],
    requested: ["Requested", "అభ్యర్థించారు"],
    completed: ["Completed", "పూర్తయింది"],
    missed: ["Missed", "హాజరుకాలేదు"],
    cancelled: ["Cancelled", "రద్దయింది"],
    pending: ["Pending", "పెండింగ్"],
    declined: ["Declined", "నిరాకరించారు"],
    lost_contact: ["Lost contact", "సంప్రదింపు లేదు"],
    follow_up: ["Follow-up", "ఫాలో అప్"],
    missed_visit: ["Missed visit", "హాజరుకాని సందర్శన"],
    transport: ["Transport", "రవాణా"],
    contact: ["Contact", "సంప్రదింపు"],
  };
  return map[status]
    ? localize(language, map[status][0], map[status][1])
    : status.replaceAll("_", " ");
}
