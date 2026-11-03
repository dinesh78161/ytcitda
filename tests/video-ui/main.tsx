import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import LiveConsultation from "../../src/LiveConsultation";
import "../../src/styles.css";

const access = {
  provider: "livekit" as const,
  server_url: "wss://test.invalid",
  token: "isolated-ui-test",
  room_name: "test-room",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};
function Fixture() {
  const [open, setOpen] = useState(true);
  const [maximized, setMaximized] = useState(false);
  return (
    <main style={{ padding: 16 }}>
      <div
        className={maximized ? "modal modal-maximized" : ""}
        style={{ display: "block" }}
      >
        <button onClick={() => setOpen(false)}>Leave test call</button>
        <button onClick={() => setMaximized(!maximized)}>
          Maximize test call
        </button>
        {open && (
          <LiveConsultation
            access={access}
            appointmentId="test-appointment"
            lang="en"
            userRole="medical_officer"
          />
        )}
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
