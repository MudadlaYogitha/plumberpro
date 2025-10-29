import axios from 'axios';

class SMSProviderService {
  constructor() {
    this.apiKey = process.env.SMS_PROVIDER_API_KEY;
    this.baseURL = process.env.SMS_PROVIDER_BASE_URL || 'https://connect.sensorequation.com/api';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SMS-Webhook-App/1.0'
      }
    });
  }

  // Send outbound SMS (for replies)
  async sendSMS(to, message, options = {}) {
    if (!this.apiKey) {
      throw new Error('SMS_PROVIDER_API_KEY not configured');
    }

    try {
      const payload = {
        to: to.replace(/\D/g, ''), // Clean phone number
        message: message.trim(),
        from: options.from || process.env.SMS_FROM_NUMBER,
        ...options
      };

      console.log('📤 Sending SMS:', payload);

      const response = await this.client.post('/sms/send', payload);
      
      console.log('✅ SMS sent successfully:', response.data);
      return response.data;

    } catch (error) {
      console.error('❌ Error sending SMS:', error.response?.data || error.message);
      throw new Error(`Failed to send SMS: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get account information
  async getAccountInfo() {
    if (!this.apiKey) {
      throw new Error('SMS_PROVIDER_API_KEY not configured');
    }

    try {
      const response = await this.client.get('/account');
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching account info:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get message delivery status
  async getMessageStatus(messageId) {
    if (!this.apiKey) {
      throw new Error('SMS_PROVIDER_API_KEY not configured');
    }

    try {
      const response = await this.client.get(`/sms/status/${messageId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching message status:', error.response?.data || error.message);
      throw error;
    }
  }

  // Validate webhook signature (alternative method)
  validateSignature(payload, signature, timestamp) {
    if (!this.apiKey) {
      return false;
    }

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.apiKey)
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
}

export default new SMSProviderService();