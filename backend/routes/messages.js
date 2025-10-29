import express from 'express';
import Message from '../models/Message.js';

const router = express.Router();

// Get all messages with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    // Filter by phone number if provided
    if (req.query.phone) {
      const phone = req.query.phone.replace(/\D/g, '');
      filter.$or = [
        { from: phone },
        { to: phone }
      ];
    }
    
    // Filter by read status
    if (req.query.unread === 'true') {
      filter.isRead = false;
    }
    
    // Don't include archived messages by default
    if (req.query.archived !== 'true') {
      filter.isArchived = false;
    }
    
    const messages = await Message.find(filter)
      .sort({ receivedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Message.countDocuments(filter);
    
    res.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get conversation with a specific phone number
router.get('/conversation/:phone', async (req, res) => {
  try {
    const phone = req.params.phone.replace(/\D/g, '');
    const limit = parseInt(req.query.limit) || 100;
    
    const messages = await Message.getConversation(phone, limit);
    
    res.json({ messages: messages.reverse() });
    
  } catch (error) {
    console.error('❌ Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Get message by ID
router.get('/:id', async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    res.json({ message });
    
  } catch (error) {
    console.error('❌ Error fetching message:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// Mark message as read
router.patch('/:id/read', async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    await message.markAsRead();
    
    res.json({ 
      message: 'Message marked as read',
      messageId: message._id
    });
    
  } catch (error) {
    console.error('❌ Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Archive message
router.patch('/:id/archive', async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    await message.archive();
    
    res.json({ 
      message: 'Message archived',
      messageId: message._id
    });
    
  } catch (error) {
    console.error('❌ Error archiving message:', error);
    res.status(500).json({ error: 'Failed to archive message' });
  }
});

// Delete message
router.delete('/:id', async (req, res) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    res.json({ 
      message: 'Message deleted',
      messageId: message._id
    });
    
  } catch (error) {
    console.error('❌ Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Get message statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await Message.aggregate([
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          unreadMessages: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
          },
          todayMessages: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    '$receivedAt',
                    new Date(new Date().setHours(0, 0, 0, 0))
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    const summary = stats[0] || {
      totalMessages: 0,
      unreadMessages: 0,
      todayMessages: 0
    };
    
    res.json(summary);
    
  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;