# Ephemeral Chat V2 — No-Cloud Edition

This edition removes Cloudflare, S3, buckets, API keys, billing setup and all server-side media storage.

## How media transfer works

- Chat text and room state are held in the chat server's RAM only.
- Images, GIFs and videos are transferred directly between the two browsers using WebRTC DataChannels.
- Media bytes are not uploaded to Render or saved by this app on a server.
- The receiver chooses a save location before accepting a file. Chrome and Edge support the File System Access API used for streaming large files to disk.
- Browsers without that API use an in-memory fallback limited to 512 MiB. For files larger than that, use a current desktop version of Chrome or Edge.
- The owner can set a transfer size limit from 1 to 10 GB. Actual success depends on both devices' storage, browser limits, network quality and connection topology.

## Important connectivity limitation

WebRTC attempts a direct peer-to-peer connection using public STUN servers. Some NATs, firewalls, mobile networks, VPNs or corporate networks block direct connectivity. In those cases a TURN relay is needed. This project does not include a TURN service, so a connection may fail on restrictive networks. A TURN relay may have usage charges; no provider or payment card is required for the basic direct-connection attempt, but universal connectivity cannot be guaranteed.

Both people must be online in the same room for a transfer. The sender must remain connected until it finishes. Large transfers can take a long time and can fail if either browser/device sleeps, reloads, disconnects or runs out of disk space.

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
