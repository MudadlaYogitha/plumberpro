const express = require('express');
const axios = require('axios');
const SMS = require('../models/SMS');
const Session = require('../models/Session');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { Types: { ObjectId } } = require('mongoose');

const router = express.Router();

const BOOKING_LINK = process.env.FRONTEND_URL || 'http://localhost:5173';
const SENDER_NUMBER = process.env.SMS_SENDER_NUMBER || 'System';

// Canonical service list (use lowercase when matching)
const SERVICES = [
  'plumbing',
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

// Helper: normalize incoming text
function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  return text.trim();
}

// Helper: do simple intent checks
function includesAny(text, words) {
  const t = (text || '').toLowerCase();
  return words.some(w => t.includes(w));
}

// Canonicalize service name from user text
function detectService(text) {
  const t = (text || '').toLowerCase();
  
  if (t.includes('plumb')) return 'Plumbing';
  if (t.includes('drain')) return 'Drain cleaning';
  if (t.includes('geyser') || t.includes('water heater')) return 'Water heater';
  if (t.includes('pipe') && (t.includes('repair') || t.includes('replace') || t.includes('replacement'))) return 'Pipe repair / replacement';
  if (t.includes('bath') || t.includes('bathroom') || t.includes('fitting')) return 'Bathroom fitting / installation';
  if (t.includes('electr') || t.includes('socket') || t.includes('switch')) return 'Electrical (minor)';
  if (t.includes('other')) return 'Other';
  
  for (const s of SERVICES) {
    if (t.includes(s)) return capitalizeService(s);
  }
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

// Create or update session for phone
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

// Extract digits from text and return normalized phone string
function extractPhoneDigits(text) {
  if (!text || typeof text !== 'string') return null;
  const digits = (text.match(/\d+/g) || []).join('');
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

// Create a guest id for anonymous chats
function makeGuestId() {
  return `guest_${new ObjectId().toString().slice(-8)}`;
}

// Move all SMS documents from oldFrom -> newFrom
async function reassignSmsFrom(oldFrom, newFrom) {
  try {
    const res = await SMS.updateMany({ from: oldFrom }, { $set: { from: newFrom } });
    return res;
  } catch (e) {
    console.warn('reassignSmsFrom failed', e);
    return null;
  }
}

// Generate unique booking link with phone number
function generateBookingLink(phone, sessionId) {
  const encodedPhone = encodeURIComponent(phone);
  const encodedSession = encodeURIComponent(sessionId);
  return `${BOOKING_LINK}/book-service?phone=${encodedPhone}&session=${encodedSession}&ref=sms`;
}

// Send SMS via external API (if configured)
async function sendSMS(to, message) {
  if (!process.env.SENSOR_API_KEY || !process.env.SENSOR_API_BASE_URL) {
    console.warn('SMS API not configured, skipping actual SMS send');
    return { success: true, messageId: `mock_${Date.now()}` };
  }

  try {
    const apiUrl = `${process.env.SENSOR_API_BASE_URL}/services/send-message.php`;
    const params = {
      key: process.env.SENSOR_API_KEY,
      number: to,
      message: message,
      devices: '2',
      type: 'sms',
      prioritize: '1'
    };

    const response = await axios.post(apiUrl, null, { params });
    return {
      success: response.data.success || true,
      messageId: response.data.messageId || `sent_${Date.now()}`
    };
  } catch (error) {
    console.error('SMS send error:', error.message);
    return { success: false, error: error.message };
  }
}

// Main webhook endpoint - handles the new schema format
router.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', JSON.stringify(req.body, null, 2));

    let messages = [];
    
    // Handle both array and single message formats
    if (Array.isArray(req.body)) {
      messages = req.body;
    } else if (req.body.message && req.body.number) {
      // Handle direct format {message, phone}
      messages = [{
        message: req.body.message,
        number: req.body.phone || req.body.number
      }];
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook payload format'
      });
    }

    const results = [];

    for (const msgData of messages) {
      try {
        // Extract message and phone from the new schema format
        const message = msgData.message;
        const phone = msgData.number;

        if (!message) {
          results.push({
            success: false,
            error: 'Message field is required',
            msgData
          });
          continue;
        }

        const cleanMsg = cleanText(message);
        const lower = cleanMsg.toLowerCase();
        
        // Normalize phone number or create guest ID
        let normalizedPhone = phone;
        let isGuest = false;
        
        if (!phone || String(phone).trim().toLowerCase() === 'unknown' || String(phone).trim() === '') {
          isGuest = true;
          normalizedPhone = makeGuestId();
        } else {
          normalizedPhone = String(phone).replace(/\D/g, ''); // Remove non-digits
        }

        const from = normalizedPhone;
        const to = process.env.SMS_SYSTEM_NUMBER || 'system';

        // Save incoming SMS
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

        // Get or create session
        let session = await getOrCreateSession(from);
        let replyText = null;

        // PART A: Guest session - ask for phone
        if (session.phone && session.phone.startsWith('guest_') && session.state !== 'awaiting_phone') {
          session.state = 'awaiting_phone';
          await session.save();

          replyText = "Hi! I'm your PlumbPro assistant. To help you book a service, please reply with your phone number (e.g., 9123456789) so I can create a personalized booking link for you.";
          
          const outgoing = await saveOutgoing(session.phone, replyText);
          
          results.push({
            success: true,
            message: 'SMS received and processed (awaiting phone)',
            data: {
              id: smsDoc._id,
              from: smsDoc.from,
              to: smsDoc.to,
              message: smsDoc.message,
              reply: replyText
            }
          });
          continue;
        }

        // PART B: Awaiting phone - process phone number
        if (session.state === 'awaiting_phone') {
          const possiblePhone = extractPhoneDigits(cleanMsg);
          if (possiblePhone) {
            const normalizedNewPhone = possiblePhone;

            // Check if session exists for this real phone
            let existing = await Session.findOne({ phone: normalizedNewPhone });

            if (existing) {
              // Merge guest -> existing session
              try {
                const reassignRes = await reassignSmsFrom(session.phone, normalizedNewPhone);
                if (reassignRes) {
                  console.log(`Reassigned ${reassignRes.modifiedCount} SMS docs from ${session.phone} -> ${normalizedNewPhone}`);
                }
              } catch (e) {
                console.warn('Failed to reassign SMS docs to existing session phone', e);
              }

              try {
                await Session.deleteOne({ _id: session._id });
              } catch (e) {
                console.warn('Failed to delete guest session after merge', e);
              }

              session = existing;
              replyText = `Great! I've linked this chat to your phone ${normalizedNewPhone}. How can I help you today? Just say "I need help" or "book service" to get started.`;

            } else {
              // Update guest session to real phone session
              const oldGuest = session.phone;
              session.phone = normalizedNewPhone;
              session.state = 'new';
              await session.save();

              try {
                const reassignRes = await reassignSmsFrom(oldGuest, normalizedNewPhone);
                if (reassignRes) {
                  console.log(`Reassigned ${reassignRes.modifiedCount} SMS docs from ${oldGuest} -> ${normalizedNewPhone}`);
                }
              } catch (e) {
                console.warn('Failed to reassign SMS docs from guest to new phone', e);
              }

              try {
                smsDoc.from = normalizedNewPhone;
                await smsDoc.save();
              } catch (e) {
                console.warn('Failed to update smsDoc.from to normalized phone', e);
              }

              replyText = `Perfect! Your phone number ${normalizedNewPhone} is saved. Which service do you need? For example: Plumbing, Drain cleaning, Water heater, Pipe repair, Bathroom fitting, Electrical, or Other.`;
            }

            const out = await saveOutgoing(session.phone, replyText);
            
            results.push({
              success: true,
              message: 'Phone received and processed',
              data: {
                id: smsDoc._id,
                from: smsDoc.from,
                to: smsDoc.to,
                message: smsDoc.message,
                reply: replyText
              }
            });
            continue;

          } else {
            replyText = "Please enter a valid phone number (digits only, e.g., 9123456789) so I can create your booking link.";
            await saveOutgoing(session.phone, replyText);
            
            results.push({
              success: true,
              message: 'Awaiting valid phone number',
              data: {
                id: smsDoc._id,
                from: smsDoc.from,
                to: smsDoc.to,
                message: smsDoc.message,
                reply: replyText
              }
            });
            continue;
          }
        }

        // PART C: Normal flow for sessions with real phone numbers
        
        // Emergency handling
        if (includesAny(lower, ['emergency', 'urgent', 'help now', 'immediately'])) {
          replyText = "🚨 If this is an emergency, please call our 24/7 emergency line: (555) PLUMBER. For non-urgent requests, I can help you book a service right away!";
          session.state = 'new';
          await session.save();
        }

        // Cancel/stop
        else if (lower === 'cancel' || lower === 'stop') {
          session.state = 'cancelled';
          await session.save();
          replyText = "Your request has been cancelled. If you need plumbing services in the future, just text me anytime. Have a great day! 👋";
        }

        // Pricing inquiry
        else if (includesAny(lower, ['price', 'pricing', 'cost', 'how much', 'rate', 'charge'])) {
          const bookingLink = generateBookingLink(session.phone, session.sessionId);
          replyText = `Our pricing varies by service type and complexity. To get an accurate quote, please use your personalized booking form: ${bookingLink}\n\nOur certified plumbers will provide a detailed quote before starting any work. No surprises! 💰`;
          session.state = 'link_sent';
          await session.save();
        }

        // Main help/booking request
        else if ((session.state === 'new' || !session.state) && includesAny(lower, ['help', 'need', 'book', 'plumber', 'plumbing', 'i need', 'i want', 'service', 'repair', 'fix'])) {
          replyText = `I'm here to help! 🔧 Which plumbing service do you need?\n\n• Plumbing (leaks, clogs, taps)\n• Drain cleaning\n• Water heater / geyser\n• Pipe repair / replacement\n• Bathroom fitting / installation\n• Electrical (minor)\n• Other\n\nJust reply with the service type you need!`;
          session.state = 'awaiting_service';
          session.service = null;
          await session.save();
        }

        // Waiting for service selection
        else if (session.state === 'awaiting_service') {
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
        }

        // Handle "other" description
        else if (session.state === 'awaiting_other_desc') {
          session.service = `Other: ${cleanMsg}`;
          session.state = 'link_sent';
          await session.save();

          const bookingLink = generateBookingLink(session.phone, session.sessionId);
          replyText = `Got it! I've noted your request: "${cleanMsg}" 📝\n\nComplete your booking here:\n${bookingLink}\n\nOur expert plumbers will review your specific needs and provide the best solution!`;
        }

        // Link sent - waiting for form completion
        else if (session.state === 'link_sent') {
          if (includesAny(lower, ['done', 'submitted', 'completed', 'filled', 'finished', 'sent'])) {
            session.state = 'submitted';
            await session.save();

            replyText = `🎉 Fantastic! Your booking request has been received.\n\n✅ Our certified plumbers will review your request\n✅ You'll receive an acceptance notification soon\n✅ Track progress at: ${BOOKING_LINK}/login\n\nThank you for choosing PlumbPro! 🔧`;
          } else if (includesAny(lower, ['not yet', 'not done', 'haven\'t', 'no', 'still working'])) {
            const bookingLink = generateBookingLink(session.phone, session.sessionId);
            replyText = `No worries! Take your time. Your booking link is always ready:\n${bookingLink}\n\nJust reply "Done" when you've completed the form! 👍`;
          } else if (includesAny(lower, ['link', 'form', 'booking', 'again', 'resend'])) {
            const bookingLink = generateBookingLink(session.phone, session.sessionId);
            replyText = `Here's your booking link again:\n${bookingLink}\n\nReply "Done" after you've filled out the form! 📋`;
          } else {
            const bookingLink = generateBookingLink(session.phone, session.sessionId);
            replyText = `Please complete your booking form: ${bookingLink}\n\n💡 After filling it out, reply "Done" and I'll confirm everything is set! Need the link again? Just ask!`;
          }
        }

        // Already submitted - status inquiries
        else if (session.state === 'submitted') {
          if (includesAny(lower, ['status', 'update', 'when', 'accepted', 'progress', 'news'])) {
            replyText = `⏳ Your booking is being reviewed by our team. You'll get a notification once a plumber accepts your request!\n\n📱 Track live updates: ${BOOKING_LINK}/login\n\nUsually takes 30-60 minutes during business hours.`;
          } else {
            replyText = `Your booking request is submitted! 🎯\n\n📱 Track status: ${BOOKING_LINK}/login\n💬 Get updates here automatically\n🔧 Our plumbers are reviewing your request\n\nNeed help with something else?`;
          }
        }

        // Fallback - try to detect direct service mention
        else {
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

        // Default fallback
        if (!replyText) {
          replyText = `Hi there! 👋 I'm here to help with your plumbing needs.\n\nSay "Help" to book a service, or describe what you need fixed. I'll take care of the rest! 🔧`;
        }

        // Save outgoing SMS and send if API is configured
        const outgoing = await saveOutgoing(session.phone, replyText);
        
        // Try to send SMS if external API is configured
        const smsResult = await sendSMS(session.phone, replyText);
        if (smsResult.success) {
          outgoing.status = 'sent';
          outgoing.messageId = smsResult.messageId;
          await outgoing.save();
        } else {
          outgoing.status = 'failed';
          await outgoing.save();
        }

        await session.save();

        results.push({
          success: true,
          message: 'SMS received and processed by agent',
          data: {
            id: smsDoc._id,
            from: smsDoc.from,
            to: smsDoc.to,
            message: smsDoc.message,
            reply: replyText,
            session: {
              phone: session.phone,
              sessionId: session.sessionId,
              state: session.state,
              service: session.service
            },
            outgoingSmsId: outgoing._id,
            smsApiResult: smsResult
          }
        });

      } catch (msgError) {
        console.error('Error processing message:', msgError);
        results.push({
          success: false,
          error: msgError.message,
          msgData
        });
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
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});

// Endpoint to handle booking completion notifications
router.post('/booking-notification', async (req, res) => {
  try {
    const { bookingId, status, phone, providerName } = req.body;

    if (!bookingId || !status || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bookingId, status, phone'
      });
    }

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

    // Save and send notification SMS
    const outgoing = await saveOutgoing(phone, message);
    const smsResult = await sendSMS(phone, message);
    
    if (smsResult.success) {
      outgoing.status = 'sent';
      outgoing.messageId = smsResult.messageId;
    } else {
      outgoing.status = 'failed';
    }
    await outgoing.save();

    res.json({
      success: true,
      message: 'Notification sent',
      smsId: outgoing._id,
      smsApiResult: smsResult
    });

  } catch (error) {
    console.error('Booking notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint
router.post('/test', async (req, res) => {
  try {
    const testMessage = req.body.message || 'Hello';
    const testPhone = req.body.phone || '1234567890';

    // Simulate the webhook format
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

    // Call our own webhook
    const result = await axios.post(`${req.protocol}://${req.get('host')}/api/sms/webhook`, simulatedWebhook);
    
    res.json({
      success: true,
      message: 'Test completed',
      input: { message: testMessage, phone: testPhone },
      webhookResult: result.data
    });

  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;