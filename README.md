# Ephemeral Chat V2 — No-Cloud Edition

This edition removes Cloudflare, S3, buckets, API keys, billing setup and all server-side media storage.

## How media transfer works

- Chat text and room state are held in the chat server's RAM only.
- Files are transferred directly between room participants using a full-mesh WebRTC DataChannel network. In an eight-person room, each browser can have up to seven direct peer connections (28 pairwise connections across the room).
- Media bytes are not uploaded to Render or saved by this app on a server.
- The receiver chooses a save location before accepting a file. Chrome and Edge support the File System Access API used for streaming large files to disk.
- Browsers without that API use an in-memory fallback limited to 512 MiB. For files larger than that, use a current desktop version of Chrome or Edge.
- The owner can set a transfer size limit from 1 to 10 GB. Actual success depends on both devices' storage, browser limits, network quality and connection topology.

## Important connectivity limitation

WebRTC attempts a direct peer-to-peer connection using public STUN servers. Some NATs, firewalls, mobile networks, VPNs or corporate networks block direct connectivity. In those cases a TURN relay is needed. This project does not include a TURN service, so a connection may fail on restrictive networks. A TURN relay may have usage charges; no provider or payment card is required for the basic direct-connection attempt, but universal connectivity cannot be guaranteed.

All intended recipients must be online in the same room for a transfer. The sender remains connected while each recipient downloads. When a sender shares a file, an offer is shown to everyone else in the room; each recipient chooses whether to accept it. The sender does not select recipients individually. Large transfers can take a long time and can fail if either browser/device sleeps, reloads, disconnects or runs out of disk space.

## Screenshot limitation

Websites cannot reliably disable screenshots. The Print Screen and Ctrl+P keyboard deterrents, blur-on-focus-loss and watermark cannot prevent OS-level capture, Snipping Tool, phone cameras or browser capture.

## Deploy to Render

1. Upload the **contents** of this folder to a new GitHub repository. `render.yaml` must be at the repository root.
2. In Render, choose **New > Blueprint** and connect the repository.
3. Render creates two services: `ephemeral-chat-v2` and `ephemeral-chat-v2-admin`.
4. Set `ADMIN_PASSWORD` on the admin service to a long, unique password.
5. Set `CHAT_SERVICE_URL` on the admin service to the public chat service URL (for example `https://ephemeral-chat-v2.onrender.com`).
6. Copy the generated `ADMIN_CONTROL_SECRET` from the chat service and set the identical value on the admin service.
7. Set `RENDER_API_KEY` and `RENDER_CHAT_SERVICE_ID` on the admin service to enable actual Render suspend/resume controls. These are optional for chat itself, but required for the Start/Stop buttons. Keep the API key secret and narrowly permissioned.
8. Deploy both services.

No Cloudflare account, R2 bucket, storage credentials, CORS policy or credit card is needed for this application version.

## Owner panel

The admin site has its own URL. Do not share it. It requires the `ADMIN_PASSWORD`. Clear-all removes all active rooms and disconnects users. Maintenance mode prevents new joins. Start/Stop calls the Render API if configured.

## Verification

This is a starter implementation, not a production security audit. Test with two different devices and networks, including an image, GIF, short video and a large file. Test owner login, clear-all, maintenance mode and service suspend/resume. Render free instances can sleep; that may interrupt active chat sessions and transfers. A server restart clears all room and message state.


## User features in this update
- Rooms accept up to 8 connected participants. Text messages are broadcast to everyone in the room.
- Each browser profile has its own light/dark theme and desktop-notification preference.
- Users can save up to 5 room codes and display names locally in that browser. Saved-room entries do not include chat messages or media.
- Desktop notifications require browser permission and Windows notifications to be enabled. They are supported by current Chromium-based browsers such as Microsoft Edge and Google Chrome.
- Chat history remains in server memory only while a room is active and is cleared when the room becomes empty or the owner uses Clear all.
- File sharing is broadcast to everyone in the room over separate direct peer connections. Recipients individually accept or decline the incoming file; no media is relayed or stored by the chat server.
- The message composer supports @Name mentions. If desktop notifications are enabled, a matching mention triggers a desktop notification even while the chat tab is visible. Other new-message notifications are shown when the tab is not visible.
- Desktop notifications have two modes: ON and DO NOT DISTURB. The setting is per browser profile and requires notification permission. Windows may also need notifications enabled for the browser in Windows Settings.
- A full mesh can use up to 28 peer connections in an eight-person room. Direct connections are not guaranteed on every network; without a TURN relay, some participants may fail to connect behind restrictive NATs or firewalls.


## End-to-end encryption (E2EE)

- Chat message bodies are encrypted in the browser with Web Crypto AES-256-GCM before they are sent to the chat server. The server stores and relays only ciphertext while a room is active; message history is still temporary in server RAM and is cleared when the room empties or the owner clears rooms.
- File contents are encrypted in the sender's browser in independently authenticated AES-GCM chunks before being sent over WebRTC. WebRTC also provides DTLS transport encryption. File names and MIME details in transfer offers are encrypted; the server can still see the transfer size, sender, room membership, and connection/signalling metadata.
- The room creator may enter a custom passphrase (minimum 12 characters). The browser derives a 256-bit AES-GCM key from it using PBKDF2-HMAC-SHA-256 with 310,000 iterations and a room-specific salt. If the field is left blank, the browser generates a cryptographically random 256-bit key. The resulting key token is shared in the URL fragment (`#key=...`), which browsers do not send in HTTP requests. The app removes the fragment from the address bar after a successful join. The Copy invite button includes the key fragment; share the complete link only with trusted participants. Existing invitations using the previous random-key format remain supported.
- A joining browser without the key is refused if the room is already active. This avoids accidentally joining with a different key. A room's key is kept in that browser's local storage so the same browser can reconnect; saved-room entries also retain the key locally. Neither stores messages or media. Clearing browser site data or losing the key means the room's encrypted history cannot be decrypted.
- All participants in a room share the same room key. Anyone who has the complete invitation link can decrypt room content. This implementation does not provide individual member identity verification, per-member key rotation, forward secrecy, or protection if a participant's device/browser is compromised. A participant who leaves may still know the old room key. For stronger group security, authenticated key exchange and membership-triggered key rotation would be needed.
- E2EE requires a modern browser with Web Crypto and a secure context (HTTPS; localhost is also allowed for local development).

This is an initial E2EE implementation, not a professional cryptographic audit. Test with multiple separate browsers/devices before relying on it for sensitive conversations.
