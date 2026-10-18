import { firebaseConfig, isFirebaseConfigured, removalEmail } from "./firebase-config.js";
import { LIMITS, duplicateKey, isEmail, submissionGuard, validateReview } from "./validate.js";

const STORAGE_LAST = "mehmaan-last-submit";
const STORAGE_KEY = "mehmaan-last-key";
const AVATAR_COLORS = ["#e4efe8", "#f3e6d4", "#f6e7dc"];

const SAMPLE_REVIEWS = [
  {
    name: "Ali Raza",
    rating: 5,
    message: "Amazing stay. It felt like home, and Hamza is a fantastic host.",
    createdAt: new Date("2025-05-10T12:00:00Z"),
  },
  {
    name: "Sara Khan",
    rating: 5,
    message: "Very clean, cosy, and peaceful. Highly recommended.",
    createdAt: new Date("2025-05-05T12:00:00Z"),
  },
  {
    name: "Usman Ahmed",
    rating: 5,
    message: "Loved the hospitality and the atmosphere. Will visit again.",
    createdAt: new Date("2025-04-28T12:00:00Z"),
  },
];

const startedAt = Date.now();
const preview = new URLSearchParams(location.search).get("preview") === "1";
const configured = isFirebaseConfigured(firebaseConfig);

const form = document.getElementById("review-form");
const submitButton = document.getElementById("submit-review");
const statusEl = document.getElementById("form-status");
const nameInput = document.getElementById("guest-name");
const messageInput = document.getElementById("message");
const messageCount = document.getElementById("message-count");
const ratingChosen = document.getElementById("rating-chosen");
const reviewList = document.getElementById("review-list");
const reviewEmpty = document.getElementById("review-empty");
const reviewSummary = document.getElementById("review-summary");
const reviewError = document.getElementById("review-error");
const reviewErrorText = document.getElementById("review-error-text");
const previewNote = document.getElementById("preview-note");
const setupBanner = document.getElementById("setup-banner");

const fields = {
  name: { input: nameInput, error: document.getElementById("name-error"), describedBy: "name-hint" },
  rating: { input: document.getElementById("rating-field"), error: document.getElementById("rating-error"), describedBy: "rating-hint" },
  message: { input: messageInput, error: document.getElementById("message-error"), describedBy: "message-hint" },
  consent: { input: document.getElementById("consent"), error: document.getElementById("consent-error"), describedBy: "" },
};

let sending = false;
let attempted = false;
let saveReview = null;

nameInput.maxLength = LIMITS.nameMax;
messageInput.maxLength = LIMITS.messageMax;

function readStorage(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Private browsing can block storage. The review can still be sent.
  }
}

function publicUrl() {
  const url = new URL(location.href);
  url.hash = "";
  url.searchParams.delete("preview");
  return url.toString();
}

function renderQr() {
  const url = publicUrl();
  const urlEl = document.getElementById("site-url");
  const hint = document.getElementById("qr-hint");
  urlEl.textContent = url;

  if (location.protocol === "file:") {
    hint.hidden = false;
    hint.textContent = "This code points at a file on your computer. Print the card after the site is on GitHub Pages.";
  } else if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    hint.hidden = false;
    hint.textContent = "This code points at your computer. Print the card after the site is on GitHub Pages.";
  }

  if (typeof qrcode !== "function") return;

  try {
    if (qrcode.stringToBytesFuncs?.["UTF-8"]) {
      qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
    }
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const svgText = qr.createSvgTag({
      cellSize: 4,
      margin: 4,
      scalable: true,
      title: "QR code for this guestbook",
    });
    const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = parsed.documentElement;
    if (svg.querySelector("parsererror")) return;
    svg.setAttribute("aria-hidden", "true");
    const path = svg.querySelector("path");
    if (path) path.setAttribute("fill", "#1a4336");
    const background = svg.querySelector("rect");
    if (background) background.setAttribute("fill", "#fffbf6");
    document.getElementById("qr-frame").replaceChildren(document.importNode(svg, true));
  } catch (error) {
    console.error(error);
  }
}

function renderRemoval() {
  const el = document.getElementById("removal-text");
  if (!isEmail(removalEmail)) return;
  const email = removalEmail.trim();
  const link = document.createElement("a");
  link.href = `mailto:${email}?subject=${encodeURIComponent("Guestbook review removal")}`;
  link.textContent = email;
  el.replaceChildren("To take a review down, ask Hamza or email ", link, ". He can remove it before or after it is published.");
}

function toDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value && typeof value.toDate === "function") {
    const date = value.toDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function initial(name) {
  const char = Array.from(name.trim())[0] || "?";
  return /\p{L}/u.test(char) ? char.toLocaleUpperCase() : char;
}

function avatarColor(name) {
  const total = Array.from(name).reduce((sum, char) => sum + char.codePointAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length];
}

function starNodes(rating) {
  return [1, 2, 3, 4, 5].map((n) => {
    const star = document.createElement("span");
    star.className = n <= rating ? "star-fill" : "star-empty";
    star.textContent = "★";
    return star;
  });
}

function renderReview(review) {
  const article = document.createElement("article");
  article.className = "review";

  const top = document.createElement("div");
  top.className = "review-top";

  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.style.background = avatarColor(review.name);
  avatar.textContent = initial(review.name);

  const identity = document.createElement("div");
  const name = document.createElement("h3");
  name.className = "review-name";
  name.textContent = review.name;

  const stars = document.createElement("p");
  stars.className = "review-stars";
  const safeRating = Math.min(5, Math.max(0, Number(review.rating) || 0));
  stars.setAttribute("aria-label", `${safeRating} out of 5 stars`);
  const visual = document.createElement("span");
  visual.setAttribute("aria-hidden", "true");
  visual.append(...starNodes(safeRating));
  stars.append(visual);

  const time = document.createElement("time");
  time.className = "review-date";
  const date = toDate(review.createdAt);
  time.textContent = date ? formatDate(date) : "Recently";
  if (date) time.dateTime = date.toISOString();

  const message = document.createElement("p");
  message.className = "review-message";
  message.textContent = review.message;

  identity.append(name, stars);
  top.append(avatar, identity, time);
  article.append(top, message);
  return article;
}

function summaryText(count, sample) {
  if (sample) return count === 1 ? "1 sample note" : `${count} sample notes`;
  if (count === 0) return "No notes yet";
  if (count === 1) return "1 note shared";
  return `${count} notes shared`;
}

function renderReviews(reviews, { sample = false } = {}) {
  reviewError.hidden = true;
  reviewList.replaceChildren();
  reviewSummary.textContent = summaryText(reviews.length, sample);
  if (reviews.length === 0) {
    reviewEmpty.hidden = false;
    return;
  }
  reviewEmpty.hidden = true;
  const fragment = document.createDocumentFragment();
  reviews.forEach((review) => fragment.append(renderReview(review)));
  reviewList.append(fragment);
}

function showReviewError(message) {
  reviewEmpty.hidden = true;
  reviewList.replaceChildren();
  reviewSummary.textContent = "Reviews could not be loaded";
  reviewErrorText.textContent = message;
  reviewError.hidden = false;
}

function reviewsErrorMessage(error) {
  const code = String(error?.code || "");
  if (code.includes("failed-precondition")) {
    return "Approved reviews are not ready to list yet. Create the Firestore index for status and createdAt, then refresh. The README explains how.";
  }
  if (code.includes("permission-denied")) {
    return "Reviews could not be read. Publish the Firestore rules from this project, then refresh.";
  }
  if (code.includes("unavailable")) {
    return "Reviews could not be loaded. Check the connection and try again.";
  }
  return "Reviews could not be loaded. Please try again in a moment.";
}

function saveErrorMessage(error) {
  const code = String(error?.code || "");
  if (code.includes("permission-denied")) {
    return "The review could not be saved. Publish the Firestore rules, then try again.";
  }
  if (code.includes("unavailable")) {
    return "The review could not be sent. Check the connection and try again.";
  }
  return "The review could not be sent. Please try again.";
}

function formValues() {
  const data = new FormData(form);
  return {
    name: data.get("name"),
    rating: data.get("rating"),
    message: data.get("message"),
    consent: data.get("consent"),
    honeypot: data.get("fax_number"),
  };
}

function applyFieldErrors(errors) {
  for (const [key, field] of Object.entries(fields)) {
    const message = errors[key] || "";
    field.error.hidden = !message;
    field.error.textContent = message;
    if (message) field.input.setAttribute("aria-invalid", "true");
    else field.input.removeAttribute("aria-invalid");
    const describedBy = [field.describedBy, message ? field.error.id : ""].filter(Boolean).join(" ");
    if (describedBy) field.input.setAttribute("aria-describedby", describedBy);
  }
}

function focusFirstInvalid(errors) {
  const order = ["name", "rating", "message", "consent"];
  const key = order.find((item) => errors[item]);
  if (!key) return;
  const target = key === "rating" ? document.getElementById("star-5") : fields[key].input;
  target.focus();
}

function showStatus(message, kind) {
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.className = `form-status is-${kind}`;
}

function clearStatus() {
  statusEl.hidden = true;
  statusEl.textContent = "";
  statusEl.className = "form-status";
}

function updateRatingChosen() {
  const picked = form.querySelector("input[name='rating']:checked");
  const rating = picked ? Number(picked.value) : 0;
  ratingChosen.textContent = rating === 0 ? "No rating chosen yet" : rating === 1 ? "1 star" : `${rating} stars`;
}

function updateMessageCount() {
  const length = messageInput.value.length;
  messageCount.textContent = `${length} / ${LIMITS.messageMax}`;
  messageCount.classList.toggle("is-low", length > LIMITS.messageMax - 20);
}

function rememberSubmission(value) {
  writeStorage(STORAGE_LAST, String(Date.now()));
  writeStorage(STORAGE_KEY, duplicateKey(value));
}

function finishQuietly() {
  form.reset();
  updateRatingChosen();
  updateMessageCount();
  applyFieldErrors({});
  attempted = false;
  showStatus("Shukriya. Your note is with Hamza now. It will appear here after he has read it.", "success");
  writeStorage(STORAGE_LAST, String(Date.now()));
}

async function connectFirestore(listen) {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js");
  const {
    addDoc,
    collection,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where,
  } = await import("https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js");

  const database = getFirestore(initializeApp(firebaseConfig));
  const reviews = collection(database, "reviews");

  saveReview = (value) => addDoc(reviews, {
    name: value.name,
    rating: value.rating,
    message: value.message,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  if (!listen) return;

  const reviewsQuery = query(reviews, where("status", "==", "approved"), orderBy("createdAt", "desc"));
  onSnapshot(reviewsQuery, (snapshot) => {
    renderReviews(snapshot.docs.map((doc) => doc.data()));
  }, (error) => {
    console.error(error);
    showReviewError(reviewsErrorMessage(error));
  });
}

async function onSubmit(event) {
  event.preventDefault();
  if (sending) return;

  const result = validateReview(formValues());
  if (result.spam) {
    finishQuietly();
    return;
  }

  attempted = true;
  if (!result.ok) {
    applyFieldErrors(result.errors);
    showStatus("Please check the form and try again.", "error");
    focusFirstInvalid(result.errors);
    return;
  }

  applyFieldErrors({});
  const timing = submissionGuard({
    startedAt,
    now: Date.now(),
    lastSubmitAt: Number(readStorage(STORAGE_LAST)) || null,
  });
  if (timing) {
    showStatus(timing, "error");
    return;
  }

  if (readStorage(STORAGE_KEY) === duplicateKey(result.value)) {
    showStatus("This review was already sent from this browser.", "error");
    return;
  }

  if (!configured || typeof saveReview !== "function") {
    showStatus("Reviews cannot be saved yet. The guestbook still needs its Firebase connection.", "error");
    return;
  }

  sending = true;
  submitButton.disabled = true;
  submitButton.textContent = "Sending…";
  try {
    await saveReview(result.value);
    rememberSubmission(result.value);
    form.reset();
    updateRatingChosen();
    updateMessageCount();
    attempted = false;
    showStatus("Shukriya. Your note is with Hamza now. It will appear here after he has read it.", "success");
  } catch (error) {
    console.error(error);
    showStatus(saveErrorMessage(error), "error");
  } finally {
    sending = false;
    submitButton.disabled = false;
    submitButton.textContent = "Submit review";
  }
}

form.addEventListener("submit", onSubmit);
form.addEventListener("change", updateRatingChosen);
form.addEventListener("input", () => {
  updateMessageCount();
  if (statusEl.classList.contains("is-success")) clearStatus();
  if (!attempted) return;
  const result = validateReview(formValues());
  if (result.spam) return;
  applyFieldErrors(result.ok ? {} : result.errors);
  if (result.ok) clearStatus();
});

document.getElementById("print-card").addEventListener("click", () => window.print());
document.getElementById("retry-reviews").addEventListener("click", () => location.reload());

renderQr();
renderRemoval();
updateMessageCount();
updateRatingChosen();

if (preview) {
  previewNote.hidden = false;
  previewNote.textContent = configured
    ? "Sample notes are covering the live list. Remove ?preview=1 to see approved reviews. The form still sends a real review."
    : "These are sample notes so you can see the layout. They are not real reviews.";
  renderReviews(SAMPLE_REVIEWS, { sample: true });
}

if (!configured) {
  setupBanner.hidden = false;
  if (!preview) renderReviews([]);
} else {
  connectFirestore(!preview).catch((error) => {
    console.error(error);
    if (!preview) {
      showReviewError("Reviews could not be loaded. Check the connection and try again.");
    }
    saveReview = null;
  });
}
