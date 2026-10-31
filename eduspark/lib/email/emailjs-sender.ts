/* eslint-disable @typescript-eslint/no-explicit-any */
import emailjs from "@emailjs/nodejs";

export async function sendEmailJS(params: {
  to_email: string;
  to_name: string;
  reset_link: string;
}): Promise<boolean> {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.warn("[EmailJS] Missing environment variables. Email NOT sent.");
    return false;
  }

  try {
    await emailjs.send(serviceId, templateId, params, {
      publicKey,
      privateKey, // Required when "non-browser API access" is enabled
    });
    console.log(`[EmailJS] Email sent successfully to ${params.to_email}`);
    return true;
  } catch (error: any) {
    console.error("[EmailJS] Failed to send email:", {
      status: error?.status,
      text: error?.text,
    });
    return false;
  }
}