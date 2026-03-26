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

const notificationEmail =
  process.env.ORDER_NOTIFY_EMAIL ||
  process.env.TO_EMAIL ||
  process.env.SMTP_USER;
const fromEmail = process.env.ORDER_FROM_EMAIL || process.env.FROM_EMAIL || process.env.SMTP_USER;

function formatCurrency(value) {
  return (
    Number(value || 0).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

function buildLineSummary(line) {
  return `${line.qty} × ${line.name} (${formatCurrency(line.unitPrice)}) – ${formatCurrency(
    line.total,
  )}`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Nur POST erlaubt" });
  }

  if (!notificationEmail || !fromEmail) {
    console.error("Order endpoint missing notification email configuration");
    return res
      .status(500)
      .json({ error: "Die Bestellung konnte nicht versendet werden" });
  }

  const { customer = {}, lines, total, createdAt } = req.body || {};
  if (
    !customer.name ||
    !customer.email ||
    !Array.isArray(lines) ||
    !lines.length ||
    !total
  ) {
    return res
      .status(400)
      .json({ error: "Name, E-Mail und mindestens ein Produkt werden benötigt" });
  }

  const orderDate = new Date(createdAt || Date.now()).toLocaleString("de-DE");
  const lineSummaries = lines.map(buildLineSummary).join("\n");
  const parentBody = [
    "📦 Neue Bestellung eingegangen",
    `Name: ${customer.name}`,
    `E-Mail: ${customer.email}`,
    `Telefon: ${customer.phone || "nicht angegeben"}`,
    `Hinweis: ${customer.note || "keine"}`,
    `Bestellt am: ${orderDate}`,
    "",
    "Produkte:",
    lineSummaries,
    "",
    `Gesamt: ${formatCurrency(total)}`,
  ].join("\n");

  const customerBody = [
    `Hallo ${customer.name},`,
    "",
    "Danke für deine Bestellung bei Die Basteltrine! Das haben wir erhalten:",
    "",
    lineSummaries,
    "",
    `Gesamt: ${formatCurrency(total)}`,
    "",
    "Wir melden uns bald mit einer Versandbestätigung.",
    "Wenn du Fragen hast, antworte einfach auf diese Mail.",
  ].join("\n");

  try {
    await transporter.sendMail({
      from: fromEmail,
      to: notificationEmail,
      replyTo: customer.email,
      subject: "Neue Bestellung von der Basteltrine",
      text: parentBody,
    });

    await transporter.sendMail({
      from: fromEmail,
      to: customer.email,
      subject: "Bestellbestätigung – Die Basteltrine",
      text: customerBody,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Order mail failed", error);
    return res
      .status(500)
      .json({ error: "Es gab ein Problem beim Versenden der Bestellung" });
  }
};
