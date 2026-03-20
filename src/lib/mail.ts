import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendMail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  if (!process.env.SMTP_USER) {
    console.warn("⚠️ SMTP_USER variable not configured. Skipping active email send to:", to);
    console.log("Mock Email Content:", { subject, to });
    return;
  }
  
  try {
    const fromStr = `"${process.env.SMTP_FROM_NAME || "Libe Aios"}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`;
    await transporter.sendMail({
      from: fromStr,
      to,
      subject,
      html,
    });
    console.log(`✉️ Email successfully sent to ${to}: "${subject}"`);
  } catch (error) {
    console.error("❌ Error sending email via SMTP:", error);
  }
};
