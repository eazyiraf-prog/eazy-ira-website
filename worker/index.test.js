import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { handleRequest } from "./index.ts";

const env = {
  PUBLIC_TURNSTILE_SITE_KEY: "local-site-key",
  TURNSTILE_SECRET_KEY: "local-secret",
  RESEND_API_KEY: "mock-email-key",
  EMAIL_FROM: "EAZY-IRA <forms@example.test>",
  NEWSLETTER_TO: "newsletter@example.test",
  CONTACT_TO: "contact@example.test",
  PARTNERSHIP_ENQUIRY_TO: "partnership@example.test",
  VOLUNTEER_APPLICATION_TO: "volunteer@example.test",
  PRAYER_REQUEST_TO: "prayer@example.test",
  PRAYER_PARTNER_TO: "prayer-partner@example.test",
};

function request(formName, values, options = {}) {
  return new Request(`https://foundation.example/api/forms/${formName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: options.accept ?? "application/json",
      "CF-Connecting-IP": options.ip ?? randomUUID(),
    },
    body: new URLSearchParams(values),
  });
}

function dependencies(emailAdapter) {
  return {
    fetcher: async () => Response.json({ success: true }),
    emailAdapter,
  };
}

const validContact = {
  name: "Test Sender",
  email: "sender@example.test",
  subject: "A question",
  message: "Please contact me.",
  consent: "yes",
  "contact-email": "contact@example.test",
  "cf-turnstile-response": "test-token",
};

test("accepts a valid submission through a mock email adapter", async () => {
  let deliveredTo = "";
  const response = await handleRequest(
    request("contact", validContact),
    env,
    dependencies(async (message) => {
      deliveredTo = message.to;
      return true;
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(deliveredTo, env.CONTACT_TO);
  assert.deepEqual(await response.json(), { ok: true });
});

test("rejects a missing required field", async () => {
  const missingMessage = { ...validContact };
  delete missingMessage.message;
  const response = await handleRequest(
    request("contact", missingMessage),
    env,
    dependencies(async () => true),
  );

  assert.equal(response.status, 400);
});

test("rejects a populated honeypot", async () => {
  const response = await handleRequest(
    request("contact", { ...validContact, "bot-field": "spam" }),
    env,
    dependencies(async () => true),
  );

  assert.equal(response.status, 400);
});

test("rejects an oversized message", async () => {
  const response = await handleRequest(
    request("contact", { ...validContact, message: "x".repeat(4001) }),
    env,
    dependencies(async () => true),
  );

  assert.equal(response.status, 400);
});

test("returns 404 for an unknown form name", async () => {
  const response = await handleRequest(
    request("unknown-form", validContact),
    env,
    dependencies(async () => true),
  );

  assert.equal(response.status, 404);
});

test("rejects an unknown field", async () => {
  const response = await handleRequest(
    request("contact", { ...validContact, unexpected: "value" }),
    env,
    dependencies(async () => true),
  );

  assert.equal(response.status, 400);
});

test("redirects a valid native form post with 303", async () => {
  const response = await handleRequest(
    request("contact", validContact, { accept: "text/html" }),
    env,
    dependencies(async () => true),
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("Location"),
    "https://foundation.example/thank-you",
  );
});

test("native submission without Turnstile shows a JavaScript and contact message", async () => {
  const values = { ...validContact };
  delete values["cf-turnstile-response"];
  const response = await handleRequest(
    request("contact", values, { accept: "text/html" }),
    env,
    dependencies(async () => true),
  );

  const body = await response.text();
  assert.equal(response.status, 400);
  assert.match(body, /enable JavaScript to complete the spam check/i);
  assert.match(body, /mailto:contact@example\.test/);
});

test("scripted submission without Turnstile returns a friendly JSON message", async () => {
  const values = { ...validContact };
  delete values["cf-turnstile-response"];
  const response = await handleRequest(
    request("contact", values),
    env,
    dependencies(async () => true),
  );

  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /contact@example\.test/);
});
