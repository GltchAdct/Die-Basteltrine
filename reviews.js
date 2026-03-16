const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const recipient = process.env.TO_EMAIL || process.env.SMTP_USER;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Nur POST erlaubt" });
  }

  const { name, email, text, rating, type, publish } = req.body || {};

  if (!name || !text || !type) {
    return res.status(400).json({ error: "Name, Text und Typ werden benötigt" });
  }

  const subject =
    type === "bug"
      ? "Fehlermeldung von der Website"
      : type === "report"
      ? "Review Report"
      : publish === "published"
      ? "Neue Rezension"
      : "Neue Rezension (moderiert)";

  const messageLines = [
    `Name: ${name}`,
    `E-Mail: ${email || "nicht angegeben"}`,
    `Typ: ${type}`,
    rating ? `Bewertung: ${rating} Sterne` : "Bewertung: nicht angegeben",
    publish ? `Status: ${publish}` : "Status: offen",
    "",
    text,
  ];

  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: recipient,
      replyTo: email || process.env.SMTP_USER,
      subject,
      text: messageLines.join("\n"),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Mail konnte nicht verschickt werden", error);
    return res.status(500).json({ error: "Die Mail konnte nicht verschickt werden" });
  }
};
