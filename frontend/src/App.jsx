import { useState, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";

const COLORS = {
  bg: "#F7F5F0",
  surface: "#FFFFFF",
  surfaceAlt: "#F0EDE6",
  border: "#E5E0D8",
  borderLight: "#EDE9E2",
  primary: "#4A7C6F",
  primaryLight: "#EAF2F0",
  primaryDark: "#3A6358",
  userBubble: "#4A7C6F",
  userText: "#FFFFFF",
  text: "#2C2C2C",
  textMuted: "#8A8580",
  textLight: "#B5B0A8",
  news: { bg: "#FFF8EC", text: "#8A6020", border: "#F5E4C0" },
  followup: { bg: "#F0EDF8", text: "#5A4580", border: "#DDD5F0" },
  factual: { bg: "#EAF2F0", text: "#3A6358", border: "#C8DDD8" },
  streaming: { bg: "#EAF2F0", text: "#4A7C6F", border: "#C8DDD8" },
  scoreHigh: "#4A7C6F",
  scoreMid: "#B87A2A",
  scoreLow: "#B05040",
  confidence: {
    90: { bg: "#EAF2F0", text: "#3A6358" },
    75: { bg: "#EBF3FB", text: "#2A5A8A" },
    60: { bg: "#FFF8EC", text: "#8A6020" },
    0:  { bg: "#FBEAE8", text: "#8A3020" },
  }
};

const getConfColor = (score) => {
  if (score >= 90) return COLORS.confidence[90];
  if (score >= 75) return COLORS.confidence[75];
  if (score >= 60) return COLORS.confidence[60];
  return COLORS.confidence[0];
};

const getScoreColor = (score) => {
  if (score >= 75) return COLORS.scoreHigh;
  if (score >= 60) return COLORS.scoreMid;
  return COLORS.scoreLow;
};

const formatTime = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const parseStreamedText = (text) => {
  const headline = text.match(/HEADLINE:\s*(.+)/)?.[1]?.trim() || "";
  const summary = text.match(/SUMMARY:\s*([\s\S]+?)(?=KEY POINTS:|FOLLOW-UP:|$)/)?.[1]?.trim() || "";
  const keyPointsMatch = text.match(/KEY POINTS:\s*([\s\S]+?)(?=FOLLOW-UP:|$)/)?.[1] || "";
  const key_points = keyPointsMatch.split("\n").map(l => l.replace(/^[•\-*]\s*/, "").trim()).filter(Boolean);
  const follow_up = text.match(/FOLLOW-UP:\s*(.+)/)?.[1]?.trim() || "";
  return { headline, summary, key_points, follow_up, raw: text };
};

const exportToPDF = (messages) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210, margin = 16, maxW = pageW - margin * 2;
  let y = 20;
  const checkPage = (n = 10) => { if (y + n > 280) { doc.addPage(); y = 20; } };
  const write = (text, x, size, color, style = "normal") => {
    doc.setFontSize(size); doc.setTextColor(...color); doc.setFont("helvetica", style);
    doc.splitTextToSize(String(text), maxW - (x - margin)).forEach(l => { checkPage(); doc.text(l, x, y); y += size * 0.45; });
    y += 2;
  };
  doc.setFontSize(18); doc.setTextColor(74, 124, 111); doc.setFont("helvetica", "bold");
  doc.text("AI Research Agent — Chat Export", margin, y); y += 8;
  doc.setFontSize(10); doc.setTextColor(150, 150, 150); doc.setFont("helvetica", "normal");
  doc.text(`Exported on ${new Date().toLocaleString()}`, margin, y); y += 10;
  doc.setDrawColor(220, 220, 215); doc.line(margin, y, pageW - margin, y); y += 8;
  messages.forEach((msg) => {
    if (msg.role === "user") {
      write(`You: ${msg.content}`, margin, 11, [74, 124, 111], "bold");
    } else {
      const a = msg.answer || {};
      if (a.headline) write(`${a.headline}`, margin, 12, [30, 30, 30], "bold");
      if (a.summary) write(a.summary, margin + 4, 10, [60, 60, 60]);
      if (a.key_points?.length) {
        write("Key Points:", margin + 4, 10, [80, 80, 80], "bold");
        a.key_points.forEach(p => write(`• ${p}`, margin + 8, 9, [70, 70, 70]));
      }
      if (a.follow_up) write(`Follow-up: ${a.follow_up}`, margin + 4, 9, [100, 80, 160], "italic");
    }
    y += 4; checkPage(4); doc.setDrawColor(235, 235, 228); doc.line(margin, y, pageW - margin, y); y += 6;
  });
  doc.save("ai-research-chat.pdf");
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} style={{
      padding: "3px 12px", fontSize: 11, borderRadius: 20,
      border: `1px solid ${COLORS.border}`,
      background: copied ? COLORS.primaryLight : COLORS.surface,
      color: copied ? COLORS.primary : COLORS.textMuted,
      cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit"
    }}>
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
};

const IntentBadge = ({ intent, streaming }) => (
  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
    {intent && (() => {
      const map = {
        news: { ...COLORS.news, icon: "📰", label: "News" },
        followup: { ...COLORS.followup, icon: "💬", label: "Follow-up" },
        factual: { ...COLORS.factual, icon: "📚", label: "Factual" },
      };
      const c = map[intent] || map.factual;
      return (
        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
          {c.icon} {c.label}
        </span>
      );
    })()}
    {streaming && (
      <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: COLORS.streaming.bg, color: COLORS.streaming.text, border: `1px solid ${COLORS.streaming.border}` }}>
        ⚡ Streaming
      </span>
    )}
  </div>
);

const StructuredAnswer = ({ answer, streaming }) => {
  if (!answer) return null;
  if (streaming) return (
    <div style={{ fontSize: 14, lineHeight: 1.8, color: COLORS.text, whiteSpace: "pre-wrap" }}>
      {answer.raw}
      <span style={{ display: "inline-block", width: 2, height: 16, background: COLORS.primary, marginLeft: 2, animation: "blink 1s step-end infinite", verticalAlign: "text-bottom" }} />
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {answer.headline && (
        <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, lineHeight: 1.5, paddingBottom: 12, borderBottom: `1px solid ${COLORS.borderLight}` }}>
          {answer.headline}
        </div>
      )}
      {answer.summary && (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: "#444" }}>{answer.summary}</p>
      )}
      {answer.key_points?.length > 0 && (
        <div style={{ background: COLORS.surfaceAlt, borderRadius: 12, padding: "12px 16px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.8px" }}>Key Findings</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {answer.key_points.map((point, i) => (
              <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "#444", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: COLORS.primary, fontWeight: 700, marginTop: 1, flexShrink: 0 }}>→</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
      {answer.follow_up && (
        <div style={{ background: COLORS.primaryLight, borderRadius: 10, padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-start", border: `1px solid ${COLORS.factual.border}` }}>
          <span style={{ fontSize: 13, color: COLORS.primary }}>💡</span>
          <span style={{ fontSize: 13, color: COLORS.primaryDark, lineHeight: 1.5 }}><strong>You might ask:</strong> {answer.follow_up}</span>
        </div>
      )}
    </div>
  );
};

const SourceCard = ({ src }) => (
  <div style={{
    background: COLORS.surface, border: `1px solid ${COLORS.border}`,
    borderRadius: 10, padding: "10px 14px",
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", gap: 12,
    transition: "box-shadow 0.2s",
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <a href={src.url} target="_blank" rel="noreferrer" style={{
        fontSize: 12, color: COLORS.primary, fontWeight: 600,
        textDecoration: "none", display: "block", marginBottom: 3,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
      }}>
        ↗ {src.domain}
      </a>
      <p style={{ margin: 0, fontSize: 11.5, color: COLORS.textMuted, lineHeight: 1.5 }}>{src.preview}...</p>
    </div>
    <div style={{ textAlign: "center", flexShrink: 0, minWidth: 44 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: getScoreColor(src.score) }}>{src.score}</div>
      <div style={{ fontSize: 10, color: getScoreColor(src.score), fontWeight: 500 }}>{src.label}</div>
    </div>
  </div>
);

const SuggestedQuery = ({ q, onClick }) => (
  <button onClick={() => onClick(q)} style={{
    padding: "9px 16px", borderRadius: 20,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.surface, color: COLORS.text,
    cursor: "pointer", fontSize: 13, fontFamily: "inherit",
    transition: "all 0.2s", lineHeight: 1.4,
  }}
    onMouseEnter={e => { e.target.style.borderColor = COLORS.primary; e.target.style.color = COLORS.primary; }}
    onMouseLeave={e => { e.target.style.borderColor = COLORS.border; e.target.style.color = COLORS.text; }}
  >
    {q}
  </button>
);

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const ask = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input, time: formatTime(new Date()) };
    const history = messages.map(m => ({
      role: m.role,
      content: m.role === "assistant"
        ? (m.answer?.headline || "") + " " + (m.answer?.summary || "")
        : m.content
    }));
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    const streamingMsg = {
      role: "assistant",
      answer: { raw: "", headline: "", summary: "", key_points: [], follow_up: "" },
      sources: [], confidence: 0, intent: "", streaming: true,
      time: formatTime(new Date())
    };
    setMessages(prev => [...prev, streamingMsg]);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/ask/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input, chat_history: history })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "meta") {
              setMessages(prev => {
                const updated = [...prev];
                const last = { ...updated[updated.length - 1] };
                last.intent = data.intent; last.confidence = data.confidence; last.sources = data.sources;
                updated[updated.length - 1] = last;
                return updated;
              });
            }
            if (data.type === "token") {
              accumulatedText += data.text;
              const parsed = parseStreamedText(accumulatedText);
              setMessages(prev => {
                const updated = [...prev];
                const last = { ...updated[updated.length - 1] };
                last.answer = { ...parsed }; last.streaming = true;
                updated[updated.length - 1] = last;
                return updated;
              });
            }
            if (data.type === "done") {
              const parsed = parseStreamedText(accumulatedText);
              setMessages(prev => {
                const updated = [...prev];
                const last = { ...updated[updated.length - 1] };
                last.answer = parsed; last.streaming = false;
                updated[updated.length - 1] = last;
                return updated;
              });
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          answer: { headline: "Something went wrong", summary: e.message, key_points: [], follow_up: "", raw: "" },
          streaming: false, time: formatTime(new Date())
        };
        return updated;
      });
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: COLORS.bg, fontFamily: "'Georgia', 'Times New Roman', serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .msg-appear { animation: fadeUp 0.3s ease forwards; }
        textarea:focus, input:focus { outline: none; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "16px 28px", background: COLORS.surface,
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.2px" }}>AI Research Agent</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "system-ui, sans-serif" }}>Web search · Memory · Source scoring · Streaming</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {messages.length > 0 && (
            <>
              <button onClick={() => setMessages([])} style={{
                padding: "7px 14px", borderRadius: 20, border: `1px solid ${COLORS.border}`,
                background: "transparent", color: COLORS.textMuted, cursor: "pointer",
                fontSize: 12, fontFamily: "system-ui, sans-serif"
              }}>Clear</button>
              <button onClick={() => exportToPDF(messages)} style={{
                padding: "7px 16px", borderRadius: 20,
                border: `1px solid ${COLORS.primary}`,
                background: COLORS.primaryLight, color: COLORS.primary,
                cursor: "pointer", fontSize: 12, fontWeight: 600,
                fontFamily: "system-ui, sans-serif"
              }}>Export PDF</button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 20px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 820, width: "100%", margin: "0 auto", alignSelf: "center", width: "100%" }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 20, paddingTop: 60 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: COLORS.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, border: `1px solid ${COLORS.factual.border}` }}>🔍</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>What would you like to research?</div>
              <div style={{ fontSize: 14, color: COLORS.textMuted, fontFamily: "system-ui, sans-serif" }}>I search the web, score sources, and stream answers in real time.</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 600 }}>
              {["Latest news on Iran-Israel war", "What is LangGraph?", "Top AI startups in 2025", "How does RAG work?"].map(q => (
                <SuggestedQuery key={q} q={q} onClick={setInput} />
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="msg-appear" style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: 6 }}>

            {/* Intent + streaming badges (agent only) */}
            {msg.role === "assistant" && (msg.intent || msg.streaming) && (
              <IntentBadge intent={msg.intent} streaming={msg.streaming} />
            )}

            {/* Bubble */}
            {msg.role === "user" ? (
              <div style={{
                maxWidth: "72%", padding: "12px 18px",
                borderRadius: "20px 20px 6px 20px",
                background: COLORS.userBubble, color: COLORS.userText,
                fontSize: 14.5, lineHeight: 1.7, fontFamily: "system-ui, sans-serif"
              }}>
                {msg.content}
              </div>
            ) : (
              <div style={{
                maxWidth: "88%", background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: "6px 20px 20px 20px",
                padding: "18px 20px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
              }}>
                <StructuredAnswer answer={msg.answer} streaming={msg.streaming} />
              </div>
            )}

            {/* Meta row — timestamp + copy */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              flexDirection: msg.role === "user" ? "row-reverse" : "row",
              fontFamily: "system-ui, sans-serif"
            }}>
              <span style={{ fontSize: 11, color: COLORS.textLight }}>{msg.time}</span>
              {msg.role === "assistant" && !msg.streaming && (
                <CopyButton text={[msg.answer?.headline, msg.answer?.summary, ...(msg.answer?.key_points || [])].filter(Boolean).join("\n")} />
              )}
            </div>

            {/* Sources */}
            {!msg.streaming && msg.sources?.length > 0 && (
              <div style={{ maxWidth: "88%", width: "100%", fontFamily: "system-ui, sans-serif" }}>
                {/* Confidence */}
                <div style={{ marginBottom: 8 }}>
                  {(() => { const c = getConfColor(msg.confidence); return (
                    <span style={{ background: c.bg, color: c.text, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
                      {msg.confidence >= 90 ? "✓" : msg.confidence >= 75 ? "●" : msg.confidence >= 60 ? "◐" : "○"} Source confidence: {msg.confidence}%
                    </span>
                  ); })()}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {msg.sources.map((src, j) => <SourceCard key={j} src={src} />)}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div style={{ display: "flex", gap: 6, padding: "12px 16px", background: COLORS.surface, borderRadius: "6px 20px 20px 20px", width: "fit-content", border: `1px solid ${COLORS.border}` }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.primary, opacity: 0.5, animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "16px 20px", background: COLORS.surface, borderTop: `1px solid ${COLORS.border}` }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1, background: COLORS.bg, border: `1.5px solid ${COLORS.border}`, borderRadius: 16, padding: "10px 16px", display: "flex", alignItems: "center", transition: "border-color 0.2s" }}
            onFocus={() => {}} >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && ask()}
              placeholder="Ask anything..."
              style={{
                flex: 1, background: "transparent", border: "none",
                fontSize: 14.5, color: COLORS.text, fontFamily: "system-ui, sans-serif",
                outline: "none", lineHeight: 1.5
              }}
            />
          </div>
          <button onClick={ask} disabled={loading} style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: loading ? COLORS.border : COLORS.primary,
            border: "none", cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, transition: "background 0.2s",
            transform: loading ? "none" : "scale(1)",
          }}>
            ↑
          </button>
        </div>
        <div style={{ maxWidth: 820, margin: "8px auto 0", fontFamily: "system-ui, sans-serif" }}>
          <p style={{ margin: 0, fontSize: 11, color: COLORS.textLight, textAlign: "center" }}>
            Press Enter to send · Sources scored by domain credibility
          </p>
        </div>
      </div>
    </div>
  );
}