// routes/sms.js
const express = require('express');
const axios = require('axios');
const SMS = require('../models/SMS');
const Session = require('../models/Session');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { Types: { ObjectId } } = require('mongoose');

const router = express.Router();

const BOOKING_LINK = process.env.FRONTEND_URL || 'http://localhost:5173';

// numeric system/sender numbers (so DB shows actual numbers)
const SENDER_NUMBER = (process.env.SMS_SENDER_NUMBER || process.env.SMS_SYSTEM_NUMBER || '0000000000').toString().replace(/\D/g, '');
const SYSTEM_NUMBER = (process.env.SMS_SYSTEM_NUMBER || SENDER_NUMBER || '0000000000').toString().replace(/\D/g, '');

const SENSOR_API_BASE_URL = (process.env.SENSOR_API_BASE_URL || 'https://connect.sensorequation.com').replace(/\/+$/, '');
const SENSOR_API_KEY = process.env.SENSOR_API_KEY || '';
const SENSOR_API_DEFAULT_DEVICES = process.env.SENSOR_API_DEFAULT_DEVICES || '3';
const SENDSMS_MAX_RETRIES = parseInt(process.env.SENDSMS_MAX_RETRIES || '3', 10);
const SENDSMS_BASE_DELAY_MS = parseInt(process.env.SENDSMS_BASE_DELAY_MS || '800', 10);
const SENDSMS_TIMEOUT_MS = parseInt(process.env.SENDSMS_TIMEOUT_MS || '15000', 10);

// Allow preflight on webhook
router.options('/webhook', (req, res) => {
  res.setHeader('Allow', 'OPTIONS,POST');
  return res.sendStatus(200);
});

const SERVICES = [
  'plumbing','drain cleaning','water heater','geyser','pipe repair',
  'pipe replacement','bathroom fitting','installation','electrical','other'
];

function cleanText(text) { if (!text || typeof text !== 'string') return ''; return text.trim(); }
function includesAny(text, words) { const t = (text || '').toLowerCase(); return words.some(w => t.includes(w)); }
function detectService(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('plumb')) return 'Plumbing';
  if (t.includes('drain')) return 'Drain cleaning';
  if (t.includes('geyser') || t.includes('water heater')) return 'Water heater';
  if (t.includes('pipe') && (t.includes('repair') || t.includes('replace') || t.includes('replacement'))) return 'Pipe repair / replacement';
  if (t.includes('bath') || t.includes('bathroom') || t.includes('fitting')) return 'Bathroom fitting / installation';
  if (t.includes('electr') || t.includes('socket') || t.includes('switch')) return 'Electrical (minor)';
  if (t.includes('other')) return 'Other';
  for (const s of SERVICES) if (t.includes(s)) return capitalizeService(s);
  return null;
}
function capitalizeService(s) {
  if (!s) return s;
  if (s === 'water heater') return 'Water heater / geyser';
  if (s === 'pipe repair') return 'Pipe repair / replacement';
  if (s === 'bathroom fitting') return 'Bathroom fitting / installation';
  if (s === 'installation') return 'Bathroom fitting / installation';
  if (s === 'plumbing') return 'Plumbing';
  if (s === 'drain cleaning') return 'Drain cleaning';
  if (s === 'electrical') return 'Electrical (minor)';
  if (s === 'other') return 'Other';
  return s[0].toUpperCase() + s.slice(1);
}

async function getOrCreateSession(phone) {
  const sessionId = new ObjectId().toString();
  let session = await Session.findOne({ phone });
  if (!session) {
    session = new Session({ phone, sessionId, state: 'new' });
    await session.save();
    return session;
  }
  if (!session.sessionId) {
    session.sessionId = sessionId;
    await session.save();
  }
  return session;
}

async function saveOutgoing(phone, text, options = {}) {
  const out = new SMS({
    from: SENDER_NUMBER,
    to: options.sendTo || phone,
    message: text,
    type: 'sent',
    status: options.initialStatus || 'pending',
    messageId: options.messageId || `auto_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    replyTo: options.replyTo || null,
    webhookData: options.webhookData || undefined,
    deviceId: options.deviceId || undefined,
    smsApiResult: options.smsApiResult || undefined
  });
  await out.save();
  return out;
}

function extractPhoneDigits(text) {
  if (!text || typeof text !== 'string') return null;
  const digits = (text.match(/\d+/g) || []).join('');
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

function makeGuestId() {
  return `guest_${new ObjectId().toString().slice(-8)}`;
}

async function reassignSmsFrom(oldFrom, newFrom) {
  try {
    const res = await SMS.updateMany({ from: oldFrom }, { $set: { from: newFrom } });
    return res;
  } catch (e) {
    console.warn('reassignSmsFrom failed', e);
    return null;
  }
}

function generateBookingLink(phone, sessionId) {
  const encodedPhone = encodeURIComponent(phone);
  const encodedSession = encodeURIComponent(sessionId);
  return `${BOOKING_LINK}/book-service?phone=${encodedPhone}&session=${encodedSession}&ref=sms`;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function normalizeToDigits(v) {
  if (!v && v !== 0) return '';
  return String(v).replace(/\D/g, '');
}
function isValidPhoneDigits(digits) {
  return !!(digits && digits.length >= 10 && digits.length <= 15);
}

/**
 * sendSMS
 * - Attempts GET then POST per attempt
 * - Each attempt record includes the request details (url/body) and response/error
 * - Returns { success, messageId, raw, attempts }
 */
async function sendSMS(to, message, devices = null) {
  const cleanTo = normalizeToDigits(to);
  if (!isValidPhoneDigits(cleanTo)) {
    return { success: false, error: 'Invalid destination phone number', attempts: [] };
  }

  const devicesParam = devices ? String(devices) : SENSOR_API_DEFAULT_DEVICES;
  const safeMessage = String(message || '');

  const attempts = [];

  for (let attempt = 1; attempt <= SENDSMS_MAX_RETRIES; ++attempt) {
    const delayMs = SENDSMS_BASE_DELAY_MS * (attempt - 1);
    if (delayMs > 0) await sleep(delayMs);

    const url = `${SENSOR_API_BASE_URL}/services/send-message.php` +
      `?key=${encodeURIComponent(SENSOR_API_KEY)}` +
      `&number=${encodeURIComponent(cleanTo)}` +
      `&message=${encodeURIComponent(safeMessage)}` +
      `&devices=${encodeURIComponent(devicesParam)}` +
      `&type=sms&prioritize=1`;

    try {
      const resp = await axios.get(url, { timeout: SENDSMS_TIMEOUT_MS });
      const data = resp.data || {};
      const successFlag = (typeof data.success !== 'undefined') ? data.success : true;
      const messageId = data.messageId || data.id || (data.data && data.data.messages && data.data.messages[0] && data.data.messages[0].ID) || `sent_${Date.now()}`;

      attempts.push({
        attempt, method: 'GET', url, status: resp.status, data
      });

      if (successFlag) {
        return { success: true, messageId, raw: data, attemptCount: attempt, method: 'GET', attempts };
      }
    } catch (err) {
      attempts.push({
        attempt, method: 'GET', url,
        error: err.message,
        code: err.code || null,
        response: err.response && err.response.data ? err.response.data : null
      });
    }

    // POST fallback (form-encoded)
    const postUrl = `${SENSOR_API_BASE_URL}/services/send-message.php`;
    const params = new URLSearchParams();
    params.append('key', SENSOR_API_KEY);
    params.append('number', cleanTo);
    params.append('message', safeMessage);
    params.append('devices', devicesParam);
    params.append('type', 'sms');
    params.append('prioritize', '1');

    try {
      const respPost = await axios.post(postUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: SENDSMS_TIMEOUT_MS
      });

      const pdata = respPost.data || {};
      const successFlagPost = (typeof pdata.success !== 'undefined') ? pdata.success : true;
      const messageIdPost = pdata.messageId || pdata.id || (pdata.data && pdata.data.messages && pdata.data.messages[0] && pdata.data.messages[0].ID) || `sent_${Date.now()}`;

      attempts.push({
        attempt, method: 'POST', url: postUrl, requestBodyPreview: params.toString().slice(0, 1000), status: respPost.status, data: pdata
      });

      if (successFlagPost) {
        return { success: true, messageId: messageIdPost, raw: pdata, attemptCount: attempt, method: 'POST', attempts };
      }
    } catch (errPost) {
      attempts.push({
        attempt, method: 'POST', url: postUrl,
        requestBodyPreview: params.toString().slice(0, 1000),
        error: errPost.message,
        code: errPost.code || null,
        response: errPost.response && errPost.response.data ? errPost.response.data : null
      });
    }
  }

  return { success: false, error: 'All send attempts failed', attempts };
}

// runSend: background worker to call sendSMS and update outgoing doc with full attempts
async function runSend(outgoingId, to, message, devices) {
  try {
    const cleanTo = normalizeToDigits(to);
    if (!isValidPhoneDigits(cleanTo)) {
      const smsApiResult = { error: 'Invalid destination phone number; not attempting gateway send', dest: to };
      await SMS.findByIdAndUpdate(outgoingId, { $set: { smsApiResult, status: 'failed' } }, { new: true });
      return;
    }

    const result = await sendSMS(cleanTo, message, devices);
    const update = {
      smsApiResult: result,
      status: result.success ? 'sent' : 'failed'
    };
    if (result && result.messageId) update.messageId = result.messageId;

    await SMS.findByIdAndUpdate(outgoingId, { $set: update }, { new: true });
  } catch (err) {
    console.error('runSend failed:', err && err.message ? err.message : err);
    try {
      await SMS.findByIdAndUpdate(outgoingId, { $set: { smsApiResult: { error: String(err) }, status: 'failed' } });
    } catch (e) {
      console.warn('Failed to mark outgoing as failed after runSend error', e);
    }
  }
}

/**
 * Important flow comments:
 * 1) Phone sends SMS -> it first reaches the SMS provider/gateway (connect.sensorequation.com).
 * 2) The provider then forwards that message as a webhook POST to our /api/sms/webhook.
 * 3) Our webhook saves the incoming SMS (type: 'received') including provider payload in webhookData.
 * 4) We generate a reply, save an outgoing SMS doc (type: 'sent', status: 'pending'), link outgoing -> incoming.
 * 5) We call the provider/gateway API (connect.sensorequation.com/services/send-message.php) to send the reply.
 * 6) Provider delivers the reply to the user's phone.
 * 7) We store the gateway request/response attempts in outgoing.smsApiResult for full traceability.
 */

// --- webhook endpoint ---
router.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', JSON.stringify(req.body, null, 2));

    let messages = [];
    if (Array.isArray(req.body)) {
      messages = req.body;
    } else if (req.body.message && (req.body.number || req.body.phone)) {
      messages = [{ message: req.body.message, number: req.body.phone || req.body.number, ...req.body }];
    } else if (req.body.message && req.body.sender) {
      messages = [{ message: req.body.message, number: req.body.sender, ...req.body }];
    } else {
      return res.status(400).json({ success: false, error: 'Invalid webhook payload format' });
    }

    const results = [];

    for (const msgData of messages) {
      try {
        const message = msgData.message;
        // provider field variations
        const rawPhoneCandidate = msgData.number || msgData.phone || msgData.from || msgData.sender || null;

        if (!message) {
          results.push({ success: false, error: 'Message field is required', msgData });
          continue;
        }

        const cleanMsg = cleanText(message);
        const lower = cleanMsg.toLowerCase();

        let normalizedPhone = rawPhoneCandidate ? normalizeToDigits(rawPhoneCandidate) : null;
        if (!normalizedPhone || normalizedPhone.length === 0) {
          normalizedPhone = makeGuestId();
        }

        const from = normalizedPhone;
        const to = SYSTEM_NUMBER; // our numeric system number (so DB shows phone numbers)

        // 1) Save incoming message as document (this captures provider webhook data)
        const smsDoc = new SMS({
          from,
          to,
          message: cleanMsg,
          type: 'received',
          status: 'received',
          messageId: msgData.ID ? `recv_${msgData.ID}` : `recv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          deviceId: msgData.deviceID,
          webhookData: msgData
        });
        await smsDoc.save();

        // 2) session & dialog handling (decide replyText)
        let session = await getOrCreateSession(from);
        let replyText = null;
        let sendTarget = null; // numeric phone we'll actually attempt to send to (if available)

        // prefer raw numeric provider number for sending replies when available
        if (rawPhoneCandidate && isValidPhoneDigits(normalizeToDigits(rawPhoneCandidate))) {
          sendTarget = normalizeToDigits(rawPhoneCandidate);
        } else if (session && session.phone && isValidPhoneDigits(normalizeToDigits(session.phone))) {
          sendTarget = normalizeToDigits(session.phone);
        } else {
          sendTarget = null; // we'll avoid trying to send to a non-numeric guest id
        }

        // (dialog rules — same as before)
        if (session.phone && String(session.phone).startsWith('guest_') && session.state !== 'awaiting_phone') {
          session.state = 'awaiting_phone';
          await session.save();

          replyText = "Hi! I'm your PlumbPro assistant. To help you book a service, please reply with your phone number (e.g., 9123456789) so I can create a personalized booking link for you.";

          // create outgoing doc and link it to incoming
          const outgoing = await saveOutgoing(session.phone, replyText, {
            replyTo: smsDoc._id,
            webhookData: msgData,
            deviceId: msgData.deviceID || SENSOR_API_DEFAULT_DEVICES,
            sendTo: sendTarget || session.phone,
            initialStatus: sendTarget ? 'pending' : 'pending'
          });

          // only attempt to send if we have a numeric destination
          if (sendTarget) {
            setImmediate(() => runSend(outgoing._id, sendTarget, replyText, msgData.deviceID || SENSOR_API_DEFAULT_DEVICES));
          } else {
            // mark smsApiResult to indicate no numeric destination available
            await SMS.findByIdAndUpdate(outgoing._id, { $set: { smsApiResult: { note: 'awaiting numeric phone from user' } } });
          }

          // link reply
          try { await SMS.updateOne({ _id: smsDoc._id }, { $push: { replies: outgoing._id } }); } catch (e) { console.warn('Failed to push reply id', e); }

          results.push({ success: true, message: 'SMS received and processed (awaiting phone)', data: { incomingId: smsDoc._id, outgoingId: outgoing._id, reply: replyText } });
          continue;
        }

        if (session.state === 'awaiting_phone') {
          const possiblePhone = extractPhoneDigits(cleanMsg);
          if (possiblePhone) {
            const normalizedNewPhone = possiblePhone;
            let existing = await Session.findOne({ phone: normalizedNewPhone });

            if (existing) {
              try {
                const reassignRes = await reassignSmsFrom(session.phone, normalizedNewPhone);
                if (reassignRes) console.log(`Reassigned ${reassignRes.modifiedCount} SMS docs from ${session.phone} -> ${normalizedNewPhone}`);
              } catch (e) { console.warn('reassignSmsFrom failed', e); }

              try { await Session.deleteOne({ _id: session._id }); } catch (e) { console.warn('Failed to delete guest session', e); }

              session = existing;
              replyText = `Great! I've linked this chat to your phone ${normalizedNewPhone}. How can I help you today? Just say "I need help" or "book service" to get started.`;
            } else {
              const oldGuest = session.phone;
              session.phone = normalizedNewPhone;
              session.state = 'new';
              await session.save();

              try {
                const reassignRes = await reassignSmsFrom(oldGuest, normalizedNewPhone);
                if (reassignRes) console.log(`Reassigned ${reassignRes.modifiedCount} SMS docs from ${oldGuest} -> ${normalizedNewPhone}`);
              } catch (e) { console.warn('reassignSmsFrom failed', e); }

              try { smsDoc.from = normalizedNewPhone; smsDoc.to = SYSTEM_NUMBER; await smsDoc.save(); } catch (e) { console.warn('Failed update smsDoc.from', e); }

              replyText = `Perfect! Your phone number ${normalizedNewPhone} is saved. Which service do you need? For example: Plumbing, Drain cleaning, Water heater, Pipe repair, Bathroom fitting, Electrical, or Other.`;
            }

            const out = await saveOutgoing(session.phone, replyText, {
              replyTo: smsDoc._id,
              webhookData: msgData,
              deviceId: msgData.deviceID || SENSOR_API_DEFAULT_DEVICES,
              sendTo: normalizedNewPhone
            });

            // attempt send now that we have numeric phone
            setImmediate(() => runSend(out._id, normalizedNewPhone, replyText, msgData.deviceID || SENSOR_API_DEFAULT_DEVICES));

            try { await SMS.updateOne({ _id: smsDoc._id }, { $push: { replies: out._id } }); } catch (e) { console.warn('Failed to push reply id', e); }

            results.push({ success: true, message: 'Phone received and processed', data: { incomingId: smsDoc._id, outgoingId: out._id, reply: replyText } });
            continue;
          } else {
            replyText = "Please enter a valid phone number (digits only, e.g., 9123456789) so I can create your booking link.";
            const out = await saveOutgoing(session.phone, replyText, {
              replyTo: smsDoc._id,
              webhookData: msgData,
              deviceId: msgData.deviceID || SENSOR_API_DEFAULT_DEVICES,
              sendTo: sendTarget || session.phone
            });

            if (sendTarget) {
              setImmediate(() => runSend(out._id, sendTarget, replyText, msgData.deviceID || SENSOR_API_DEFAULT_DEVICES));
            } else {
              await SMS.findByIdAndUpdate(out._id, { $set: { smsApiResult: { note: 'awaiting valid phone from user' } } });
            }

            try { await SMS.updateOne({ _id: smsDoc._id }, { $push: { replies: out._id } }); } catch (e) { console.warn('Failed to push reply id', e); }
            results.push({ success: true, message: 'Awaiting valid phone number', data: { incomingId: smsDoc._id, outgoingId: out._id, reply: replyText } });
            continue;
          }
        }

        // main dialog flows...
        if (includesAny(lower, ['emergency', 'urgent', 'help now', 'immediately'])) {
          replyText = "🚨 If this is an emergency, please call our 24/7 emergency line: (555) PLUMBER. For non-urgent requests, I can help you book a service right away!";
          session.state = 'new';
          await session.save();
        } else if (lower === 'cancel' || lower === 'stop') {
          session.state = 'cancelled';
          await session.save();
          replyText = "Your request has been cancelled. If you need plumbing services in the future, just text me anytime. Have a great day! 👋";
        } else if (includesAny(lower, ['price', 'pricing', 'cost', 'how much', 'rate', 'charge'])) {
          const bookingLink = generateBookingLink(session.phone, session.sessionId);
          replyText = `Our pricing varies by service type and complexity. To get an accurate quote, please use your personalized booking form: ${bookingLink}\n\nOur certified plumbers will provide a detailed quote before starting any work. No surprises! 💰`;
          session.state = 'link_sent';
          await session.save();
        } else if ((session.state === 'new' || !session.state) && includesAny(lower, ['help', 'need', 'book', 'plumber', 'plumbing', 'i need', 'i want', 'service', 'repair', 'fix'])) {
          replyText = `I'm here to help! 🔧 Which plumbing service do you need?\n\n• Plumbing (leaks, clogs, taps)\n• Drain cleaning\n• Water heater / geyser\n• Pipe repair / replacement\n• Bathroom fitting / installation\n• Electrical (minor)\n• Other\n\nJust reply with the service type you need!`;
          session.state = 'awaiting_service';
          session.service = null;
          await session.save();
        } else if (session.state === 'awaiting_service') {
          const detected = detectService(cleanMsg);
          if (detected) {
            if (detected.toLowerCase().includes('other')) {
              session.state = 'awaiting_other_desc';
              await session.save();
              replyText = "Please briefly describe the plumbing issue you're experiencing. The more details you provide, the better we can help! 📝";
            } else {
              session.state = 'link_sent';
              session.service = detected;
              await session.save();
              const bookingLink = generateBookingLink(session.phone, session.sessionId);
              replyText = `Excellent! ${detected} service selected. 🎯\n\nPlease complete your booking using this secure link:\n${bookingLink}\n\n✅ Quick & easy form\n✅ Choose your preferred time\n✅ Upload photos if needed\n✅ Get instant confirmation\n\nAfter booking, you can track everything online!`;
            }
          } else {
            replyText = "I didn't quite catch that. Please choose from:\n\n• Plumbing\n• Drain cleaning\n• Water heater\n• Pipe repair\n• Bathroom fitting\n• Electrical\n• Other\n\nJust type the service you need! 🔧";
          }
        } else if (session.state === 'awaiting_other_desc') {
          session.service = `Other: ${cleanMsg}`;
          session.state = 'link_sent';
          await session.save();
          const bookingLink = generateBookingLink(session.phone, session.sessionId);
          replyText = `Got it! I've noted your request: "${cleanMsg}" 📝\n\nComplete your booking here:\n${bookingLink}\n\nOur expert plumbers will review your specific needs and provide the best solution!`;
        } else if (session.state === 'link_sent') {
          if (includesAny(lower, ['done', 'submitted', 'completed', 'filled', 'finished', 'sent'])) {
            session.state = 'submitted';
            await session.save();
            replyText = `🎉 Fantastic! Your booking request has been received.\n\n✅ Our certified plumbers will review your request\n✅ You'll receive an acceptance notification soon\n✅ Track progress at: ${BOOKING_LINK}/login\n\nThank you for choosing PlumbPro! 🔧`;
          } else if (includesAny(lower, ['not yet', 'not done', 'havent', 'no', 'still working'])) {
            const bookingLink = generateBookingLink(session.phone, session.sessionId);
            replyText = `No worries! Take your time. Your booking link is always ready:\n${bookingLink}\n\nJust reply "Done" when you've completed the form! 👍`;
          } else if (includesAny(lower, ['link', 'form', 'booking', 'again', 'resend'])) {
            const bookingLink = generateBookingLink(session.phone, session.sessionId);
            replyText = `Here's your booking link again:\n${bookingLink}\n\nReply "Done" after you've filled out the form! 📋`;
          } else {
            const bookingLink = generateBookingLink(session.phone, session.sessionId);
            replyText = `Please complete your booking form: ${bookingLink}\n\n💡 After filling it out, reply "Done" and I'll confirm everything is set! Need the link again? Just ask!`;
          }
        } else if (session.state === 'submitted') {
          if (includesAny(lower, ['status', 'update', 'when', 'accepted', 'progress', 'news'])) {
            replyText = `⏳ Your booking is being reviewed by our team. You'll get a notification once a plumber accepts your request!\n\n📱 Track live updates: ${BOOKING_LINK}/login\n\nUsually takes 30-60 minutes during business hours.`;
          } else {
            replyText = `Your booking request is submitted! 🎯\n\n📱 Track status: ${BOOKING_LINK}/login\n💬 Get updates here automatically\n🔧 Our plumbers are reviewing your request\n\nNeed help with something else?`;
          }
        } else {
          const directService = detectService(cleanMsg);
          if (directService) {
            session.state = 'link_sent';
            session.service = directService;
            await session.save();
            const bookingLink = generateBookingLink(session.phone, session.sessionId);
            replyText = `Perfect! ${directService} service selected. 🎯\n\nBook your appointment:\n${bookingLink}\n\nQuick, secure, and easy! Reply "Done" when finished. 🔧`;
          } else {
            replyText = `Hi! I'm your PlumbPro assistant. 🔧\n\nNeed plumbing help? Just say:\n• "I need help"\n• "Book service" \n• Or describe your issue\n\nI'll guide you through everything!`;
          }
        }

        if (!replyText) {
          replyText = `Hi there! 👋 I'm here to help with your plumbing needs.\n\nSay "Help" to book a service, or describe what you need fixed. I'll take care of the rest! 🔧`;
        }

        // create outgoing document that references this incoming message
        const outgoing = await saveOutgoing(session.phone, replyText, {
          replyTo: smsDoc._id,
          webhookData: msgData,
          deviceId: msgData.deviceID || SENSOR_API_DEFAULT_DEVICES,
          sendTo: sendTarget || session.phone
        });

        // send async to gateway only if we have a numeric destination
        if (sendTarget) {
          setImmediate(() => runSend(outgoing._id, sendTarget, replyText, msgData.deviceID || SENSOR_API_DEFAULT_DEVICES));
        } else {
          // annotate outgoing so it's clear in the DB that we didn't attempt external send
          await SMS.findByIdAndUpdate(outgoing._id, { $set: { smsApiResult: { note: 'no numeric destination available; awaiting user phone' } } });
        }

        try { await SMS.updateOne({ _id: smsDoc._id }, { $push: { replies: outgoing._id } }); } catch (e) { console.warn('Failed to push reply id into incoming sms.replies', e); }

        await session.save();

        results.push({
          success: true,
          message: 'SMS received and processed by agent',
          data: {
            incomingId: smsDoc._id,
            outgoingId: outgoing._id,
            from: smsDoc.from,
            to: smsDoc.to,
            message: smsDoc.message,
            reply: replyText,
            session: { phone: session.phone, sessionId: session.sessionId, state: session.state, service: session.service }
          }
        });

      } catch (msgError) {
        console.error('Error processing message:', msgError);
        results.push({ success: false, error: msgError.message, msgData });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Processed ${messages.length} message(s)`,
      results,
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

  } catch (err) {
    console.error('Webhook internal error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// gateway-test endpoint (synchronous send + update)
router.post('/gateway-test', async (req, res) => {
  try {
    const { phone, message, devices } = req.body;
    if (!phone || !message) return res.status(400).json({ success: false, error: 'Missing phone or message' });

    const temp = await saveOutgoing(phone, message, { webhookData: { test: true }, sendTo: normalizeToDigits(phone) });
    const result = await sendSMS(phone, message, devices || SENSOR_API_DEFAULT_DEVICES);
    await SMS.findByIdAndUpdate(temp._id, { $set: { smsApiResult: result, status: result.success ? 'sent' : 'failed', messageId: result.messageId || temp.messageId } });

    return res.json({ success: true, result });
  } catch (err) {
    console.error('gateway-test error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// booking-notification (queues an outgoing notification)
router.post('/booking-notification', async (req, res) => {
  try {
    const { bookingId, status, phone, providerName } = req.body;
    if (!bookingId || !status || !phone) return res.status(400).json({ success: false, error: 'Missing required fields: bookingId, status, phone' });

    let message = '';
    const loginLink = `${BOOKING_LINK}/login`;
    switch (status) {
      case 'accepted':
        message = `🎉 Great news! Your plumbing service has been accepted by ${providerName || 'our certified plumber'}!\n\n✅ Booking confirmed\n📱 Track progress: ${loginLink}\n💬 Get updates here\n\nThank you for choosing PlumbPro! 🔧`;
        break;
      case 'quotation_sent':
        message = `📋 Your service quotation is ready!\n\n💰 Review pricing and details\n✅ Accept/reject online: ${loginLink}\n📱 Or reply here for assistance\n\nTransparent pricing, no surprises! 🔧`;
        break;
      case 'completed':
        message = `✅ Service completed successfully!\n\n🔧 Work finished by ${providerName || 'your plumber'}\n📋 Invoice available: ${loginLink}\n⭐ Please rate your experience\n\nThank you for choosing PlumbPro!`;
        break;
      default:
        message = `📱 Update on your plumbing service:\n\nStatus: ${status.replace('_', ' ')}\n🔍 Full details: ${loginLink}\n\nQuestions? Just reply here! 🔧`;
    }

    const outgoing = await saveOutgoing(phone, message, {
      replyTo: null,
      webhookData: { bookingId, status },
      deviceId: undefined,
      sendTo: normalizeToDigits(phone)
    });

    if (isValidPhoneDigits(normalizeToDigits(phone))) {
      setImmediate(() => runSend(outgoing._id, normalizeToDigits(phone), message, undefined));
    } else {
      await SMS.findByIdAndUpdate(outgoing._id, { $set: { smsApiResult: { note: 'invalid phone for booking-notification' }, status: 'failed' } });
    }

    res.json({ success: true, message: 'Notification queued', smsId: outgoing._id });

  } catch (error) {
    console.error('Booking notification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// test helper — simulates provider webhook call
router.post('/test', async (req, res) => {
  try {
    const testMessage = req.body.message || 'Hello';
    const testPhone = req.body.phone || '1234567890';

    const simulatedWebhook = [{
      ID: Date.now(),
      number: testPhone,
      message: testMessage,
      deviceID: 3,
      simSlot: 0,
      status: "Received",
      sentDate: new Date().toISOString(),
      deliveredDate: new Date().toISOString()
    }];

    const result = await axios.post(`${req.protocol}://${req.get('host')}/api/sms/webhook`, simulatedWebhook);

    res.json({ success: true, message: 'Test completed', input: { message: testMessage, phone: testPhone }, webhookResult: result.data });

  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
