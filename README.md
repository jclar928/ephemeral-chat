# Ephemeral Chat

A two-person chat website with text, images, GIFs and videos.

## Privacy / storage behaviour

- No database, account system, disk upload directory, or application chat log.
- Messages and media are held in server RAM while at least one room member is connected.
- When the last person leaves or disconnects, the room and its message/media references are discarded.
- A room supports at most two connected people.
- Message history is limited to the latest 100 messages while the room is active.
- Attachments are limited to 20 MB each.

**Important:** "No saving" cannot be guaranteed across the entire internet. The hosting provider may retain infrastructure/network logs, and browsers may cache content or users may take screenshots, download attachments, or copy messages. This app does not intentionally persist chat content, but it is not an end-to-end encrypted or anonymous service. Use HTTPS (Render provides it) and do not use it for sensitive information.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000 in two browser windows. Create a room code in one and enter the same code in the other.

## Publish it on the internet (Render)

1. Create a GitHub account if you do not already have one.
2. Create a new GitHub repository and upload all files in this folder.
3. Sign in to Render and choose **New + → Blueprint**.
4. Connect the GitHub repository. Render reads `render.yaml` and creates the web service.
5. Wait for deployment. Render gives you a public `https://...onrender.com` address.
6. Send that address and the room code (or the copied invite link) to the other person.

The free hosting tier may sleep when idle and can take a little while to wake up. For a reliable always-on chat, choose an always-on hosting plan.

## Operational notes

This is an in-memory, single-process application. Do not run multiple server instances unless you add a shared real-time adapter and shared ephemeral room state. A server restart clears every active room. The application intentionally does not write messages or media to disk.
