'use client';
import { useState, useCallback, useRef } from 'react';
import { getToken, getApiBase } from '@/lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  loading?: boolean;
  toolsUsed?: string[];
}

let msgCounter = 0;
function genId(): string {
  return `msg_${Date.now()}_${++msgCounter}`;
}

export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    };

    const assistantId = genId();
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true,
    };

    setMessages(prev => [...prev, userMsg, assistantPlaceholder]);
    setIsLoading(true);
    setError(null);

    // Build conversation history for context (last 20 messages)
    const history = [...messages, userMsg]
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = getToken();
      const base = getApiBase();

      const res = await fetch(`${base}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: message.trim(), history }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `AI request failed (${res.status})`);
      }

      // Check if response is SSE stream
      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        // Handle SSE streaming
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') break;

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    accumulated += parsed.content;
                    setMessages(prev =>
                      prev.map(m =>
                        m.id === assistantId
                          ? { ...m, content: accumulated, loading: false, toolsUsed: parsed.toolsUsed }
                          : m
                      )
                    );
                  }
                  if (parsed.toolsUsed) {
                    setMessages(prev =>
                      prev.map(m =>
                        m.id === assistantId
                          ? { ...m, toolsUsed: parsed.toolsUsed }
                          : m
                      )
                    );
                  }
                } catch {
                  // Non-JSON SSE data — treat as raw text
                  accumulated += data;
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantId
                        ? { ...m, content: accumulated, loading: false }
                        : m
                    )
                  );
                }
              }
            }
          }
        }

        // Final update to ensure loading is false
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, loading: false, content: accumulated || 'No response received.' }
              : m
          )
        );
      } else {
        // Handle standard JSON response
        const data = await res.json();
        const reply = data.response || data.reply || data.content || 'No response received.';
        const toolsUsed = data.toolsUsed || [];

        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: reply, loading: false, toolsUsed }
              : m
          )
        );
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: 'Response cancelled.', loading: false }
              : m
          )
        );
      } else {
        const errorMsg = err.message || 'Something went wrong. Please try again.';
        setError(errorMsg);
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: `⚠️ ${errorMsg}`, loading: false }
              : m
          )
        );
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages, isLoading]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);

  const stopGenerating = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return { messages, isLoading, error, sendMessage, clearChat, stopGenerating };
}
