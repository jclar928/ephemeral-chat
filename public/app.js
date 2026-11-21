const socket = io();
const $ = (id) => document.getElementById(id);
const entry = $("entry"), chat = $("chat");
let roomCode = "", myName = "", selectedFile = null, joined = false;

function showError(id, message) { $(id).textContent = message || ""; }
function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)];
  $("code").value = result;
}
makeCode();
$("generate").addEventListener("click", makeCode);

function enterRoom() {
  roomCode = $("code").value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  myName = $("name").value.trim().slice(0, 24) || "Guest";
  showError("entry-error", "");
  socket.emit("join-room", { code: roomCode, name: myName }, (result) => {
    if (!result || !result.ok) return showError("entry-error", result?.error || "Could not join room.");
    joined = true;
    roomCode = result.code;
    $("room-label").textContent = roomCode;
    $("room-title").textContent = "Your conversation";
    entry.classList.add("hidden");
    chat.classList.remove("hidden");
    $("messages").innerHTML = "";
    if (!result.history.length) showEmpty();
    result.history.forEach(addMessage);
    updatePresence(result.people);
    history.replaceState(null, "", `?room=${encodeURIComponent(roomCode)}`);
  });
}
$("join").addEventListener("click", enterRoom);
$("code").addEventListener("keydown", e => { if (e.key === "Enter") enterRoom(); });
$("name").addEventListener("keydown", e => { if (e.key === "Enter") enterRoom(); });

function showEmpty() {
  $("messages").innerHTML = '<div class="empty" id="empty">Your conversation starts here.<br><span>Share the room code to invite one person.</span></div>';
}
function updatePresence(count) {
  $("people").textContent = count === 2 ? "Both people are here" : "Waiting for the other person…";
}
socket.on("presence", data => updatePresence(data.people));
socket.on("system-message", text => {
  const el = document.createElement("div");
  el.className = "system";
  el.textContent = text;
  $("messages").appendChild(el);
  scrollDown();
});
socket.on("new-message", addMessage);

function addMessage(msg) {
  const empty = $("empty");
  if (empty) empty.remove();
  const wrap = document.createElement("article");
  wrap.className = "bubble" + (msg.sender === myName ? " mine" : "");
  const sender = document.createElement("div");
  sender.className = "sender";
  sender.textContent = msg.sender;
  wrap.appendChild(sender);

  if (msg.text) {
    const body = document.createElement("div");
    body.className = "body";
    body.textContent = msg.text;
    wrap.appendChild(body);
  }
  if (msg.media) {
    const media = msg.media;
    let element;
    if (media.mime.startsWith("video/")) {
      element = document.createElement("video");
      element.controls = true;
      element.playsInline = true;
    } else {
      element = document.createElement("img");
      element.alt = media.name || "Shared image";
      element.loading = "lazy";
    }
    element.src = media.data;
    wrap.appendChild(element);
  }
  const time = document.createElement("div");
  time.className = "time";
  time.textContent = new Date(msg.time).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  wrap.appendChild(time);
  $("messages").appendChild(wrap);
  scrollDown();
}
function scrollDown() { $("messages").scrollTop = $("messages").scrollHeight; }

$("file").addEventListener("change", async (event) => {
  selectedFile = event.target.files[0] || null;
  showError("chat-error", "");
  if (!selectedFile) { $("typing-file").classList.add("hidden"); return; }
  if (!(selectedFile.type.startsWith("image/") || selectedFile.type.startsWith("video/"))) {
    selectedFile = null; event.target.value = "";
    return showError("chat-error", "Please choose an image, GIF or video.");
  }
  if (selectedFile.size > 20 * 1024 * 1024) {
    selectedFile = null; event.target.value = "";
    return showError("chat-error", "Media files must be 20 MB or smaller.");
  }
  $("typing-file").textContent = `Attached: ${selectedFile.name} · click + to change`;
  $("typing-file").classList.remove("hidden");
});

$("composer").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!joined) return;
  const text = $("message").value.trim();
  if (!text && !selectedFile) return;
  showError("chat-error", "");
  const sendButton = document.querySelector(".send");
  sendButton.disabled = true;

  try {
    let media = null;
    if (selectedFile) {
      const data = await readAsDataURL(selectedFile);
      media = { name: selectedFile.name, mime: selectedFile.type, data };
    }
    socket.emit("chat-message", { text, media }, (result) => {
      sendButton.disabled = false;
      if (!result?.ok) return showError("chat-error", result?.error || "Message could not be sent.");
      $("message").value = "";
      $("file").value = "";
      selectedFile = null;
      $("typing-file").classList.add("hidden");
    });
  } catch {
    sendButton.disabled = false;
    showError("chat-error", "Could not read that attachment.");
  }
});
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

$("copy").addEventListener("click", async () => {
  const url = `${location.origin}/?room=${encodeURIComponent(roomCode)}`;
  try {
    await navigator.clipboard.writeText(`Join my chat room ${roomCode}: ${url}`);
    $("copy").textContent = "Copied!";
    setTimeout(() => $("copy").textContent = "Copy invite", 1600);
  } catch {
    $("copy").textContent = roomCode;
  }
});
$("leave").addEventListener("click", () => {
  if (!joined) return;
  socket.emit("leave-room");
  joined = false;
  selectedFile = null;
  $("messages").innerHTML = "";
  chat.classList.add("hidden");
  entry.classList.remove("hidden");
  $("file").value = "";
  $("message").value = "";
  $("typing-file").classList.add("hidden");
  showError("entry-error", "You left the room. It will be cleared when the other person leaves too.");
  history.replaceState(null, "", "/");
});

// A room in the URL is prefilled, but the visitor still chooses a display name and joins.
const params = new URLSearchParams(location.search);
if (params.get("room")) $("code").value = params.get("room").toUpperCase().slice(0, 8);
window.addEventListener("beforeunload", () => {
  if (joined) socket.emit("leave-room");
});
