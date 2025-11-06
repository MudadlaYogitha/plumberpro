// routes/sms.js
const express = require('express');
const axios = require('axios');
const { Types: { ObjectId } } = require('mongoose');

const SMS = require('../models/SMS');
const Session = require('../models/Session');

const router = express.Router();

const BOOKING_LINK = process.env.FRONTEND_URL || 'http://localhost:5173';
const SENDER_NUMBER = (process.env.SMS_SENDER_NUMBER || 'System').toString().replace(/\D/g, '');
const SYSTEM_NUMBER = (process.env.SMS_SYSTEM_NUMBER || SENDER_NUMBER || '0000000000').toString().replace(/\D/g, '');

// SENSOR config
const SENSOR_API_BASE_URL = (process.env.SENSOR_API_BASE_URL || 'https://connect.sensorequation.com').replace(/\/+$/, '');
const SENSOR_API_KEY = process.env.SENSOR_API_KEY || '';
const SENSOR_API_DEFAULT_DEVICES = process.env.SENSOR_API_DEFAULT_DEVICES || '3';
const SENDSMS_MAX_RETRIES = parseInt(process.env.SENDSMS_MAX_RETRIES || '3', 10);
const SENDSMS_BASE_DELAY_MS = parseInt(process.env.SENDSMS_BASE_DELAY_MS || '800', 10);
const SENDSMS_TIMEOUT_MS = parseInt(process.env.SENDSMS_TIMEOUT_MS || '15000', 10);

// --- Helpers ---
function cleanText(text) { if (!text || typeof text !== 'string') return ''; return text.trim(); }
function includesAny(text, arr) { const t = (text || '').toLowerCase(); return arr.some(w => t.includes(w)); }
function normalizeDigits(v) { if (v === undefined || v === null) return ''; return String(v).replace(/\D/g, ''); }
function isValidPhoneDigits(d) { return !!(d && d.length >= 10 && d.length <= 15); }
function makeGuestId() { return `guest_${new ObjectId().toString().slice(-8)}`; }

function generateBookingLink(phone, sessionId) {
  const encodedPhone = encodeURIComponent(phone);
  const encodedSession = encodeURIComponent(sessionId);
  return `${BOOKING_LINK}/book-service?phone=${encodedPhone}&session=${encodedSession}&ref=sms`;
}

async function saveOutgoing(phone, text, opts = {}) {
  const out = new SMS({
    from: SENDER_NUMBER,
    to: opts.sendTo || phone,
    message: text,
    type: 'sent',
    status: opts.initialStatus || 'pending',
    messageId: opts.messageId || `auto_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    replyTo: opts.replyTo || null,
    webhookData: opts.webhookData || undefined,
    deviceId: opts.deviceId || undefined,
    smsApiResult: opts.smsApiResult || undefined
  });
  await out.save();
  return out;
}

/**
 * sendSMS -> contacts SensorEquation (GET then POST fallback), returns result with attempts
 */
async function sendSMS(to, message, devices = null) {
  const cleanTo = normalizeDigits(to);
  if (!isValidPhoneDigits(cleanTo)) {
    return { success: false, error: 'Invalid destination phone number', attempts: [] };
  }
  const devicesParam = devices ? String(devices) : String(SENSOR_API_DEFAULT_DEVICES);
  const safeMessage = String(message || '');
  const attempts = [];

  if (!SENSOR_API_KEY || !SENSOR_API_BASE_URL) {
    attempts.push({ note: 'SENSOR API not configured; mock send' });
    return { success: true, messageId: `mock_${Date.now()}`, attempts };
  }

  for (let attempt = 1; attempt <= SENDSMS_MAX_RETRIES; ++attempt) {
    const delayMs = SENDSMS_BASE_DELAY_MS * (attempt - 1);
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));

    // GET attempt
    const getUrl = `${SENSOR_API_BASE_URL}/services/send-message.php` +
      `?key=${encodeURIComponent(SENSOR_API_KEY)}` +
      `&number=${encodeURIComponent(cleanTo)}` +
      `&message=${encodeURIComponent(safeMessage)}` +
      `&devices=${encodeURIComponent(devicesParam)}` +
      `&type=sms&prioritize=1`;

    try {
      const resp = await axios.get(getUrl, { timeout: SENDSMS_TIMEOUT_MS });
      const data = resp.data || {};
      attempts.push({ attempt, method: 'GET', url: getUrl, status: resp.status, data });
      const successFlag = (typeof data.success !== 'undefined') ? data.success : true;
      const messageId = data.messageId || data.id || `sent_${Date.now()}`;
      if (successFlag) return { success: true, messageId, raw: data, attempts, attemptCount: attempt, method: 'GET' };
    } catch (err) {
      attempts.push({ attempt, method: 'GET', url: getUrl, error: err.message, code: err.code || null, response: err.response && err.response.data ? err.response.data : null });
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
      attempts.push({ attempt, method: 'POST', url: postUrl, status: respPost.status, requestPreview: params.toString().slice(0,1000), data: pdata });
      const successFlagPost = (typeof pdata.success !== 'undefined') ? pdata.success : true;
      const messageIdPost = pdata.messageId || pdata.id || `sent_${Date.now()}`;
      if (successFlagPost) return { success: true, messageId: messageIdPost, raw: pdata, attempts, attemptCount: attempt, method: 'POST' };
    } catch (errPost) {
      attempts.push({ attempt, method: 'POST', url: postUrl, error: errPost.message, code: errPost.code || null, response: errPost.response && errPost.response.data ? errPost.response.data : null });
    }
  }

  return { success: false, error: 'All send attempts failed', attempts };
}

// runSend: call sendSMS and update outgoing doc
async function runSend(outgoingId, to, message, devices) {
  try {
    const result = await sendSMS(to, message, devices);
    const update = { smsApiResult: result, status: result.success ? 'sent' : 'failed' };
    if (result && result.messageId) update.messageId = result.messageId;
    await SMS.findByIdAndUpdate(outgoingId, { $set: update }, { new: true });
  } catch (err) {
    console.error('runSend failed:', err && err.message ? err.message : err);
    try { await SMS.findByIdAndUpdate(outgoingId, { $set: { smsApiResult: { error: String(err) }, status: 'failed' } }); } catch (e) { console.warn('Failed to mark outgoing as failed after runSend error', e); }
  }
}

// main webhook
router.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', JSON.stringify(req.body, null, 2));

    // Normalize incoming shapes
    let messages = [];
    if (Array.isArray(req.body)) {
      // provider may POST array directly
      messages = req.body;
    } else if (req.body.messages && Array.isArray(req.body.messages)) {
      messages = req.body.messages;
    } else if (req.body.message && (req.body.number || req.body.phone || req.body.sender)) {
      messages = [{ message: req.body.message, number: req.body.phone || req.body.number || req.body.sender, ...req.body }];
    } else {
      return res.status(400).json({ success: false, error: 'Invalid webhook payload format' });
    }

    const results = [];

    for (const msgData of messages) {
      try {
        const message = msgData.message || msgData.Message || '';
        // provider may use 'number', 'phone', 'from', 'sender'
        const rawPhoneCandidate = msgData.number || msgData.phone || msgData.from || msgData.sender || null;

        if (!message) {
          results.push({ success: false, error: 'Message field is required', msgData });
          continue;
        }

        const cleanMsg = cleanText(message);
        const normalizedPhone = rawPhoneCandidate ? normalizeDigits(rawPhoneCandidate) : '';
        const from = normalizedPhone && isValidPhoneDigits(normalizedPhone) ? normalizedPhone : makeGuestId();
        const to = SYSTEM_NUMBER;

        // Save incoming
        const smsDoc = new SMS({
          from,
          to,
          message: cleanMsg,
          type: 'received',
          status: 'received',
          messageId: msgData.ID ? `recv_${msgData.ID}` : `recv_${Date.now()}_${Math.random().toString(36).slice(2,11)}`,
          deviceId: msgData.deviceID,
          webhookData: msgData
        });
        await smsDoc.save();

        // get/create session
        let session = await Session.findOne({ phone: from });
        if (!session) {
          session = new Session({ phone: from, sessionId: new ObjectId().toString(), state: 'new' });
          await session.save();
        } else if (!session.sessionId) {
          session.sessionId = new ObjectId().toString();
          await session.save();
        }

        // dialog (simple): if new or "help", ask service; if service given, send booking link; basic flows
        let replyText = null;

        if (session.phone && String(session.phone).startsWith('guest_') && session.state !== 'awaiting_phone') {
          session.state = 'awaiting_phone';
          await session.save();
          replyText = "Hi! I'm your PlumbPro assistant. Please reply with your phone number (e.g., 9123456789) so I can create a personalized booking link.";
        } else if (session.state === 'awaiting_phone') {
          const digits = (cleanMsg.match(/\d+/g) || []).join('');
          if (isValidPhoneDigits(digits)) {
            const normalizedNewPhone = digits;
            // reassign SMS docs if needed (best-effort)
            try { await SMS.updateMany({ from: session.phone }, { $set: { from: normalizedNewPhone } }); } catch (e) { console.warn('reassignSmsFrom failed', e); }
            session.phone = normalizedNewPhone;
            session.state = 'new';
            await session.save();
            // update incoming record from guest to real phone
            try { smsDoc.from = normalizedNewPhone; await smsDoc.save(); } catch (e) { console.warn('Failed to update smsDoc.from', e); }
            replyText = `Perfect! Your phone ${normalizedNewPhone} is saved. Which service do you need? E.g., Plumbing, Drain cleaning, Water heater, Pipe repair, Bathroom fitting, Electrical, or Other.`;
          } else {
            replyText = "Please enter a valid phone number (digits only, e.g., 9123456789).";
          }
        } else {
          // basic intent detection (service vs done/status)
          const lower = cleanMsg.toLowerCase();
          if (includesAny(lower, ['help', 'book', 'plumb', 'plumbing', 'drain', 'geyser', 'water heater', 'installation', 'pipe', 'bath'])) {
            // detect service string (simple)
            let detected = null;
            if (lower.includes('plumb')) detected = 'Plumbing';
            else if (lower.includes('drain')) detected = 'Drain cleaning';
            else if (lower.includes('geyser') || lower.includes('water heater')) detected = 'Water heater';
            else if (lower.includes('bath') || lower.includes('installation')) detected = 'Bathroom fitting / installation';
            if (detected) {
              session.state = 'link_sent';
              session.service = detected;
              await session.save();
              const bookingLink = generateBookingLink(session.phone, session.sessionId);
              replyText = `Excellent! ${detected} selected.\nComplete your booking: ${bookingLink}`;
            } else {
              session.state = 'awaiting_service';
              await session.save();
              replyText = `I'm here to help! Which service do you need? (Plumbing, Drain cleaning, Water heater, Pipe repair, Bathroom fitting, Electrical, Other)`;
            }
          } else {
            // fallback
            replyText = `Hi! I'm your PlumbPro assistant. Reply "Book" to start or tell me the issue.`;
          }
        }

        if (!replyText) replyText = "Hi! I'm your PlumbPro assistant. Reply 'Book' to start.";

        // create outgoing and link to incoming
        const sendToCandidate = isValidPhoneDigits(normalizeDigits(rawPhoneCandidate)) ? normalizeDigits(rawPhoneCandidate) : (isValidPhoneDigits(normalizeDigits(session.phone)) ? normalizeDigits(session.phone) : null);

        const outgoing = await saveOutgoing(session.phone, replyText, {
          replyTo: smsDoc._id,
          webhookData: msgData,
          deviceId: msgData.deviceID,
          sendTo: sendToCandidate || session.phone
        });

        // push reply id into incoming.replies (best-effort)
        try { await SMS.updateOne({ _id: smsDoc._id }, { $push: { replies: outgoing._id } }); } catch (e) { console.warn('Failed to push reply id', e); }

        // send only if numeric destination exists
        if (sendToCandidate) {
          // call runSend in background (no await)
          setImmediate(() => runSend(outgoing._id, sendToCandidate, replyText, msgData.deviceID || SENSOR_API_DEFAULT_DEVICES));
        } else {
          // annotate outgoing so it's obvious in DB no send attempted
          await SMS.findByIdAndUpdate(outgoing._id, { $set: { smsApiResult: { note: 'no numeric destination available; awaiting user phone' }, status: 'pending' } });
        }

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
        console.error('Error processing message:', msgError && msgError.stack ? msgError.stack : msgError);
        results.push({ success: false, error: msgError.message || String(msgError), msgData });
      }
    } // end for messages

    return res.status(200).json({
      success: true,
      message: `Processed ${messages.length} message(s)`,
      results,
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

  } catch (err) {
    console.error('Webhook internal error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, message: 'Internal server error', error: err.message || String(err) });
  }
});

module.exports = router;
