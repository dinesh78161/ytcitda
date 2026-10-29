export const scenes = [
  {
    seconds: 20,
    title: "A clearer path to care",
    image: "dashboard-desktop.png",
    points: [
      "AAROHAN 2026",
      "Nine connected workflow stages",
      "Synthetic demonstration",
    ],
    speech:
      "Welcome to Aarogya Drishti, a screening to care demonstration for AAROHAN twenty twenty six. This walkthrough uses synthetic records and captured application screens. We will follow registration, photographs, quality checks, mock analysis, clinician review, consultation, diagnostics, treatment, and district reporting.",
  },
  {
    seconds: 30,
    title: "1 · Register with consent",
    image: "recording/registration.png",
    points: [
      "English and Telugu",
      "Separate screening and photo consent",
      "Drafts survive interrupted connectivity",
    ],
    speech:
      "The health worker begins by registering a synthetic resident. The form records age, village, preferred language, relevant history, and explicit screening consent. Photograph consent is recorded separately. Registration receives a stable identifier, so retrying a submission does not create a second screening. A device local draft allows the worker to preserve the registration during a connection interruption and retry after reconnecting.",
  },
  {
    seconds: 25,
    title: "2 · Capture oral photographs",
    image: "recording/photos-quality-ai.png",
    points: [
      "Guided oral views",
      "Private image storage",
      "Synthetic pattern shown",
    ],
    speech:
      "The oral photograph workspace guides the worker through supported views. The image shown here is a generated test pattern, rather than a photograph of a patient. Uploaded image bytes are decoded, checked for size and dimensions, normalized, and linked to the correct screening. In the hosted application, files are stored in private buckets rather than public image links.",
  },
  {
    seconds: 20,
    title: "3 · Check image quality",
    image: "recording/photos-quality-ai.png",
    points: [
      "Reject undecodable files",
      "Exposure and blur guidance",
      "Prototype quality thresholds",
    ],
    speech:
      "The quality check provides retake guidance when a file cannot be decoded or the prototype exposure and blur checks reject it. The automated tests cover a flat image requesting recapture and a synthetic pattern being accepted. These checks demonstrate software behavior; clinical image quality has not been calibrated.",
  },
  {
    seconds: 20,
    title: "4 · Record labelled mock analysis",
    image: "recording/photos-quality-ai.png",
    points: [
      "Mock result is explicit",
      "No disease prediction or confidence score",
      "Clinician review stays independent",
    ],
    speech:
      "The analysis used for this demonstration is explicitly labelled as a mock. It produces no disease prediction and no clinical confidence score. The patient journey distinguishes a recorded mock result from real analysis. The clinician can continue reviewing the case independently, even when experimental analysis is disabled or unavailable.",
  },
  {
    seconds: 25,
    title: "5 · Medical Officer review",
    image: "recording/officer-review.png",
    points: [
      "Independent findings",
      "Signed review and referral",
      "Revision and assignment checks",
    ],
    speech:
      "The Medical Officer reviews the screening and enters independent findings. Signing the review creates an immutable clinical history entry and, when required, a specialist referral. The application checks the user's role, the patient's assignment, and the record revision before accepting a clinical change. A stale review cannot silently overwrite a newer decision. The navigator receives the linked follow up work.",
  },
  {
    seconds: 30,
    title: "6 · Video consultation and referral",
    image: "livekit-two-party-1.png",
    points: [
      "Real LiveKit provider transport",
      "Generated camera and audio in this test",
      "Physical phone/audio check remains",
    ],
    speech:
      "Appointments connect the worker and assigned specialist. This captured call used two independent browsers and a real LiveKit project, with generated camera and audio sources. Both participants received video frames, and the microphone, camera off, and leave controls passed. Joining requires the assigned appointment, current teleconsultation consent, and a valid time window. A phone to laptop call using physical cameras and audible speech remains a separate hands on acceptance check.",
  },
  {
    seconds: 30,
    title: "7 · Biopsy and pathology when needed",
    image: "recording/diagnostics.png",
    points: [
      "Track investigation stages",
      "Attach private PDF or JPEG reports",
      "Clinician records the reviewed result",
    ],
    speech:
      "When diagnostic work is needed, the care plan records the investigation and tracks its progress through the appropriate stages. A simulated report can be attached as a private PDF or image. The hosted acceptance test verified actual report upload, download, retry protection, and access restrictions. The clinician records the reviewed result. An outstanding investigation remains visible in the patient journey and must be resolved before case closure.",
  },
  {
    seconds: 25,
    title: "8 · Treatment and navigation",
    image: "recording/treatment.png",
    points: [
      "Append-only treatment progress",
      "Follow-up and missed-visit tasks",
      "Closure requires resolved care",
    ],
    speech:
      "Treatment plans and progress entries retain their history. Navigators can manage attendance and follow up without receiving unrestricted clinical records. A case cannot be closed while required appointments, investigations, active treatment, or follow up tasks remain unresolved. When a procedure is unnecessary, the clinician records a signed decision. Reopening a case preserves earlier decisions and completed care history.",
  },
  {
    seconds: 25,
    title: "9 · District health summaries",
    image: "recording/district-reports.png",
    points: [
      "Aggregate totals and care stages",
      "Follow-up completion metrics",
      "CSV export without patient rows",
    ],
    speech:
      "The district workspace summarizes screening, referrals, care stages, completed cases, outreach, and follow up completion. The administrator receives aggregate values and CSV summaries. Individual patient rows and private clinical files are restricted by database policies. The automated checks cover all five staff roles and confirm the expected separation between clinical work, navigation, and district reporting.",
  },
  {
    seconds: 25,
    title: "Offline recovery and Telugu access",
    image: "dashboard-mobile-telugu.png",
    points: [
      "Bundled English and Telugu fonts",
      "Registration survives reload offline",
      "Reconnect retries exactly once",
    ],
    speech:
      "The application includes English and Telugu layouts and bundled fonts. The production application shell can be cached for offline use. In the automated offline check, a registration survived a reload, reconnected successfully, and remained a single record after another reconnect. Historical cloud clinical records are not cached for offline reading. Actual Android installation and camera behavior still need a physical device check.",
  },
  {
    seconds: 25,
    title: "Security, recovery and disclosure",
    image: "mfa-mobile-challenge.png",
    points: [
      "Authenticator gate implemented and tested",
      "Encrypted isolated restore passed",
      "Owner must apply the live database update",
    ],
    speech:
      "Authenticator verification for clinical and administrator accounts has been implemented and tested. Encrypted backup tools also passed an isolated PostgreSQL restore rehearsal. Activating the live database policies requires project owner access. Physical device checks and accurate team contributions remain. This walkthrough uses generated narration and synthetic test screenshots. Review it and disclose AI assistance before submission.",
  },
];
