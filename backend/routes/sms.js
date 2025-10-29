const express = require('express');
const axios = require('axios');
const SMS = require('../models/SMS');
const User = require('../models/User');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');

const router = express.Router();

// Send SMS endpoint
router.post('/send', async (req, res) => {
  try {
    const { number, message, deviceId = '2', priority = '1' } = req.body;

    if (!number || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number and message are required' 
      });
    }

    // Create SMS record
    const sms = new SMS({
      from: process.env.SMS_SENDER_NUMBER || 'System',
      to: number,
      message,
      type: 'sent',
      status: 'pending',
      deviceId
    });

    await sms.save();

    // Prepare request to SensorEquation API
    const sensorApiUrl = `${process.env.SENSOR_API_BASE_URL}/services/send-message.php`;
    const params = {
      key: process.env.SENSOR_API_KEY,
      number: number,
      message: message,
      devices: deviceId,
      type: 'sms',
      prioritize: priority
    };

    try {
      // Make request to SensorEquation API
      const response = await axios.post(sensorApiUrl, null, { params });
      
      // Update SMS status based on response
      sms.status = response.data.success ? 'sent' : 'failed';
      sms.messageId = response.data.messageId || `msg_${Date.now()}`;
      await sms.save();

      // Send to webhook for processing
      if (process.env.WEBHOOK_URL) {
        await processWebhook({
          type: 'sms_sent',
          sms: sms.toObject(),
          response: response.data
        });
      }

      res.json({
        success: true,
        message: 'SMS sent successfully',
        data: {
          smsId: sms._id,
          messageId: sms.messageId,
          status: sms.status,
          sentTo: number,
          message: message
        }
      });

    } catch (apiError) {
      sms.status = 'failed';
      await sms.save();

      console.error('SensorEquation API Error:', apiError.message);
      res.status(500).json({
        success: false,
        message: 'Failed to send SMS through provider',
        error: apiError.message
      });
    }

  } catch (error) {
    console.error('SMS Send Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending SMS',
      error: error.message
    });
  }
});

// Webhook endpoint for incoming SMS/responses
router.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', JSON.stringify(req.body, null, 2));

    // Process the webhook data
    await processWebhook(req.body);

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message
    });
  }
});

// Process help requests
router.post('/help-request', async (req, res) => {
  try {
    const { phone, message = 'I need help', userInfo } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Check if user exists
    let user = await User.findOne({ phone });
    if (!user && userInfo) {
      // Create new user if provided
      user = new User({
        name: userInfo.name || 'Unknown',
        email: userInfo.email || `${phone}@temp.com`,
        phone: phone,
        password: 'temp123', // This should be handled properly in real app
        role: 'customer'
      });
      await user.save();
    }

    // Create SMS record for help request
    const helpSMS = new SMS({
      from: phone,
      to: process.env.SMS_SYSTEM_NUMBER || process.env.SMS_SENDER_NUMBER,
      message,
      type: 'received',
      status: 'received',
      user: user?._id
    });

    await helpSMS.save();

    // Process help request through webhook
    const webhookData = {
      info: {
        _postman_id: `help_${Date.now()}`,
        name: "HelpRequestSMS",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      item: [
        {
          name: "HelpRequestReceived",
          request: {
            method: "POST",
            header: [],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                phone,
                message,
                timestamp: new Date().toISOString(),
                user: user ? {
                  id: user._id,
                  name: user.name,
                  email: user.email
                } : null
              }),
              options: {
                raw: {
                  language: "json"
                }
              }
            },
            url: {
              raw: process.env.WEBHOOK_URL || "https://webhook.site/your-webhook-id",
              protocol: "https",
              host: process.env.WEBHOOK_URL?.split('://')[1]?.split('/')[0]?.split('.') || ["webhook", "site"],
              path: process.env.WEBHOOK_URL?.split('://')[1]?.split('/').slice(1) || ["your-webhook-id"]
            }
          }
        }
      ]
    };

    // Send to webhook
    if (process.env.WEBHOOK_URL) {
      await processWebhook(webhookData);
    }

    // Auto-respond to help request
    const autoResponse = "Thank you for your help request. Our team will contact you shortly. For urgent matters, please call our emergency line.";
    
    // Send auto-response SMS
    if (process.env.SENSOR_API_KEY && process.env.SENSOR_API_BASE_URL) {
      try {
        const sensorApiUrl = `${process.env.SENSOR_API_BASE_URL}/services/send-message.php`;
        const params = {
          key: process.env.SENSOR_API_KEY,
          number: phone,
          message: autoResponse,
          devices: '2',
          type: 'sms',
          prioritize: '1'
        };

        const response = await axios.post(sensorApiUrl, null, { params });
        
        // Create SMS record for auto-response
        const responseSMS = new SMS({
          from: process.env.SMS_SENDER_NUMBER || 'System',
          to: phone,
          message: autoResponse,
          type: 'sent',
          status: response.data.success ? 'sent' : 'failed',
          messageId: response.data.messageId || `auto_${Date.now()}`,
          user: user?._id
        });

        await responseSMS.save();
      } catch (autoResponseError) {
        console.error('Auto-response SMS failed:', autoResponseError.message);
      }
    }

    res.json({
      success: true,
      message: 'Help request processed successfully',
      data: {
        helpRequestId: helpSMS._id,
        phone,
        message,
        user: user ? {
          id: user._id,
          name: user.name
        } : null,
        autoResponseSent: true
      }
    });

  } catch (error) {
    console.error('Help request processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process help request',
      error: error.message
    });
  }
});

// Read SMS messages
router.post('/read-messages', auth, async (req, res) => {
  try {
    const { 
      groupID, 
      status = 'Received', 
      deviceID = '2', 
      simSlot = '0',
      startTimestamp,
      endTimestamp 
    } = req.body;

    if (!process.env.SENSOR_API_KEY || !process.env.SENSOR_GROUP_ID) {
      return res.status(400).json({
        success: false,
        message: 'SMS API configuration missing'
      });
    }

    const sensorApiUrl = `${process.env.SENSOR_API_BASE_URL}/services/read-messages.php`;
    const params = {
      key: process.env.SENSOR_API_KEY,
      groupID: groupID || process.env.SENSOR_GROUP_ID,
      status,
      deviceID,
      simSlot
    };

    // Add timestamp filters if provided
    if (startTimestamp) params.startTimestamp = startTimestamp;
    if (endTimestamp) params.endTimestamp = endTimestamp;

    try {
      const response = await axios.post(sensorApiUrl, null, { params });
      
      // Store received messages in database
      if (response.data.messages && Array.isArray(response.data.messages)) {
        for (const msg of response.data.messages) {
          const existingSMS = await SMS.findOne({ 
            messageId: msg.id || msg.messageId 
          });

          if (!existingSMS) {
            const sms = new SMS({
              messageId: msg.id || msg.messageId,
              from: msg.from || msg.sender,
              to: msg.to || msg.receiver,
              message: msg.message || msg.text,
              type: 'received',
              status: 'received',
              deviceId: msg.deviceId || deviceID,
              simSlot: msg.simSlot || simSlot,
              timestamp: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
              webhookData: msg
            });

            await sms.save();
          }
        }
      }

      res.json({
        success: true,
        message: 'Messages retrieved successfully',
        data: response.data
      });

    } catch (apiError) {
      console.error('SensorEquation Read API Error:', apiError.message);
      res.status(500).json({
        success: false,
        message: 'Failed to read messages from provider',
        error: apiError.message
      });
    }

  } catch (error) {
    console.error('Read messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while reading messages',
      error: error.message
    });
  }
});

// Get SMS history
router.get('/history', auth, async (req, res) => {
  try {
    const { phone, type, status, page = 1, limit = 50 } = req.query;
    
    let filter = {};
    
    // Filter by user if not admin
    if (req.user.role !== 'admin') {
      filter.user = req.user.userId;
    }

    if (phone) {
      filter.$or = [
        { from: phone },
        { to: phone }
      ];
    }

    if (type) filter.type = type;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const messages = await SMS.find(filter)
      .populate('user', 'name email phone')
      .populate('booking', 'customerName serviceType status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SMS.countDocuments(filter);

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      }
    });

  } catch (error) {
    console.error('SMS history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve SMS history',
      error: error.message
    });
  }
});

// Test webhook endpoint (for Postman testing)
router.post('/test-webhook', async (req, res) => {
  try {
    console.log('Test webhook called with body:', JSON.stringify(req.body, null, 2));
    
    // Simulate processing the webhook data
    const webhookData = req.body;
    
    // Process each item in the collection if it follows Postman format
    if (webhookData.item && Array.isArray(webhookData.item)) {
      const results = [];
      
      for (const item of webhookData.item) {
        if (item.request && item.request.url) {
          const result = {
            name: item.name,
            method: item.request.method,
            url: item.request.url.raw || item.request.url,
            processed: true,
            timestamp: new Date()
          };
          
          // Extract message data from URL params if it's a send-message request
          if (item.request.url.raw && item.request.url.raw.includes('send-message.php')) {
            const url = new URL(item.request.url.raw);
            const params = url.searchParams;
            
            if (params.get('message') && params.get('number')) {
              // Create SMS record
              const sms = new SMS({
                from: process.env.SMS_SENDER_NUMBER || 'System',
                to: params.get('number'),
                message: params.get('message'),
                type: 'sent',
                status: 'sent',
                deviceId: params.get('devices') || '2',
                messageId: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              });
              
              await sms.save();
              result.smsId = sms._id;
              result.messageData = {
                to: params.get('number'),
                message: params.get('message')
              };
            }
          }
          
          results.push(result);
        }
      }
      
      return res.json({
        success: true,
        message: 'Test webhook processed successfully',
        data: {
          collectionName: webhookData.info?.name || 'Unknown',
          itemsProcessed: results.length,
          results
        }
      });
    }
    
    // Handle simple webhook data
    res.json({
      success: true,
      message: 'Test webhook received and processed',
      data: {
        received: webhookData,
        processed: true,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Test webhook processing failed',
      error: error.message
    });
  }
});

// Helper function to process webhook data
async function processWebhook(data) {
  try {
    // Send to external webhook if configured
    if (process.env.WEBHOOK_URL) {
      await axios.post(process.env.WEBHOOK_URL, data, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.WEBHOOK_TOKEN ? `Bearer ${process.env.WEBHOOK_TOKEN}` : undefined
        },
        timeout: 10000
      });
    }

    console.log('Webhook data processed successfully');
  } catch (error) {
    console.error('Webhook processing failed:', error.message);
    // Don't throw error to prevent main operation failure
  }
}

module.exports = router;