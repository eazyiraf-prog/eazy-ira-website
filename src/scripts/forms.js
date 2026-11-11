const forms = document.querySelectorAll("[data-form-endpoint]");

for (const form of forms) {
  form.noValidate = true;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const controls = Array.from(
      form.querySelectorAll("input:not([type=hidden]):not([name=bot-field]), textarea, select"),
    );
    let firstInvalid;

    for (const control of controls) {
      const error = document.getElementById(control.dataset.errorId);
      if (!error) continue;

      error.hidden = true;
      error.textContent = "";
      control.removeAttribute("aria-invalid");

      if (!control.validity.valid) {
        error.textContent = control.validity.valueMissing
          ? control.dataset.requiredError
          : control.validity.typeMismatch
            ? control.dataset.typeError
            : control.dataset.genericError;
        error.hidden = false;
        control.setAttribute("aria-invalid", "true");
        firstInvalid ??= control;
      }
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const submitError = form.querySelector("[data-submit-error]");
    if (submitButton) submitButton.disabled = true;
    if (submitError) submitError.hidden = true;

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams(new FormData(form)),
      });

      if (!response.ok) {
        const result = await response.json();
        if (submitError && typeof result.message === "string") {
          const contactEmail = form.querySelector(
            'input[name="contact-email"]',
          )?.value;
          const emailIndex = contactEmail
            ? result.message.indexOf(contactEmail)
            : -1;

          if (
            emailIndex >= 0 &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
          ) {
            const link = document.createElement("a");
            link.href = `mailto:${contactEmail}`;
            link.textContent = contactEmail;
            submitError.replaceChildren(
              document.createTextNode(result.message.slice(0, emailIndex)),
              link,
              document.createTextNode(
                result.message.slice(emailIndex + contactEmail.length),
              ),
            );
          } else {
            submitError.textContent = result.message;
          }
        }
        throw new Error("Form submission was rejected.");
      }
      window.location.assign("/thank-you");
    } catch {
      if (submitError) submitError.hidden = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}
