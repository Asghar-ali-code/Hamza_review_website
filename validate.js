export const LIMITS = {
  nameMin: 2,
  nameMax: 40,
  messageMin: 10,
  messageMax: 500,
  minDwellMs: 1200,
  cooldownMs: 20000,
};

const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}\p{N}\s.'’.-]{1,39}$/u;

export function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function cleanName(raw) {
  return String(raw ?? "").trim().replace(/\s+/g, " ");
}

function cleanMessage(raw) {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function letterCount(value) {
  return (value.match(/\p{L}/gu) || []).length;
}

function linkCount(value) {
  return (value.match(/https?:\/\/|www\./gi) || []).length;
}

function hasPhoneNumber(value) {
  return /(?:\d[\s().-]?){9,}/.test(value);
}

function isRepeated(value) {
  const compact = value.replace(/\s+/g, "");
  return /^(.)\1{9,}$/u.test(compact);
}

function parseRating(value) {
  if (value === null || value === undefined || value === "") return null;
  return Number(value);
}

export function validateReview(input) {
  const honeypot = input?.honeypot;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { ok: false, spam: true, errors: {}, value: null };
  }

  const name = cleanName(input?.name);
  const message = cleanMessage(input?.message);
  const rating = parseRating(input?.rating);
  const consent = input?.consent === true || input?.consent === "yes" || input?.consent === "on";
  const errors = {};

  if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
    errors.name = "Please enter a name or nickname (2–40 characters).";
  } else if (!NAME_PATTERN.test(name)) {
    errors.name = "Use letters for your name or nickname.";
  } else if (name.includes("@") || hasPhoneNumber(name)) {
    errors.name = "Please use a first name or nickname, not an email or phone number.";
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.rating = "Please choose a star rating from 1 to 5.";
  }

  if (message.length < LIMITS.messageMin || message.length > LIMITS.messageMax) {
    errors.message = "Please write a short note (10–500 characters).";
  } else if (letterCount(message) < 5 || isRepeated(message)) {
    errors.message = "Please write a short note about your visit.";
  } else if (linkCount(message) > 1) {
    errors.message = "Please keep the note personal, with at most one link.";
  } else if (hasPhoneNumber(message)) {
    errors.message = "Please leave out phone numbers and other private details.";
  }

  if (!consent) {
    errors.consent = "Please confirm you are happy for this note to be published.";
  }

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    spam: false,
    errors,
    value: ok ? { name, rating, message } : null,
  };
}

export function submissionGuard({ startedAt, now, lastSubmitAt }) {
  if (typeof startedAt === "number" && now - startedAt < LIMITS.minDwellMs) {
    return "Please take a moment to write your review.";
  }
  if (typeof lastSubmitAt === "number" && now - lastSubmitAt < LIMITS.cooldownMs) {
    return "Please wait a moment before sending another review.";
  }
  return "";
}

export function duplicateKey(value) {
  return `${value.name.trim().toLowerCase()}|${value.rating}|${value.message.trim().toLowerCase()}`;
}
