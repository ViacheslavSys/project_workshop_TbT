/* eslint-disable @typescript-eslint/no-explicit-any */
export default class ActionProvider {
  createChatBotMessage: any;
  setState: any;
  createClientMessage: any;
  ws?: WebSocket;

  constructor(createChatBotMessage: any, setStateFunc: any, createClientMessage: any) {
    this.createChatBotMessage = createChatBotMessage;
    this.setState = setStateFunc;
    this.createClientMessage = createClientMessage;

    try {
      this.ws = new WebSocket("wss://api.example.com/chat");
      this.ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const text = typeof payload.content === "string" ? payload.content : JSON.stringify(payload.content);
          const msg = this.createChatBotMessage(text);
          this.setState((prev: any) => ({ ...prev, messages: [...prev.messages, msg] }));
        } catch {
          const msg = this.createChatBotMessage("(received a message)");
          this.setState((prev: any) => ({ ...prev, messages: [...prev.messages, msg] }));
        }
      };
    } catch {
      // ignore ws errors in UI-only mode
    }
  }

  handleUserMessage = (text: string) => {
    // reflect user message in the transcript
    const userMsg = this.createClientMessage(text);
    this.setState((prev: any) => ({ ...prev, messages: [...prev.messages, userMsg] }));

    // send to backend if WS open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "message", content: text, timestamp: Date.now() }));
    } else {
      // fallback demo response
      const demo = this.createChatBotMessage("Thanks! I’ll get back to you.");
      this.setState((prev: any) => ({ ...prev, messages: [...prev.messages, demo] }));
    }
  };
}

