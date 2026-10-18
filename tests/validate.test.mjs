import assert from "node:assert/strict";
import test from "node:test";
import { isFirebaseConfigured } from "../firebase-config.js";
import { duplicateKey, submissionGuard, validateReview } from "../validate.js";

const valid = {
  name: "Sara Khan",
  rating: "5",
  message: "A warm evening and very kind hospitality.",
  consent: "yes",
  honeypot: "",
};

test("accepts a normal review and cleans extra spaces", () => {
  const result = validateReview({ ...valid, name: "  Sara   Khan  " });
  assert.equal(result.ok, true);
  assert.equal(result.value.name, "Sara Khan");
  assert.equal(result.value.rating, 5);
});

test("accepts Urdu names and hyphenated names", () => {
  assert.equal(validateReview({ ...valid, name: "علی رضا" }).ok, true);
  assert.equal(validateReview({ ...valid, name: "Anne-Marie" }).ok, true);
  assert.equal(validateReview({ ...valid, name: "O'Brien" }).ok, true);
});

test("rejects an empty or symbolic name, a missing rating, and a short note", () => {
  const result = validateReview({ name: "!", rating: "", message: "Nice", consent: "yes" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.name);
  assert.ok(result.errors.rating);
  assert.ok(result.errors.message);
});

test("rejects ratings outside 1 to 5 and non-integers", () => {
  assert.equal(validateReview({ ...valid, rating: "0" }).ok, false);
  assert.equal(validateReview({ ...valid, rating: "6" }).ok, false);
  assert.equal(validateReview({ ...valid, rating: "4.5" }).ok, false);
});

test("requires the privacy confirmation", () => {
  const result = validateReview({ ...valid, consent: null });
  assert.equal(result.ok, false);
  assert.ok(result.errors.consent);
});

test("rejects phone numbers, repeated characters, and several links", () => {
  assert.equal(validateReview({ ...valid, message: "Call me on 07123 456789 please" }).ok, false);
  assert.equal(validateReview({ ...valid, message: "aaaaaaaaaa" }).ok, false);
  assert.equal(validateReview({
    ...valid,
    message: "See https://one.test and https://two.test for more.",
  }).ok, false);
});

test("treats a filled honeypot as spam", () => {
  const result = validateReview({ ...valid, honeypot: "http://spam.test" });
  assert.equal(result.spam, true);
  assert.equal(result.ok, false);
  assert.equal(result.value, null);
});

test("asks a very fast submission to wait, then allows it", () => {
  assert.match(submissionGuard({ startedAt: 0, now: 500, lastSubmitAt: null }), /moment/);
  assert.equal(submissionGuard({ startedAt: 0, now: 5000, lastSubmitAt: null }), "");
  assert.match(submissionGuard({ startedAt: 0, now: 5000, lastSubmitAt: 4000 }), /wait/);
});

test("builds a stable duplicate key", () => {
  assert.equal(
    duplicateKey({ name: "Ali ", rating: 5, message: "Hello there friend" }),
    duplicateKey({ name: "ali", rating: 5, message: "Hello there friend" }),
  );
});

test("detects a real Firebase config and ignores the placeholder", () => {
  assert.equal(isFirebaseConfigured(), false);
  assert.equal(isFirebaseConfigured({
    apiKey: "AIzaSyExampleKey123456",
    projectId: "hamzas-flat",
    appId: "1:123456789:web:abcdef",
  }), true);
});
