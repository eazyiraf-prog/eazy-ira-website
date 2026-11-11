import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { handleOAuthRequest, handleRequest } from "./index.ts";

const env = {
  PUBLIC_SITE_URL: "https://foundation.example",
  PUBLIC_TURNSTILE_SITE_KEY: "local-site-key",
  TURNSTILE_SECRET_KEY: "local-secret",
  RESEND_API_KEY: "mock-email-key",
  GITHUB_OAUTH_CLIENT_ID: "oauth-client-id",
  GITHUB_OAUTH_CLIENT_SECRET: "oauth-client-secret",
  GITHUB_OAUTH_SCOPE: "repo",
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

test("GitHub OAuth rejects a missing state on return", async () => {
  const response = await handleOAuthRequest(
    new Request("https://foundation.example/api/callback?code=one-time-code"),
    env,
  );
  assert.equal(response.status, 400);
});

test("GitHub OAuth rejects a wrong state on return", async () => {
  const response = await handleOAuthRequest(
    new Request("https://foundation.example/api/callback?code=one-time-code&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", {
      headers: {
        Cookie:
          "github_oauth_state=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    }),
    env,
  );
  assert.equal(response.status, 400);
});

test("GitHub OAuth rejects an unknown CMS origin", async () => {
  const response = await handleOAuthRequest(
    new Request(
      "https://foundation.example/api/auth?provider=github&site_id=attacker.example&scope=public_repo",
    ),
    env,
  );
  assert.equal(response.status, 403);
});

test("GitHub OAuth defaults to repo scope and binds the generated state", async () => {
  const response = await handleOAuthRequest(
    new Request(
      "https://foundation.example/api/auth?provider=github&site_id=foundation.example&scope=repo",
    ),
    env,
  );
  const authorizationUrl = new URL(response.headers.get("Location"));
  const cookie = response.headers.get("Set-Cookie");
  const state = authorizationUrl.searchParams.get("state");

  assert.equal(response.status, 302);
  assert.equal(authorizationUrl.searchParams.get("scope"), "repo");
  assert.match(state, /^[0-9a-f]{64}$/);
  assert.ok(cookie.includes(`github_oauth_state=${state}`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
});

test("GitHub OAuth uses repo when GITHUB_OAUTH_SCOPE is unset", async () => {
  const defaultScopeEnv = { ...env, GITHUB_OAUTH_SCOPE: undefined };
  const response = await handleOAuthRequest(
    new Request(
      "https://foundation.example/api/auth?provider=github&site_id=foundation.example&scope=repo",
    ),
    defaultScopeEnv,
  );
  assert.equal(response.status, 302);
  assert.equal(
    new URL(response.headers.get("Location")).searchParams.get("scope"),
    "repo",
  );
});

test("GitHub OAuth allows public_repo only when explicitly configured", async () => {
  const response = await handleOAuthRequest(
    new Request(
      "https://foundation.example/api/auth?provider=github&site_id=foundation.example&scope=public_repo",
    ),
    { ...env, GITHUB_OAUTH_SCOPE: "public_repo" },
  );
  assert.equal(response.status, 302);
  assert.equal(
    new URL(response.headers.get("Location")).searchParams.get("scope"),
    "public_repo",
  );
});

test("GitHub OAuth rejects a scope different from configuration", async () => {
  const response = await handleOAuthRequest(
    new Request(
      "https://foundation.example/api/auth?provider=github&site_id=foundation.example&scope=public_repo",
    ),
    env,
  );
  assert.equal(response.status, 400);
});

test("GitHub OAuth rejects an unsupported configured scope", async () => {
  const response = await handleOAuthRequest(
    new Request(
      "https://foundation.example/api/auth?provider=github&site_id=foundation.example",
    ),
    { ...env, GITHUB_OAUTH_SCOPE: "user" },
  );
  assert.equal(response.status, 500);
});

test("OAuth access tokens are never written to console logs", async () => {
  const state =
    "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
  const token = "github-secret-access-token";
  const logs = [];
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  console.log = (...values) => logs.push(values.join(" "));
  console.info = (...values) => logs.push(values.join(" "));
  console.warn = (...values) => logs.push(values.join(" "));
  console.error = (...values) => logs.push(values.join(" "));
  try {
    const response = await handleOAuthRequest(
      new Request(
        `https://foundation.example/api/callback?code=one-time-code&state=${state}`,
        {
          headers: { Cookie: `github_oauth_state=${state}` },
        },
      ),
      env,
      {
        fetcher: async () => Response.json({ access_token: token }),
      },
    );
    assert.equal(response.status, 200);
    assert.match(await response.text(), new RegExp(token));
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
  }
  assert.equal(logs.some((entry) => entry.includes(token)), false);
});
