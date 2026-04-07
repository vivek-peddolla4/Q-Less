const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');

const sendgridApiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.FROM_EMAIL;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_FROM_PHONE;

if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
}

let twilioClient;
if (twilioAccountSid && twilioAuthToken) {
  twilioClient = twilio(twilioAccountSid, twilioAuthToken);
}

async function sendEmail(to, subject, text, html) {
  if (!sendgridApiKey || !fromEmail) return;

  const msg = {
    to,
    from: fromEmail,
    subject,
    text,
    html: html || text,
  };

  try {
    await sgMail.send(msg);
  } catch (err) {
    console.error('SendGrid error:', err.response?.body || err.message);
  }
}

async function sendSMS(to, body) {
  if (!twilioClient || !twilioFrom) return;

  try {
    await twilioClient.messages.create({
      body,
      from: twilioFrom,
      to,
    });
  } catch (err) {
    console.error('Twilio error:', err.message);
  }
}

module.exports = { sendEmail, sendSMS };
