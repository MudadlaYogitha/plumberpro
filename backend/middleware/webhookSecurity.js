import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

// Rate limiting for webhook endpoints
export const webhookRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many webhook requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Verify webhook signature from SMS provider
export const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];
  const secret = process.env.WEBHOOK_SECRET;
  
  // Skip verification if no secret is configured (development mode)
  if (!secret) {
    console.warn('⚠️  No webhook secret configured - skipping signature verification');
    return next();
  }
  
  if (!signature) {
    console.error('❌ Missing webhook signature');
    return res.status(401).json({ 
      error: 'Missing webhook signature',
      code: 'MISSING_SIGNATURE'
    });
  }
  
  try {
    // Create expected signature
    const body = JSON.stringify(req.body);
    const payload = timestamp ? `${timestamp}.${body}` : body;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    const receivedSignature = signature.replace('sha256=', '');
    
    // Use timing-safe comparison
    if (!crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    )) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ 
        error: 'Invalid webhook signature',
        code: 'INVALID_SIGNATURE'
      });
    }
    
    console.log('✅ Webhook signature verified');
    next();
    
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    return res.status(401).json({ 
      error: 'Signature verification failed',
      code: 'VERIFICATION_ERROR'
    });
  }
};

// Validate webhook payload structure
export const validateWebhookPayload = (req, res, next) => {
  const { from, to, body } = req.body;
  
  // Check required fields
  if (!from || !to || body === undefined) {
    console.error('❌ Invalid webhook payload - missing required fields');
    return res.status(400).json({ 
      error: 'Missing required fields: from, to, body',
      code: 'INVALID_PAYLOAD',
      received: Object.keys(req.body)
    });
  }
  
  // Validate phone number format (basic validation)
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  if (!phoneRegex.test(from) || !phoneRegex.test(to)) {
    console.error('❌ Invalid phone number format');
    return res.status(400).json({ 
      error: 'Invalid phone number format',
      code: 'INVALID_PHONE_FORMAT'
    });
  }
  
  // Validate message body length
  if (typeof body !== 'string' || body.length > 1600) {
    console.error('❌ Invalid message body');
    return res.status(400).json({ 
      error: 'Message body must be a string with max 1600 characters',
      code: 'INVALID_BODY'
    });
  }
  
  console.log('✅ Webhook payload validated');
  next();
};

// Log webhook requests for debugging
export const logWebhookRequest = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];
  
  console.log(`📥 Webhook Request [${timestamp}]`);
  console.log(`   IP: ${ip}`);
  console.log(`   User-Agent: ${userAgent}`);
  console.log(`   Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`   Body:`, JSON.stringify(req.body, null, 2));
  
  next();
};