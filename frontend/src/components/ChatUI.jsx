// src/components/ChatUI.jsx
import React, { useState } from "react";
import { api } from "../api/client";

const starterMessages = [
  { from: "bot", text: "Hey 👋 How can I help you with your money today?" },
];

const quickPrompts = [
  "How much did I spend this month?",
  "Which category did I spend the most on?",
  "Show my recent transactions.",
  "Where can I save money?",
  "How much did I spend on shopping?",
];

const ChatUI = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(starterMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { from: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/assistant/ask", { message: text });
      const reply = res.data?.reply || "I couldn't process that. Please try again.";
      setMessages((prev) => [...prev, { from: "bot", text: reply }]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          from: "bot",
          text: "Sorry, I'm having trouble connecting. Please try again later.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>FinTrack Copilot</div>
              <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>
                Ask anything about your money.
              </div>
            </div>
            <button
              className="btn-icon"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          <div className="chat-body">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`chat-bubble ${m.from === "user" ? "user" : "bot"}`}
              >
                {m.text}
              </div>
            ))}
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-soft)" }}>
              Try:
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  className="btn"
                  style={{
                    marginLeft: 4,
                    marginTop: 4,
                    fontSize: 10,
                    padding: "3px 7px",
                  }}
                  onClick={() => sendMessage(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
          >
            <input
              placeholder="Ask a question about your spends…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="btn-primary btn" type="submit">
              Send
            </button>
          </form>
        </div>
      )}

      <div className="chat-fab">
        <button
          className="btn-primary btn"
          onClick={() => setOpen((o) => !o)}
        >
          🤖 Ask FinTrack
        </button>
      </div>
    </>
  );
};

export default ChatUI;
