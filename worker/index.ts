type FormName =
  | "newsletter"
  | "contact"
  | "partnership-enquiry"
  | "volunteer-application"
  | "prayer-request"
  | "prayer-partner";

type FieldRule = {
  required?: boolean;
  maxLength: number;
  email?: boolean;
  checkbox?: boolean;
  values?: readonly string[];
};

type FormDefinition = {
  recipient: keyof WorkerEnv;
  subject: string;
  fields: Record<string, FieldRule>;
};

type WorkerEnv = {
  PUBLIC_SITE_URL?: string;
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  GITHUB_OAUTH_SCOPE?: string;
  NEWSLETTER_TO?: string;
  CONTACT_TO?: string;
  PARTNERSHIP_ENQUIRY_TO?: string;
  VOLUNTEER_APPLICATION_TO?: string;
  PRAYER_REQUEST_TO?: string;
  PRAYER_PARTNER_TO?: string;
};

type EmailMessage = {
  to: string;
  from: string;
  subject: string;
  text: string;
  replyTo?: string;
};

type EmailAdapter = (message: EmailMessage) => Promise<boolean>;

type Dependencies = {
  fetcher?: typeof fetch;
  emailAdapter?: EmailAdapter;
};

type OAuthDependencies = {
  fetcher?: typeof fetch;
};

const FORMS = {
  newsletter: {
    recipient: "NEWSLETTER_TO",
    subject: "New newsletter signup",
    fields: {
      email: { required: true, maxLength: 254, email: true },
      consent: { required: true, maxLength: 3, checkbox: true },
    },
  },
  contact: {
    recipient: "CONTACT_TO",
    subject: "New contact message",
    fields: {
      name: { required: true, maxLength: 120 },
      email: { required: true, maxLength: 254, email: true },
      phone: { maxLength: 40 },
      subject: { required: true, maxLength: 160 },
      message: { required: true, maxLength: 4000 },
      consent: { required: true, maxLength: 3, checkbox: true },
    },
  },
  "partnership-enquiry": {
    recipient: "PARTNERSHIP_ENQUIRY_TO",
    subject: "New partnership enquiry",
    fields: {
      organisation: { required: true, maxLength: 180 },
      "contact-person": { required: true, maxLength: 120 },
      email: { required: true, maxLength: 254, email: true },
      phone: { maxLength: 40 },
      "partnership-type": {
        required: true,
        maxLength: 20,
        values: ["church", "business", "ngo", "professional"],
      },
      message: { required: true, maxLength: 4000 },
      consent: { required: true, maxLength: 3, checkbox: true },
    },
  },
  "volunteer-application": {
    recipient: "VOLUNTEER_APPLICATION_TO",
    subject: "New volunteer application",
    fields: {
      "full-name": { required: true, maxLength: 120 },
      email: { required: true, maxLength: 254, email: true },
      phone: { required: true, maxLength: 40 },
      "role-interest": {
        required: true,
        maxLength: 40,
        values: [
          "mentors",
          "teachers",
          "cooks-and-meal-helpers",
          "event-helpers",
          "media-and-photography",
          "professional-skills",
        ],
      },
      availability: { required: true, maxLength: 300 },
      message: { required: true, maxLength: 3000 },
      consent: { required: true, maxLength: 3, checkbox: true },
    },
  },
  "prayer-request": {
    recipient: "PRAYER_REQUEST_TO",
    subject: "New prayer request",
    fields: {
      "first-name": { maxLength: 80 },
      request: { required: true, maxLength: 5000 },
      "private-to-prayer-team": { maxLength: 3, checkbox: true },
      email: { maxLength: 254, email: true },
      consent: { required: true, maxLength: 3, checkbox: true },
    },
  },
  "prayer-partner": {
    recipient: "PRAYER_PARTNER_TO",
    subject: "New prayer-partner signup",
    fields: {
      "prayer-partner-opt-in": {
        required: true,
        maxLength: 3,
        checkbox: true,
      },
      email: { maxLength: 254, email: true },
      consent: { required: true, maxLength: 3, checkbox: true },
    },
  },
} satisfies Record<FormName, FormDefinition>;

const TURNSTILE_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_URL = "https://api.resend.com/emails";
const MAX_BODY_BYTES = 16_000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimits = new Map<string, { startedAt: number; count: number }>();

function responseHeaders(): Headers {
  return new Headers({
    "Content-Security-Policy":
      "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-src https://challenges.cloudflare.com https://www.google.com; form-action 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=()",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store",
  });
}

function getConfiguredSiteOrigin(env: WorkerEnv): string | null {
  try {
    const url = new URL(env.PUBLIC_SITE_URL ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function oauthErrorResponse(
  status: number,
  message: string,
  clearStateCookie = false,
): Response {
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy":
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  });
  if (clearStateCookie) {
    headers.append(
      "Set-Cookie",
      "github_oauth_state=; HttpOnly; Max-Age=0; Path=/api; SameSite=Lax; Secure",
    );
  }
  return new Response(message, { status, headers });
}

function oauthCookie(request: Request, name: string): string | null {
  const values = (request.headers.get("Cookie") ?? "")
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(`${name}=`))
    .map((cookie) => cookie.slice(name.length + 1));
  return values.length === 1 ? values[0] : null;
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function safeScriptValue(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

async function oauthBridgeResponse(
  siteOrigin: string,
  status: "success" | "error",
  content: { provider: "github"; token: string } | {
    provider: "github";
    error: string;
    errorCode: string;
  },
): Promise<Response> {
  const serializedContent = safeScriptValue(content);
  const serializedOrigin = safeScriptValue(siteOrigin);
  const script = `(() => {
    const allowedOrigin = ${serializedOrigin};
    const content = ${serializedContent};
    const state = ${safeScriptValue(status)};
    window.addEventListener("message", (event) => {
      if (
        event.origin !== allowedOrigin ||
        event.source !== window.opener ||
        event.data !== "authorizing:github"
      ) return;
      window.opener.postMessage(
        "authorization:github:" + state + ":" + JSON.stringify(content),
        allowedOrigin
      );
    });
    window.opener?.postMessage("authorizing:github", "*");
  })();`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(script),
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(digest)));
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": `default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; script-src 'sha256-${hash}'`,
    "Set-Cookie":
      "github_oauth_state=; HttpOnly; Max-Age=0; Path=/api; SameSite=Lax; Secure",
  });
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>GitHub sign-in</title></head><body><p>Returning to the content editor…</p><script>${script}</script></body></html>`,
    { headers },
  );
}

async function beginGitHubOAuth(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const siteOrigin = getConfiguredSiteOrigin(env);
  if (!siteOrigin || new URL(request.url).origin !== siteOrigin) {
    return oauthErrorResponse(
      503,
      "GitHub sign-in is unavailable until PUBLIC_SITE_URL is configured for this site.",
    );
  }
  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
    return oauthErrorResponse(
      503,
      "GitHub sign-in is not configured. Please contact the site administrator.",
    );
  }

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const siteId = url.searchParams.get("site_id");
  const trustedHost = new URL(siteOrigin).hostname;
  if (
    provider !== "github" ||
    (siteId !== siteOrigin && siteId !== trustedHost)
  ) {
    return oauthErrorResponse(403, "This site is not allowed to start sign-in.");
  }
  const oauthScope = env.GITHUB_OAUTH_SCOPE ?? "repo";
  if (oauthScope !== "repo" && oauthScope !== "public_repo") {
    return oauthErrorResponse(
      500,
      "GitHub sign-in has an invalid OAuth scope configuration.",
    );
  }
  const requestedScope = url.searchParams.get("scope");
  if (requestedScope && requestedScope !== oauthScope) {
    return oauthErrorResponse(
      400,
      "The requested GitHub permission does not match the configured scope.",
    );
  }

  const state = randomState();
  const authorizationUrl = new URL(
    "https://github.com/login/oauth/authorize",
  );
  authorizationUrl.search = new URLSearchParams({
    client_id: env.GITHUB_OAUTH_CLIENT_ID,
    scope: oauthScope,
    state,
  }).toString();

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizationUrl.toString(),
      "Cache-Control": "no-store",
      "Set-Cookie":
        `github_oauth_state=${state}; HttpOnly; Max-Age=600; Path=/api; SameSite=Lax; Secure`,
    },
  });
}

async function completeGitHubOAuth(
  request: Request,
  env: WorkerEnv,
  dependencies: OAuthDependencies,
): Promise<Response> {
  const siteOrigin = getConfiguredSiteOrigin(env);
  if (!siteOrigin || new URL(request.url).origin !== siteOrigin) {
    return oauthErrorResponse(
      503,
      "GitHub sign-in is unavailable until PUBLIC_SITE_URL is configured for this site.",
      true,
    );
  }

  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const cookieState = oauthCookie(request, "github_oauth_state");
  if (
    !state ||
    !/^[0-9a-f]{64}$/.test(state) ||
    !cookieState ||
    state !== cookieState
  ) {
    return oauthErrorResponse(
      400,
      "GitHub sign-in could not verify this login request. Close this window and try again.",
      true,
    );
  }
  if (url.searchParams.has("error")) {
    return oauthBridgeResponse(siteOrigin, "error", {
      provider: "github",
      error: "GitHub sign-in was not completed.",
      errorCode: "AUTH_CODE_REQUEST_FAILED",
    });
  }

  const code = url.searchParams.get("code");
  if (
    !code ||
    code.length > 2048 ||
    !env.GITHUB_OAUTH_CLIENT_ID ||
    !env.GITHUB_OAUTH_CLIENT_SECRET
  ) {
    return oauthBridgeResponse(siteOrigin, "error", {
      provider: "github",
      error: "GitHub sign-in could not be completed. Please try again.",
      errorCode: "MISCONFIGURED_CLIENT",
    });
  }

  let token: unknown;
  try {
    const response = await (dependencies.fetcher ?? fetch)(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_OAUTH_CLIENT_ID,
          client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
          code,
        }),
      },
    );
    if (!response.ok) {
      return oauthBridgeResponse(siteOrigin, "error", {
        provider: "github",
        error: "GitHub sign-in could not be completed. Please try again.",
        errorCode: "TOKEN_REQUEST_FAILED",
      });
    }
    const result: unknown = await response.json();
    token =
      typeof result === "object" && result !== null && "access_token" in result
        ? result.access_token
        : null;
  } catch {
    return oauthBridgeResponse(siteOrigin, "error", {
      provider: "github",
      error: "GitHub sign-in could not be completed. Please try again.",
      errorCode: "TOKEN_REQUEST_FAILED",
    });
  }

  if (typeof token !== "string" || !token) {
    return oauthBridgeResponse(siteOrigin, "error", {
      provider: "github",
      error: "GitHub sign-in could not be completed. Please try again.",
      errorCode: "TOKEN_REQUEST_FAILED",
    });
  }
  return oauthBridgeResponse(siteOrigin, "success", {
    provider: "github",
    token,
  });
}

export async function handleOAuthRequest(
  request: Request,
  env: WorkerEnv,
  dependencies: OAuthDependencies = {},
): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (request.method !== "GET") {
    return oauthErrorResponse(405, "GitHub sign-in only accepts GET requests.");
  }
  if (pathname === "/api/auth") return beginGitHubOAuth(request, env);
  if (pathname === "/api/callback") {
    return completeGitHubOAuth(request, env, dependencies);
  }
  return oauthErrorResponse(404, "The requested sign-in route was not found.");
}

function jsonResponse(
  status: number,
  body: { ok: false; message: string } | { ok: true },
): Response {
  const headers = responseHeaders();
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function failure(
  request: Request,
  status: number,
  message: string,
  needsJavaScript = false,
  contactEmail = "[to be confirmed]",
): Response {
  if (request.headers.get("Accept")?.includes("application/json")) {
    const formMessage = needsJavaScript
      ? `${message} This form needs JavaScript to complete the spam check. You can also email us at ${contactEmail}.`
      : message;
    return jsonResponse(status, { ok: false, message: formMessage });
  }

  const headers = responseHeaders();
  headers.set("Content-Type", "text/html; charset=utf-8");
  const supportContact =
    contactEmail.startsWith("[") && contactEmail.endsWith("]")
      ? escapeHtml(contactEmail)
      : `<a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>`;
  const followUp = needsJavaScript
    ? `Please enable JavaScript to complete the spam check and try again. If you need help, email ${supportContact}.`
    : "Please go back, correct the form, and try again.";
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Form not sent</title><main><h1>Form not sent</h1><p>${escapeHtml(message)}</p><p>${followUp}</p><p><a href="/contact">Return to the contact form</a></p></main></html>`,
    { status, headers },
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function isFormName(value: string): value is FormName {
  return Object.hasOwn(FORMS, value);
}

function isRateLimited(ip: string, now: number): boolean {
  for (const [key, entry] of rateLimits) {
    if (now - entry.startedAt >= RATE_LIMIT_WINDOW_MS) {
      rateLimits.delete(key);
    }
  }

  const current = rateLimits.get(ip);
  if (current && now - current.startedAt < RATE_LIMIT_WINDOW_MS) {
    if (current.count >= RATE_LIMIT_MAX) return true;
    current.count += 1;
    return false;
  }

  if (rateLimits.size >= 5000) return true;
  rateLimits.set(ip, { startedAt: now, count: 1 });
  return false;
}

async function readFormFields(
  request: Request,
): Promise<Record<string, string> | null> {
  const contentType = request.headers
    .get("Content-Type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") return null;

  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return null;
  }

  const reader = request.body?.getReader();
  if (!reader) return {};

  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const fields: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(
    new TextDecoder().decode(body),
  )) {
    if (Object.hasOwn(fields, key)) return null;
    fields[key] = value;
  }
  return fields;
}

function validateFields(
  form: FormDefinition,
  values: Record<string, string>,
): string | null {
  const allowedFields = new Set([
    ...Object.keys(form.fields),
    "bot-field",
    "cf-turnstile-response",
    "contact-email",
  ]);
  if (Object.keys(values).some((key) => !allowedFields.has(key))) {
    return "This form contains an unexpected field. Please reload the page and try again.";
  }

  if (values["bot-field"]?.trim()) {
    return "We could not accept this submission. Please try again.";
  }

  for (const [name, rule] of Object.entries(form.fields)) {
    const value = values[name]?.trim();
    if (!value) {
      if (rule.required) return "Please complete all required fields.";
      continue;
    }
    if (value.length > rule.maxLength) {
      return "One of your answers is too long. Please shorten it and try again.";
    }
    if (rule.checkbox && value !== "yes") {
      return "Please check the required consent boxes and try again.";
    }
    if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "Please enter a valid email address.";
    }
    if (rule.values && !rule.values.includes(value)) {
      return "Please choose one of the available options.";
    }
  }

  const token = values["cf-turnstile-response"];
  if (!token || token.length > 2048) {
    return "Please complete the spam check and try again.";
  }
  return null;
}

async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string,
  fetcher: typeof fetch,
): Promise<boolean> {
  try {
    const response = await fetcher(TURNSTILE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    if (!response.ok) return false;
    const result: unknown = await response.json();
    return (
      typeof result === "object" &&
      result !== null &&
      "success" in result &&
      result.success === true
    );
  } catch {
    return false;
  }
}

function createResendAdapter(
  apiKey: string | undefined,
  fetcher: typeof fetch,
): EmailAdapter {
  return async (message) => {
    if (!apiKey) return false;
    try {
      const response = await fetcher(RESEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  };
}

function makeEmailText(values: Record<string, string>): string {
  return Object.entries(values)
    .filter(
      ([name]) =>
        name !== "consent" &&
        name !== "bot-field" &&
        name !== "cf-turnstile-response" &&
        name !== "contact-email",
    )
    .map(([name, value]) => `${name}: ${value.trim()}`)
    .join("\n");
}

export async function handleRequest(
  request: Request,
  env: WorkerEnv,
  dependencies: Dependencies = {},
): Promise<Response> {
  const match = /^\/api\/forms\/([^/]+)$/.exec(
    new URL(request.url).pathname,
  );
  if (!match || !isFormName(match[1])) {
    return failure(request, 404, "The requested form was not found.");
  }
  if (request.method !== "POST") {
    const response = failure(
      request,
      405,
      "This form only accepts submissions.",
    );
    response.headers.set("Allow", "POST");
    return response;
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (isRateLimited(ip, Date.now())) {
    return failure(
      request,
      429,
      "Too many submissions. Please wait a few minutes and try again.",
    );
  }

  const fields = await readFormFields(request);
  if (!fields) {
    return failure(
      request,
      413,
      "This submission is too large or could not be read. Please shorten it and try again.",
    );
  }

  const definition = FORMS[match[1]];
  const turnstileToken = fields["cf-turnstile-response"];
  if (!turnstileToken) {
    return failure(
      request,
      400,
      "Your form was not sent because the spam check was not completed.",
      true,
      fields["contact-email"] || "[to be confirmed]",
    );
  }
  const fieldError = validateFields(definition, fields);
  if (fieldError) {
    return failure(request, 400, fieldError);
  }

  const recipient = env[definition.recipient];
  if (
    !recipient ||
    !env.EMAIL_FROM ||
    !env.PUBLIC_TURNSTILE_SITE_KEY ||
    !env.TURNSTILE_SECRET_KEY ||
    !env.RESEND_API_KEY
  ) {
    return failure(
      request,
      503,
      "The form is temporarily unavailable. Please try again later.",
    );
  }

  const fetcher = dependencies.fetcher ?? fetch;
  const token = fields["cf-turnstile-response"];
  if (
    !(await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, ip, fetcher))
  ) {
    return failure(
      request,
      400,
      "The spam check could not be verified. Please try again.",
    );
  }

  const email = fields.email?.trim();
  const emailAdapter =
    dependencies.emailAdapter ??
    createResendAdapter(env.RESEND_API_KEY, fetcher);
  let sent: boolean;
  try {
    sent = await emailAdapter({
      to: recipient,
      from: env.EMAIL_FROM,
      subject: definition.subject,
      text: makeEmailText(fields),
      ...(email ? { replyTo: email } : {}),
    });
  } catch {
    return failure(
      request,
      503,
      "We could not send your submission right now. Please try again later.",
    );
  }
  if (!sent) {
    return failure(
      request,
      503,
      "We could not send your submission right now. Please try again later.",
    );
  }

  if (!request.headers.get("Accept")?.includes("application/json")) {
    const headers = responseHeaders();
    headers.set("Location", new URL("/thank-you", request.url).toString());
    return new Response(null, { status: 303, headers });
  }
  return jsonResponse(200, { ok: true });
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/auth" || pathname === "/api/callback") {
      return handleOAuthRequest(request, env);
    }
    return handleRequest(request, env);
  },
};
