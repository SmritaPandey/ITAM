'use client';
import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { Sparkles, X, Send, Trash2, Square, Zap, Shield, FileText, CheckCircle, Bot, User, ChevronDown } from 'lucide-react';
import { useAiChat, ChatMessage } from '@/lib/useAiChat';
import { safeFetch } from '@/lib/api';

// ─── Keyframe injection (runs once) ────────────────────────────
const STYLES_INJECTED = typeof document !== 'undefined' && (() => {
  const id = '__ai-copilot-styles';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes aiPulseGlow {
        0%, 100% { box-shadow: 0 0 20px rgba(6,182,212,0.3), 0 0 40px rgba(139,92,246,0.15); }
        50% { box-shadow: 0 0 30px rgba(6,182,212,0.5), 0 0 60px rgba(139,92,246,0.25); }
      }
      @keyframes aiPanelSlideUp {
        from { opacity: 0; transform: translateY(20px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes aiPanelSlideDown {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to { opacity: 0; transform: translateY(20px) scale(0.96); }
      }
      @keyframes aiFabEnter {
        from { opacity: 0; transform: scale(0.5); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes aiBounce1 {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-6px); }
      }
      @keyframes aiBounce2 {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-6px); }
      }
      @keyframes aiBounce3 {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-6px); }
      }
      @keyframes aiSparkleRotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  return true;
})();

// Suppress unused var warning
void STYLES_INJECTED;

// ─── Simple markdown renderer ──────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  const blocks = text.split(/\n{2,}/);
  const result: React.ReactNode[] = [];

  blocks.forEach((block, bi) => {
    const trimmed = block.trim();
    if (!trimmed) return;

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const lines = trimmed.split('\n');
      const code = lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined).join('\n');
      result.push(
        <pre key={`cb-${bi}`} style={{
          background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 12px',
          margin: '6px 0', fontSize: 11.5, lineHeight: 1.5, overflowX: 'auto',
          border: '1px solid rgba(255,255,255,0.06)', fontFamily: "'SF Mono', 'Fira Code', monospace",
        }}>
          <code style={{ color: '#e2e8f0' }}>{code}</code>
        </pre>
      );
      return;
    }

    // Check for bullet list
    const lines = trimmed.split('\n');
    const isBulletList = lines.every(l => /^[\s]*[-*•]\s/.test(l));
    const isNumberedList = lines.every(l => /^[\s]*\d+[.)]\s/.test(l));

    if (isBulletList) {
      result.push(
        <ul key={`ul-${bi}`} style={{ margin: '4px 0', paddingLeft: 18, listStyleType: 'disc' }}>
          {lines.map((l, li) => (
            <li key={li} style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)', marginBottom: 2 }}>
              {renderInline(l.replace(/^[\s]*[-*•]\s/, ''))}
            </li>
          ))}
        </ul>
      );
      return;
    }

    if (isNumberedList) {
      result.push(
        <ol key={`ol-${bi}`} style={{ margin: '4px 0', paddingLeft: 18 }}>
          {lines.map((l, li) => (
            <li key={li} style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)', marginBottom: 2 }}>
              {renderInline(l.replace(/^[\s]*\d+[.)]\s/, ''))}
            </li>
          ))}
        </ol>
      );
      return;
    }

    // Regular paragraph — handle line breaks within
    result.push(
      <p key={`p-${bi}`} style={{ margin: '4px 0', fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
        {lines.map((line, li) => (
          <Fragment key={li}>
            {li > 0 && <br />}
            {renderInline(line)}
          </Fragment>
        ))}
      </p>
    );
  });

  return result;
}

function renderInline(text: string): React.ReactNode[] {
  // Process bold, inline code
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // Bold
      parts.push(<strong key={`b-${match.index}`} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{match[2]}</strong>);
    } else if (match[3]) {
      // Inline code
      parts.push(
        <code key={`c-${match.index}`} style={{
          background: 'rgba(6,182,212,0.12)', color: '#67e8f9',
          padding: '1px 5px', borderRadius: 4, fontSize: '0.9em',
          fontFamily: "'SF Mono', 'Fira Code', monospace",
        }}>
          {match[3]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : [text];
}

// ─── Quick action chips ────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Analyze Assets', icon: Zap, prompt: 'Give me an overview analysis of our current IT asset inventory, including any concerns or recommendations.' },
  { label: 'Risk Summary', icon: Shield, prompt: 'Provide a risk summary of our infrastructure, highlighting any critical vulnerabilities or compliance gaps.' },
  { label: 'Patch Status', icon: FileText, prompt: 'What is the current patch compliance status? Highlight any critical patches that need attention.' },
  { label: 'Compliance Review', icon: CheckCircle, prompt: 'Run a compliance review and list any assets or configurations that are out of compliance.' },
];

// ─── Typing indicator ──────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--brand-400)',
          animation: `aiBounce${i + 1} 1.4s ease-in-out ${i * 0.16}s infinite`,
          opacity: 0.7,
        }} />
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────
export default function AiCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [input, setInput] = useState('');
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const { messages, isLoading, error, sendMessage, clearChat, stopGenerating } = useAiChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check AI health on mount
  useEffect(() => {
    safeFetch<any>('/ai/health').then(data => setAiAvailable(data?.available ?? false));
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Keyboard shortcut: Ctrl+. or Cmd+. to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault();
        togglePanel();
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        closePanel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect scroll position to show scroll-to-bottom button
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowScrollBtn(!atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const togglePanel = useCallback(() => {
    if (isOpen) {
      closePanel();
    } else {
      setIsOpen(true);
      setIsClosing(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const closePanel = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 200);
  }, []);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleQuickAction = useCallback((prompt: string) => {
    sendMessage(prompt);
  }, [sendMessage]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
  }, []);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={togglePanel}
        aria-label="Toggle AI Copilot"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
          color: '#fff',
          display: isOpen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'aiFabEnter 0.3s ease-out, aiPulseGlow 3s ease-in-out infinite',
          transition: 'transform 0.2s',
          boxShadow: '0 4px 20px rgba(6,182,212,0.3)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      >
        <Sparkles size={22} />
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 420,
            maxWidth: 'calc(100vw - 32px)',
            height: 600,
            maxHeight: 'calc(100vh - 48px)',
            borderRadius: 16,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            // Glassmorphism
            background: 'rgba(15, 18, 35, 0.85)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(6,182,212,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
            animation: isClosing ? 'aiPanelSlideDown 0.2s ease-in forwards' : 'aiPanelSlideUp 0.3s ease-out',
          }}
        >
          {/* ─── Header ──────────────────────────────────── */}
          <div style={{
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
            flexShrink: 0,
          }}>
            {/* AI icon */}
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(6,182,212,0.2)',
            }}>
              <Sparkles size={16} style={{ color: '#67e8f9' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
                AI Copilot
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>
                {aiAvailable === false ? 'Offline' : isLoading ? 'Thinking…' : 'Ready'}
              </div>
            </div>
            {/* Action buttons */}
            <button
              onClick={clearChat}
              title="Clear conversation"
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: '#94a3b8', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
              }}
            >
              <Trash2 size={12} />
              Clear
            </button>
            <button
              onClick={closePanel}
              title="Close (Esc)"
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#94a3b8', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)';
                (e.currentTarget as HTMLButtonElement).style.color = '#fca5a5';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* ─── Messages ────────────────────────────────── */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.08) transparent',
            }}
          >
            {/* AI unavailable state */}
            {aiAvailable === false && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
                padding: 24, textAlign: 'center',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(139,92,246,0.1))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <Sparkles size={24} style={{ color: '#475569' }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8' }}>
                  AI Copilot is being set up
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, maxWidth: 280 }}>
                  Configure <code style={{
                    fontSize: 11, padding: '1px 5px', borderRadius: 3,
                    background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
                  }}>AI_ENABLED=true</code> to activate intelligent assistance.
                </div>
              </div>
            )}

            {/* Empty state */}
            {aiAvailable !== false && messages.length === 0 && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
                padding: 24, textAlign: 'center',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(139,92,246,0.15))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(6,182,212,0.15)',
                }}>
                  <Bot size={26} style={{ color: '#67e8f9' }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>
                  How can I help?
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, maxWidth: 280 }}>
                  Ask me about your assets, security posture, compliance, patches, or anything in your IT environment.
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg: ChatMessage) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                {/* Assistant avatar */}
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 2,
                    background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(139,92,246,0.15))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(6,182,212,0.12)',
                  }}>
                    <Sparkles size={12} style={{ color: '#67e8f9' }} />
                  </div>
                )}

                {/* Message bubble */}
                <div style={{
                  maxWidth: msg.role === 'user' ? '80%' : '88%',
                  padding: msg.role === 'user' ? '8px 12px' : '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(139,92,246,0.2))'
                    : 'rgba(255,255,255,0.04)',
                  border: msg.role === 'user'
                    ? '1px solid rgba(6,182,212,0.2)'
                    : '1px solid rgba(255,255,255,0.05)',
                }}>
                  {msg.loading ? (
                    <TypingIndicator />
                  ) : msg.role === 'assistant' ? (
                    <div>{renderMarkdown(msg.content)}</div>
                  ) : (
                    <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </div>
                  )}

                  {/* Tools used badge */}
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8,
                      paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)',
                    }}>
                      {msg.toolsUsed.map((tool, i) => (
                        <span key={i} style={{
                          fontSize: 9.5, padding: '2px 6px', borderRadius: 4,
                          background: 'rgba(6,182,212,0.1)', color: '#67e8f9',
                          border: '1px solid rgba(6,182,212,0.15)',
                        }}>
                          ⚡ {tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* User avatar */}
                {msg.role === 'user' && (
                  <div style={{
                    width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 2,
                    background: 'rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <User size={12} style={{ color: '#94a3b8' }} />
                  </div>
                )}
              </div>
            ))}

            {/* Error message */}
            {error && !isLoading && (
              <div style={{
                fontSize: 11.5, color: '#fca5a5', padding: '6px 10px',
                background: 'rgba(239,68,68,0.08)', borderRadius: 8,
                border: '1px solid rgba(239,68,68,0.15)', textAlign: 'center',
              }}>
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Scroll to bottom button */}
          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              style={{
                position: 'absolute', bottom: 140, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(15,18,35,0.9)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: '#94a3b8', backdropFilter: 'blur(8px)',
                transition: 'all 0.15s',
              }}
            >
              <ChevronDown size={12} />
              New messages
            </button>
          )}

          {/* ─── Quick Actions ───────────────────────────── */}
          {aiAvailable !== false && messages.length === 0 && (
            <div style={{
              padding: '6px 14px 2px',
              display: 'flex', flexWrap: 'wrap', gap: 6,
              borderTop: '1px solid rgba(255,255,255,0.04)',
            }}>
              {QUICK_ACTIONS.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.prompt)}
                    disabled={isLoading}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 20, padding: '5px 11px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 11, color: '#94a3b8', transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(6,182,212,0.1)';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(6,182,212,0.2)';
                      (e.currentTarget as HTMLButtonElement).style.color = '#67e8f9';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.06)';
                      (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
                    }}
                  >
                    <ActionIcon size={11} />
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ─── Input Area ──────────────────────────────── */}
          <div style={{
            padding: '10px 14px 14px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
            flexShrink: 0,
          }}>
            {/* Stop generating */}
            {isLoading && (
              <button
                onClick={stopGenerating}
                style={{
                  width: '100%', marginBottom: 8,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                  borderRadius: 8, padding: '6px 0', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontSize: 11.5, color: '#fca5a5', transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)';
                }}
              >
                <Square size={11} />
                Stop generating
              </button>
            )}

            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '6px 6px 6px 12px',
              transition: 'border-color 0.2s',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={aiAvailable === false ? 'AI is not available…' : 'Ask anything about your assets…'}
                disabled={aiAvailable === false}
                rows={1}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: '#e2e8f0', fontSize: 13, lineHeight: 1.5,
                  resize: 'none', fontFamily: 'inherit', padding: '4px 0',
                  maxHeight: 100, minHeight: 20,
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || aiAvailable === false}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  background: input.trim() && !isLoading
                    ? 'linear-gradient(135deg, #06b6d4, #8b5cf6)'
                    : 'rgba(255,255,255,0.06)',
                  color: input.trim() && !isLoading ? '#fff' : '#475569',
                  cursor: input.trim() && !isLoading ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.2s',
                }}
              >
                <Send size={14} />
              </button>
            </div>

            {/* Shortcut hint */}
            <div style={{
              fontSize: 10, color: '#475569', textAlign: 'center', marginTop: 6,
            }}>
              <kbd style={{
                padding: '1px 4px', borderRadius: 3, fontSize: 9,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              }}>⌘</kbd>
              {' + '}
              <kbd style={{
                padding: '1px 4px', borderRadius: 3, fontSize: 9,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              }}>.</kbd>
              {' to toggle'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
