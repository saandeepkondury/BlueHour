/**
 * Email through Resend's REST API. Called straight over fetch so the reminder
 * path has no SDK to keep in step, and so a missing key is a quiet no-op rather
 * than a crash at 6 AM.
 */

export interface EmailResult {
  sent: boolean;
  reason?: string;
}

export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { sent: false, reason: "RESEND_API_KEY is not set" };
  if (!message.to) return { sent: false, reason: "no recipient" };

  const from = process.env.REMINDER_FROM?.trim() || "Blue Hour <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { sent: false, reason: `resend ${response.status} ${detail.slice(0, 160)}` };
  }

  return { sent: true };
}
