"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import rulesData from "./rules.json";

type Rule = {
  intent: string;
  keywords: string[];
  reply: string;
  options?: string[];
  source?: string;
};

type Message = {
  id: number;
  sender: "user" | "bot";
  text: string;
  time: string;
  options?: string[];
  source?: string;
  feedback?: "yes" | "no";
};

type Answer = Pick<Message, "text" | "options" | "source">;

const rules: Rule[] = rulesData;
const STORAGE_KEY = "uos-helpdesk-v2";

const sources: Record<string, { label: string; url: string }> = {
  university: {
    label: "Official UOS website",
    url: "https://uos.edu.pk/",
  },
  admissions: {
    label: "Official admission portal",
    url: "https://admissions.su.edu.pk/",
  },
};

const topics = [
  { label: "Fees", icon: "💳", question: "Fees" },
  { label: "Admissions", icon: "🎓", question: "Admission" },
  { label: "Timings", icon: "🕒", question: "Timings" },
  { label: "Library", icon: "📚", question: "Library" },
  { label: "Hostel", icon: "🏡", question: "Hostel" },
  { label: "Scholarships", icon: "✨", question: "Scholarships" },
  { label: "Transport", icon: "🚌", question: "Transport" },
  { label: "Exams", icon: "📝", question: "Exams" },
  { label: "Results", icon: "📊", question: "Results" },
  { label: "Certificates", icon: "📄", question: "Certificates" },
];

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function greeting(): Message {
  return {
    id: 0,
    sender: "bot",
    text: "Assalam-o-Alaikum! Welcome to UOS Helpdesk. Choose a topic or type your university question below.",
    time: "",
  };
}

// Match complete words or phrases, rather than parts of words.
function keywordScore(message: string, keyword: string) {
  const phrase = normalize(keyword);
  if (!phrase) return 0;

  return ` ${message} `.includes(` ${phrase} `)
    ? phrase.split(" ").length
    : 0;
}

function getAnswer(text: string): Answer {
  const message = normalize(text);

  const matches = rules
    .map((rule) => ({
      rule,
      score: Math.max(
        0,
        ...rule.keywords.map((keyword) =>
          keywordScore(message, keyword)
        )
      ),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!matches.length) {
    return {
      text: "Sorry, I couldn't match your question. Please choose a topic below or rephrase your question.",
      options: ["Admission", "Fees", "Library", "Exams"],
    };
  }

  // Group detailed rules with their main topic.
  const families = new Map<string, (typeof matches)[number]>();

  for (const match of matches) {
    const family = match.rule.intent.split("_")[0];
    if (!families.has(family)) families.set(family, match);
  }

  if (families.size > 1) {
    return {
      text: "Your question mentions more than one topic. Which would you like to explore first?",
      options: Array.from(families.values()).map(
        ({ rule }) => rule.keywords[0]
      ),
    };
  }

  const { rule } = matches[0];

  return {
    text: rule.reply,
    options: rule.options,
    source: rule.source,
  };
}

// Validate stored messages before using them.
function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;

  const message = value as Record<string, unknown>;

  return (
    typeof message.id === "number" &&
    Number.isSafeInteger(message.id) &&
    message.id >= 0 &&
    (message.sender === "user" || message.sender === "bot") &&
    typeof message.text === "string" &&
    typeof message.time === "string" &&
    (message.options === undefined ||
      (Array.isArray(message.options) &&
        message.options.every((option) => typeof option === "string"))) &&
    (message.source === undefined ||
      typeof message.source === "string") &&
    (message.feedback === undefined ||
      message.feedback === "yes" ||
      message.feedback === "no")
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([greeting()]);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const nextId = useRef(1);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every(isMessage) &&
          new Set(parsed.map((message) => message.id)).size ===
            parsed.length
        ) {
          setMessages(parsed);
          nextId.current =
            Math.max(...parsed.map((message) => message.id)) + 1;
        }
      }
    } catch {
      setSaveError(true);
    }

    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [messages, ready]);

  useEffect(() => {
    const chat = chatRef.current;

    if (chat) {
      chat.scrollTo({
        top: chat.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  function sendMessage(value: string) {
    if (!ready) return;

    const text = value.trim().replace(/\s+/g, " ");
    if (!text) return;

    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const answer = getAnswer(text);

    const userMessage: Message = {
      id: nextId.current++,
      sender: "user",
      text,
      time,
    };

    const botMessage: Message = {
      id: nextId.current++,
      sender: "bot",
      ...answer,
      time,
    };

    setMessages((previous) => [
      ...previous,
      userMessage,
      botMessage,
    ]);

    setInput("");
    setMenuOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  function newChat() {
    if (!ready) return;

    setMessages([greeting()]);
    setInput("");
    setMenuOpen(false);
    inputRef.current?.focus();
  }

  function setFeedback(id: number, feedback: "yes" | "no") {
    setMessages((previous) =>
      previous.map((message) =>
        message.id === id
          ? {
              ...message,
              feedback:
                message.feedback === feedback ? undefined : feedback,
            }
          : message
      )
    );
  }

  const hasConversation = messages.length > 1;

  return (
    <main className="flex h-dvh overflow-hidden bg-[#f7f7fc] text-slate-800">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-purple-100 bg-white p-5 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-600 text-xs font-black text-white">
            UOS
          </div>

          <div>
            <p className="font-bold">UOS Helpdesk</p>
            <p className="text-xs text-slate-400">
              Student support space
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={!ready}
          onClick={newChat}
          className="mt-6 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40"
        >
          + New Chat
        </button>

        <p className="mb-3 mt-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Explore topics
        </p>

        <nav
          aria-label="Help topics"
          className="min-h-0 flex-1 space-y-1 overflow-y-auto"
        >
          {topics.map((topic) => (
            <button
              key={topic.label}
              type="button"
              disabled={!ready}
              onClick={() => sendMessage(topic.question)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40"
            >
              <span aria-hidden="true">{topic.icon}</span>
              {topic.label}
            </button>
          ))}
        </nav>

        <div className="mt-4 rounded-2xl bg-purple-50 p-4">
          <p className="text-xs font-semibold text-purple-800">
            Your campus companion
          </p>
          <p className="mt-2 text-xs leading-5 text-purple-700">
            General guidance for everyday university questions.
          </p>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-purple-100 bg-white px-4 py-4 sm:px-8">
          <div>
            <h1 className="font-bold">UOS Helpdesk Bot</h1>
            <p className="mt-1 text-xs text-slate-400">
              Rule-based student assistant
            </p>
          </div>

          <div className="flex gap-2 lg:hidden">
            <button
              type="button"
              disabled={!ready}
              onClick={newChat}
              className="rounded-lg bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 disabled:opacity-40"
            >
              + New
            </button>

            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-topics"
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-lg bg-purple-100 px-3 py-2 text-xs font-semibold text-purple-800"
            >
              {menuOpen ? "Close" : "Topics"}
            </button>
          </div>
        </header>

        {menuOpen && (
          <nav
            id="mobile-topics"
            aria-label="Mobile topics"
            className="flex max-h-40 shrink-0 flex-wrap gap-2 overflow-y-auto border-b border-purple-100 bg-white p-4 lg:hidden"
          >
            {topics.map((topic) => (
              <button
                key={topic.label}
                type="button"
                disabled={!ready}
                onClick={() => sendMessage(topic.question)}
                className="rounded-full bg-purple-50 px-3 py-2 text-xs text-purple-800 disabled:opacity-40"
              >
                {topic.icon} {topic.label}
              </button>
            ))}
          </nav>
        )}

        <div
          ref={chatRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8"
        >
          <div className="mx-auto max-w-3xl">
            {!hasConversation && (
              <div className="mb-8 pt-3">
                <p className="text-xs font-bold uppercase tracking-widest text-purple-600">
                  Welcome to your helpdesk
                </p>

                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
                  Campus questions,
                  <br />
                  <span className="text-purple-600">
                    made simpler.
                  </span>
                </h2>

                <p className="mt-4 text-sm text-slate-500">
                  Choose a topic or ask a specific question.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {topics.map((topic) => (
                    <button
                      key={topic.label}
                      type="button"
                      disabled={!ready}
                      onClick={() => sendMessage(topic.question)}
                      className="rounded-2xl border border-purple-100 bg-white p-4 text-left shadow-sm transition hover:border-purple-300 hover:shadow-md disabled:opacity-40"
                    >
                      <span aria-hidden="true" className="text-2xl">
                        {topic.icon}
                      </span>

                      <span className="mt-3 block text-sm font-semibold">
                        {topic.label}
                      </span>

                      <span className="mt-1 block text-xs text-purple-500">
                        Explore topic →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div
              role="log"
              aria-label="Chat conversation"
              aria-live="polite"
              aria-relevant="additions"
              className="space-y-6"
            >
              {messages.map((message) => {
                const isUser = message.sender === "user";
                const source = message.source
                  ? sources[message.source]
                  : undefined;

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div className="max-w-[90%] sm:max-w-[80%]">
                      <p
                        className={`mb-1.5 text-[11px] font-semibold ${
                          isUser
                            ? "text-right text-purple-600"
                            : "text-slate-400"
                        }`}
                      >
                        {isUser ? "You" : "Helpdesk Assistant"}
                      </p>

                      <div
                        className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${
                          isUser
                            ? "rounded-br-sm bg-purple-600 text-white"
                            : "rounded-bl-sm border border-purple-100 bg-white text-slate-600 shadow-sm"
                        }`}
                      >
                        {message.text}

                        {!isUser && source && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 block font-semibold text-purple-700 underline underline-offset-4"
                          >
                            {source.label} ↗
                          </a>
                        )}
                      </div>

                      {!isUser && message.options && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.options.map((option) => (
                            <button
                              key={option}
                              type="button"
                              disabled={!ready}
                              onClick={() => sendMessage(option)}
                              className="rounded-full border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-800 hover:bg-purple-100 disabled:opacity-40"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}

                      {message.time && (
                        <p
                          className={`mt-2 text-[10px] text-slate-400 ${
                            isUser ? "text-right" : ""
                          }`}
                        >
                          {message.time}
                        </p>
                      )}

                      {!isUser && message.id !== 0 && (
                        <div className="mt-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] text-slate-400">
                              Was this helpful?
                            </span>

                            {(["yes", "no"] as const).map((value) => (
                              <button
                                key={value}
                                type="button"
                                aria-pressed={message.feedback === value}
                                onClick={() =>
                                  setFeedback(message.id, value)
                                }
                                className={`rounded-lg border px-2 py-1 text-[10px] ${
                                  message.feedback === value
                                    ? "border-purple-400 bg-purple-100 text-purple-800"
                                    : "border-slate-200 text-slate-500 hover:bg-white"
                                }`}
                              >
                                {value === "yes"
                                  ? "Helpful"
                                  : "Not helpful"}
                              </button>
                            ))}
                          </div>

                          {message.feedback && (
                            <p className="mt-2 text-xs text-slate-500">
                              {message.feedback === "yes"
                                ? "Thanks! Your feedback is saved in this browser."
                                : "Thanks. Try a more specific question or confirm the details with the relevant UOS office."}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="shrink-0 px-4 pb-4 pt-2 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 rounded-2xl border border-purple-200 bg-white p-2 shadow-lg shadow-purple-900/5 focus-within:ring-2 focus-within:ring-purple-100"
            >
              <label htmlFor="message" className="sr-only">
                Your question
              </label>

              <input
                ref={inputRef}
                id="message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={!ready}
                placeholder="Ask about admissions, fees, exams..."
                autoComplete="off"
                maxLength={2000}
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-slate-400"
              />

              <button
                type="submit"
                disabled={!ready || !input.trim()}
                className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send →
              </button>
            </form>

            <p
              role="status"
              className="mt-2 text-center text-[10px] text-slate-400"
            >
              {!ready
                ? "Loading saved chat..."
                : saveError
                  ? "Chat could not be saved in this browser."
                  : "Chat and feedback stay in this browser. New Chat clears them."}
            </p>

            <p className="mt-1 text-center text-[10px] text-slate-400">
              General guidance · Confirm current details with UOS.
            </p>
          </div>
        </footer>
      </section>
    </main>
  );
}