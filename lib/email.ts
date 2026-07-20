type EmailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendTransactionalEmail(input: EmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.AUTH_EMAIL_FROM ||
    "PulseERP <noreply@pulseerp.fr>";

  if (!apiKey) {
    console.log(
      `[PulseERP email development]\nTo: ${input.to}\nSubject: ${input.subject}\n${input.html}`,
    );
    return { development: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend HTTP ${response.status}`);
  }

  return response.json();
}
