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
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
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
    return handleRequest(request, env);
  },
};
