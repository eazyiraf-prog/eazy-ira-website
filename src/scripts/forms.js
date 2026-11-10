const forms = document.querySelectorAll("[data-netlify-form]");

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
        },
        body: new URLSearchParams(new FormData(form)),
      });

      if (!response.ok) {
        throw new Error(`Form submission failed with status ${response.status}`);
      }
      window.location.assign(form.action);
    } catch (error) {
      console.error("Unable to submit Netlify form.", error);
      if (submitError) submitError.hidden = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}
