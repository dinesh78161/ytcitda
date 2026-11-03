import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Isolate the call UI from credentials and hosted patient data. Production
// imports the real SDK; only this test server aliases the transport.
const server = await createServer({
  configFile: false,
  plugins: [react()],
  resolve: {
    alias: {
      "livekit-client": fileURLToPath(
        new URL("./transport.ts", import.meta.url),
      ),
    },
  },
  server: { host: "127.0.0.1", port: 4180, strictPort: true },
});
await server.listen();
