// routes/webhook.js
const express = require('express');
const axios = require('axios'); // kept in case you want to forward externally later
const SMS = require('../models/SMS');
const Session = require('../models/Session');
const { Types: { ObjectId } } = require('mongoose');

const router = express.Router();

const BOOKING_LINK = 'https://plumberpro-seven.vercel.app/';
const SENDER_NUMBER = process.env.SMS_SENDER_NUMBER || 'System';

// canonical service list (use lowercase when matching)
const SERVICES = [
  'plumbing',            // general plumbing (leaks, clogs, taps)
  'drain cleaning',
  'water heater',
  'geyser',
  'pipe repair',
  'pipe replacement',
  'bathroom fitting',
  'installation',
  'electrical',
  'other'
];

// helper: normalize incoming text
function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  return text.trim();
}

// helper: do simple intent checks
function includesAny(text, words) {
  const t = (text || '').toLowerCase();
  return words.some(w => t.includes(w));
}

// canonicalize service name from user text (attempt)
function detectService(text) {
  const t = (text || '').toLowerCase();
  // direct exact matches & shortcuts
  if (t.includes('plumb')) return 'Plumbing';
  if (t.includes('drain')) return 'Drain cleaning';
  if (t.includes('geyser') || t.includes('water heater')) return 'Water heater';
  if (t.includes('pipe') && (t.includes('repair') || t.includes('replace') || t.includes('replacement'))) return 'Pipe repair / replacement';
  if (t.includes('bath') || t.includes('bathroom') || t.includes('fitting')) return 'Bathroom fitting / installation';
  if (t.includes('electr') || t.includes('socket') || t.includes('switch')) return 'Electrical (minor)';
  if (t.includes('other')) return 'Other';
  // fallback: check each service phrase
  for (const s of SERVICES) {
    if (t.includes(s)) return capitalizeService(s);
  }
  return null;
}

function capitalizeService(s) {
  // some formatting
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

// Create or update session for phone, returns session doc
async function getOrCreateSession(phone) {
  const sessionId = new ObjectId().toString(); // unique id
  // try find existing session by phone
  let session = await Session.findOne({ phone });
  if (!session) {
    session = new Session({ phone, sessionId, state: 'new' });
    await session.save();
    return session;
  }
  // if existing session doesn't have sessionId (rare), set it
  if (!session.sessionId) {
    session.sessionId = sessionId;
    await session.save();
  }
  return session;
}

// Save outgoing SMS helper
async function saveOutgoing(phone, text) {
  const out = new SMS({
    from: SENDER_NUMBER,
    to: phone,
    message: text,
    type: 'sent',
    status: 'pending',
    messageId: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  });
  await out.save();
  return out;
}

/**
 * Heuristic: extract digits from text and return normalized phone string if plausible,
 * otherwise return null.
 * Accepts numbers of length 10..15 (basic).
 */
function extractPhoneDigits(text) {
  if (!text || typeof text !== 'string') return null;
  const digits = (text.match(/\d+/g) || []).join('');
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

/**
 * Create a guest id for anonymous chats
 * e.g. guest_ab12cd34
 */
function makeGuestId() {
  return `guest_${new ObjectId().toString().slice(-8)}`;
}

/**
 * Move all SMS documents from oldFrom -> newFrom.
 * Returns { modifiedCount } (Mongo update result) or null on error.
 */
async function reassignSmsFrom(oldFrom, newFrom) {
  try {
    const res = await SMS.updateMany({ from: oldFrom }, { $set: { from: newFrom } });
    return res;
  } catch (e) {
    console.warn('reassignSmsFrom failed', e);
    return null;
  }
}

// POST /api/sms/webhook
router.post('/webhook', async (req, res) => {
  try {
    // Accept message always; phone is optional now (to support anonymous/chat widget)
    const { message } = req.body ?? {};
    let { phone } = req.body ?? {};

    if (!message) {
      return res.status(400).json({
        success: false,
        error: '"message" field is required in the request body'
      });
    }

    const cleanMsg = cleanText(message);
    // declare lower once and reuse
    const lower = cleanMsg.toLowerCase();

    // If phone is missing or explicitly set to 'unknown' (or empty), create or use a guest id
    let isGuest = false;
    if (!phone || String(phone).trim().toLowerCase() === 'unknown' || String(phone).trim() === '') {
      isGuest = true;
      phone = makeGuestId();
    } else {
      phone = String(phone).trim();
    }

    const from = phone;
    const to = process.env.SMS_SYSTEM_NUMBER || 'system';

    // Save incoming SMS (mark 'from' as guest or phone; we'll update if we later learn the real phone)
    const smsDoc = new SMS({
      from,
      to,
      message: cleanMsg,
      type: 'received',
      status: 'received',
      messageId: `recv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      webhookData: { receivedBody: req.body, headers: req.headers }
    });
    await smsDoc.save();

    // Get or create session for this phone (guest or real)
    let session = await getOrCreateSession(from);

    // single reply variable used throughout
    let replyText = null;

    /**
     * PART A: If this is a guest session which hasn't been asked for phone yet,
     * ask for phone and stop here.
     */
    if (session.phone && session.phone.startsWith('guest_') && session.state !== 'awaiting_phone') {
      session.state = 'awaiting_phone';
      await session.save();

      replyText = "Hi, Please fill top placeholder with your phone number (digits only, e.g. 915886543219) so we can continue with the booking.";

      // persist outgoing reply SMS record
      await saveOutgoing(session.phone, replyText);

      return res.status(200).json({
        success: true,
        message: 'SMS received and processed (awaiting phone)',
        data: {
          id: smsDoc._id,
          from: smsDoc.from,
          to: smsDoc.to,
          message: smsDoc.message,
          createdAt: smsDoc.createdAt
        },
        agent: {
          reply: replyText,
          session: {
            phone: session.phone,
            sessionId: session.sessionId,
            state: session.state,
            service: session.service || null
          },
          outgoingSmsId: null
        }
      });
    }

    /**
     * PART B: If we are awaiting phone (user was asked) -> check if this message contains phone digits.
     * If yes, migrate/merge conversation and continue.
     */
    if (session.state === 'awaiting_phone') {
      const possiblePhone = extractPhoneDigits(cleanMsg);
      if (possiblePhone) {
        const normalizedPhone = possiblePhone;

        // check if there is already a session for this real phone
        let existing = await Session.findOne({ phone: normalizedPhone });

        if (existing) {
          // Merge guest -> existing:
          // 1) Reassign all SMS docs that have from == guest_id to normalizedPhone
          // 2) Delete the guest session record to avoid orphan sessions (optional)
          // 3) Use the existing session going forward
          try {
            const reassignRes = await reassignSmsFrom(session.phone, normalizedPhone);
            if (reassignRes) {
              console.log(`Reassigned ${reassignRes.modifiedCount} SMS docs from ${session.phone} -> ${normalizedPhone}`);
            }
          } catch (e) {
            console.warn('Failed to reassign SMS docs to existing session phone', e);
          }

          try {
            // delete guest session record
            await Session.deleteOne({ _id: session._id });
          } catch (e) {
            console.warn('Failed to delete guest session after merge', e);
          }

          session = existing;
          replyText = `Thanks — we've attached this chat to your phone ${normalizedPhone}. Resuming your existing session. How can we help?`;

        } else {
          // No existing session: update this guest session to become the real phone session
          const oldGuest = session.phone;
          session.phone = normalizedPhone;
          session.state = 'new';
          await session.save();

          // Reassign previous SMS messages from guest to normalized phone
          try {
            const reassignRes = await reassignSmsFrom(oldGuest, normalizedPhone);
            if (reassignRes) {
              console.log(`Reassigned ${reassignRes.modifiedCount} SMS docs from ${oldGuest} -> ${normalizedPhone}`);
            }
          } catch (e) {
            console.warn('Failed to reassign SMS docs from guest to new phone', e);
          }

          // Update the incoming message record's from field to the normalized phone
          try {
            smsDoc.from = normalizedPhone;
            await smsDoc.save();
          } catch (e) {
            console.warn('Failed to update smsDoc.from to normalized phone', e);
          }

          replyText = `Thanks — your phone number ${normalizedPhone} is saved. Which service do you need right now? For example: Plumbing, Drain cleaning, Water heater, Pipe repair, Bathroom fitting, Electrical, Other.`;
        }

        // persist outgoing reply record
        const out = await saveOutgoing(normalizedPhone, replyText);

        return res.status(200).json({
          success: true,
          message: 'Phone received and processed',
          data: {
            id: smsDoc._id,
            from: smsDoc.from,
            to: smsDoc.to,
            message: smsDoc.message,
            createdAt: smsDoc.createdAt
          },
          agent: {
            reply: replyText,
            session: {
              phone: session.phone,
              sessionId: session.sessionId,
              state: session.state,
              service: session.service || null
            },
            outgoingSmsId: out ? out._id : null
          }
        });
      } else {
        // The user did not provide a valid-looking phone when asked — remind them
        replyText = "Please enter your phone number in top placeholder so we can continue (e.g. 915886543219). If you prefer, include country code.";
        await saveOutgoing(session.phone, replyText);

        return res.status(200).json({
          success: true,
          message: 'Awaiting valid phone number',
          data: {
            id: smsDoc._id,
            from: smsDoc.from,
            to: smsDoc.to,
            message: smsDoc.message,
            createdAt: smsDoc.createdAt
          },
          agent: {
            reply: replyText,
            session: {
              phone: session.phone,
              sessionId: session.sessionId,
              state: session.state,
              service: session.service || null
            },
            outgoingSmsId: null
          }
        });
      }
    }

    /**
     * PART C: Normal flow for sessions that already have a real phone (or after merge)
     */
    // Main flow logic
    // Emergency handling
    if (includesAny(lower, ['emergency', 'urgent', 'help now', 'immediately'])) {
      replyText = "If this is an emergency, please call our emergency line immediately."; // add number if you have one
      session.state = 'new';
      await session.save();
    }

    // If user wants to cancel
    else if (lower === 'cancel' || lower === 'stop') {
      session.state = 'cancelled';
      await session.save();
      replyText = "Your request has been cancelled. If you need anything else, message us.";
    }

    // If user asks for pricing
    else if (includesAny(lower, ['price', 'pricing', 'cost', 'how much'])) {
      replyText = "Pricing varies by service and location; please use the booking form to request a quote: " + BOOKING_LINK;
      session.state = 'link_sent';
      session.service = session.service || null;
      await session.save();
      await saveOutgoing(session.phone, replyText);
    }

    // If session is new and user expresses need for help/book
    else if ((session.state === 'new' || !session.state) && includesAny(lower, ['help', 'need', 'book', 'plumber', 'plumbing', 'i need', 'i want'])) {
      // ask for service selection
      replyText = "Which service do you need right now? Choose one:\n- Plumbing (leaks, clogs, taps)\n- Drain cleaning\n- Water heater / geyser\n- Pipe repair / replacement\n- Bathroom fitting / installation\n- Electrical (minor)\n- Other";
      session.state = 'awaiting_service';
      session.service = null;
      await session.save();
    }

    // If waiting for the user to pick a service
    else if (session.state === 'awaiting_service') {
      // Detect chosen service
      const detected = detectService(cleanMsg);
      if (detected) {
        // If user selected Other specifically
        if (detected.toLowerCase().includes('other')) {
          session.state = 'awaiting_other_desc';
          await session.save();
          replyText = "Please briefly describe the problem.";
        } else {
          // confirm chosen service and send link
          const serviceLabel = detected;
          session.state = 'link_sent';
          session.service = serviceLabel;
          await session.save();

          replyText = `Great — ${serviceLabel} selected. Please fill this short booking form so we can schedule: ${BOOKING_LINK}`;

          // persist outgoing reply SMS record
          await saveOutgoing(session.phone, replyText);
        }
      } else {
        // If user replied but we couldn't map to a service, ask again briefly
        replyText = "Sorry, I didn't recognise that service. Please choose one of: Plumbing, Drain cleaning, Water heater, Pipe repair, Bathroom fitting, Electrical, Other.";
      }
    }

    // If user provided "other" description
    else if (session.state === 'awaiting_other_desc') {
      // Accept user's description, then send link
      session.service = cleanMsg;
      session.state = 'link_sent';
      await session.save();

      replyText = `Thanks — noted. Please fill this short booking form so we can schedule: ${BOOKING_LINK}`;
      await saveOutgoing(session.phone, replyText);
    }

    // If link has been sent and we are waiting for confirmation from user that form submitted
    else if (session.state === 'link_sent') {
      // user says done/submitted
      if (includesAny(lower, ['done', 'submitted', 'i submitted', 'i did', 'finished'])) {
        session.state = 'submitted';
        await session.save();

        replyText = "Thanks — we received your request. We will inform you once your booking is accepted.";
        await saveOutgoing(session.phone, replyText);
      } else if (includesAny(lower, ['not yet', 'not', 'haven\'t', 'no'])) {
        replyText = `Okay — when you're done, just reply "Done" and we'll proceed.`;
      } else {
        // fallback helpful reminder
        replyText = `If you've completed the form, reply "Done". If not, you can fill it here: ${BOOKING_LINK}`;
      }
    }

    // If user already submitted earlier
    else if (session.state === 'submitted') {
      // user asking status?
      if (includesAny(lower, ['status', 'update', 'when', 'accepted'])) {
        replyText = "We will inform you once your booking is accepted. Please allow our team some time to review.";
      } else {
        replyText = "We will inform you once your booking is accepted. If you need anything else, let us know.";
      }
    }

    // Fallback: if none of the above matched, attempt to handle direct service mention (user jumped straight to service)
    else {
      const directService = detectService(cleanMsg);
      if (directService) {
        // treat like they selected service
        session.state = 'link_sent';
        session.service = directService;
        await session.save();
        replyText = `Great — ${directService} selected. Please fill this short booking form so we can schedule: ${BOOKING_LINK}`;
        await saveOutgoing(session.phone, replyText);
      } else {
        // default reply asking if they need help
        replyText = "Hi — do you need help with a plumbing service? If yes, reply 'I need a plumber' or 'Help' and I will guide you.";
      }
    }

    // If replyText is still null (shouldn't happen), default
    if (!replyText) {
      replyText = "Sorry — I couldn't process that. Please say 'Help' to start booking.";
    }

    // Save the outgoing SMS record (we may have saved already in some branches)
    const outgoing = await saveOutgoing(session.phone, replyText);

    // Ensure session is saved
    await session.save();

    // Return combined response
    return res.status(200).json({
      success: true,
      message: 'SMS received and processed by agent',
      data: {
        id: smsDoc._id,
        from: smsDoc.from,
        to: smsDoc.to,
        message: smsDoc.message,
        createdAt: smsDoc.createdAt
      },
      agent: {
        reply: replyText,
        session: {
          phone: session.phone,
          sessionId: session.sessionId,
          state: session.state,
          service: session.service
        },
        outgoingSmsId: outgoing ? outgoing._id : null
      }
    });

  } catch (err) {
    console.error('Webhook internal error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});

module.exports = router;
