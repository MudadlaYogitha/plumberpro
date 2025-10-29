import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  Users,
  Shield,
  ArrowRight,
  Send,
  MessageCircle,
  X
} from 'lucide-react';

const API_URL =
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_SMS_WEBHOOK) ||
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SMS_WEBHOOK) ||
  (typeof window !== 'undefined' && window.REACT_APP_SMS_WEBHOOK) ||
  '/api/sms/webhook';

function useScrollToBottom(dep) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [dep]);
  return ref;
}

const ChatMessage = ({ m }) => {
  const isUser = m.from === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[80%] px-4 py-2 rounded-2xl break-words shadow-sm ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none'
            : 'bg-gray-100 text-gray-900 rounded-bl-none'
        }`}
      >
        <div className="text-sm">{m.text}</div>
        <div
          className={`text-[10px] mt-1 ${
            isUser ? 'text-blue-200' : 'text-gray-500'
          }`}
        >
          {new Date(m.ts).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
};

export default function LandingPage() {
  // ---- 🧩 CHAT STATE ----
  const [guestId] = useState(() => `guest_${Date.now().toString().slice(-6)}`); // New ID each reload
  const [phone, setPhone] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]); // No persistence
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false); // Collapsible chat
  const scrollRef = useScrollToBottom(messages.length);

  const appendMessage = (m) => setMessages((prev) => [...prev, m]);

  async function sendMessage() {
    if (!input.trim()) return;
    setError(null);

    const userMsg = {
      id: `u_${Date.now()}`,
      from: 'user',
      text: input.trim(),
      ts: Date.now()
    };
    appendMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      const body = {
        phone: phone.trim() || guestId,
        message: userMsg.text
      };
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const json = await res.json();
      const replyText =
        json?.agent?.reply ??
        json?.reply ??
        json?.message ??
        'No reply returned';

      appendMessage({
        id: `s_${Date.now()}`,
        from: 'agent',
        text: replyText,
        ts: Date.now()
      });
    } catch (err) {
      console.error('Chat send error:', err);
      setError(err.message || 'Failed to send');
      appendMessage({
        id: `e_${Date.now()}`,
        from: 'agent',
        text: `Error: ${err.message || 'Failed to send'}`,
        ts: Date.now()
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ---- 🧱 PAGE UI ----
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="flex items-center justify-center mb-6">
            <Wrench className="w-16 h-16 text-blue-600" />
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6">
            Professional <span className="text-blue-600">Plumbing</span> Services
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Connect with certified plumbing professionals for all your needs.
            Book services, track progress, and manage payments seamlessly.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Customers */}
            <div className="bg-white p-8 rounded-2xl shadow-soft hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4">For Customers</h3>
              <p className="text-gray-600 mb-6">
                Book plumbing services, track your orders, and manage payments easily.
              </p>
              <Link
                to="/register?role=customer"
                className="block w-full btn-primary text-center"
              >
                Get Started <ArrowRight className="w-4 h-4 inline" />
              </Link>
            </div>

            {/* Providers */}
            <div className="bg-white p-8 rounded-2xl shadow-soft hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wrench className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4">For Providers</h3>
              <p className="text-gray-600 mb-6">
                Join our network and grow your plumbing business.
              </p>
              <Link
                to="/register?role=provider"
                className="block w-full btn-primary text-center"
              >
                Join Network <ArrowRight className="w-4 h-4 inline" />
              </Link>
            </div>

            {/* Admin */}
            <div className="bg-white p-8 rounded-2xl shadow-soft hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Admin Portal</h3>
              <p className="text-gray-600 mb-6">
                Manage users, providers, and system operations.
              </p>
              <Link to="/login" className="block w-full btn-primary text-center">
                Admin Access <ArrowRight className="w-4 h-4 inline" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 text-center">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center mb-4">
            <Wrench className="w-8 h-8 text-blue-400 mr-2" />
            <span className="text-2xl font-bold">PlumbPro</span>
          </div>
          <p className="text-gray-400 mb-8">
            Professional plumbing services at your fingertips
          </p>
          <div className="text-sm text-gray-500">
            © 2025 PlumbPro. All rights reserved.
          </div>
        </div>
      </footer>

      {/* ---- 💬 Collapsible Chat Widget ---- */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg flex items-center justify-center z-50"
          aria-label="Open chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-4 right-4 w-[90%] sm:w-96 z-50 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-blue-600 text-white">
            <MessageCircle className="w-5 h-5" />
            <div className="flex-1">
              <div className="font-semibold">PlumbPro Assistant</div>
              <div className="text-xs opacity-90">
                Chatting as <b>{guestId}</b>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)}>
              <X className="w-5 h-5 opacity-80 hover:opacity-100" />
            </button>
          </div>

          {/* Chat content */}
          <div className="p-3 h-64 flex flex-col">
            <div className="mb-2">
              <label className="text-xs text-gray-500">
                Optional: Phone for booking
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
                placeholder="Enter if booking"
              />
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-auto px-1 py-2 space-y-1"
            >
              {messages.length === 0 && (
                <div className="text-center text-sm text-gray-400 mt-6">
                  Start by saying hi 👋
                </div>
              )}
              {messages.map((m) => (
                <ChatMessage key={m.id} m={m} />
              ))}
            </div>

            <div className="mt-2">
              {error && (
                <div className="text-red-600 text-xs mb-1">{error}</div>
              )}
              <div className="flex items-center gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  className="flex-1 resize-none border rounded-md px-3 py-2 text-sm"
                  placeholder="Type a message... (press Enter)"
                />
                <button
                  onClick={sendMessage}
                  disabled={loading}
                  className={`p-2 rounded-md ${
                    loading
                      ? 'bg-gray-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="px-3 py-2 border-t text-xs text-gray-500 flex items-center justify-between">
            <div>Powered by PlumbPro SMS Agent</div>
            <button
              onClick={() => setMessages([])}
              className="text-blue-600 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
