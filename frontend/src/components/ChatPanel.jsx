import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:8000' : '');

const SUGGESTED_QUERIES = [
  "Which products have the most billing documents?",
  "Find sales orders with broken flows",
  "Trace the full flow of billing document 91150187",
];

export default function ChatPanel() {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hi! I can help you analyze the Order to Cash process.\n\nTry asking about sales orders, deliveries, billing documents, or broken flows.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendQuery = async (text) => {
    if (!text.trim() || loading) return;
    
    const userMsg = text.trim();
    setInput('');
    
    const newMessages = [...messages, { role: 'user', text: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiHistory = messages.slice(1).map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.text
      }));
      
      const res = await axios.post(`${API_BASE}/chat`, { 
        message: userMsg,
        history: apiHistory
      });
      setMessages([...newMessages, { role: 'bot', text: res.data.reply }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'bot', text: '⚠️ Could not connect to the backend.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    sendQuery(input);
  };

  return (
    <div className="chat-pane">
      <div className="chat-header">
        <div className="chat-header-top-label">Chat with Graph</div>
        <div className="chat-header-top-sublabel">Order to Cash</div>
        <div className="chat-header-top">
          <div className="chat-avatar">
            <Bot size={18} color="#fff" />
          </div>
          <div>
            <h2>Dodge AI</h2>
            <p className="subtitle"><span className="status-dot" />Graph Agent</p>
          </div>
        </div>
      </div>
      
      <div className="chat-history">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-msg-row ${msg.role}`}>
            {msg.role === 'bot' && (
              <div className="chat-msg-avatar">
                <Bot size={13} color="#fff" />
              </div>
            )}
            <div className={`chat-msg ${msg.role}`}>
              {msg.role === 'bot' ? <ReactMarkdown>{msg.text}</ReactMarkdown> : msg.text}
            </div>
          </div>
        ))}

        {messages.length === 1 && !loading && (
          <div className="suggested-list">
            {SUGGESTED_QUERIES.map((q, i) => (
              <button key={i} className="suggested-btn" onClick={() => sendQuery(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="chat-msg-row bot">
            <div className="chat-msg-avatar">
              <Bot size={13} color="#fff" />
            </div>
            <div className="chat-msg bot loading">
              <div className="typing-dots">
                <span /><span /><span />
              </div>
              Analyzing...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-status">
          <span className="status-dot" /> Dodge AI is awaiting instructions
        </div>
        <form className="chat-input-row" onSubmit={handleSend}>
          <input 
            type="text" 
            className="chat-input"
            placeholder="Ask about orders, deliveries, billing..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="chat-btn" disabled={!input.trim() || loading}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
