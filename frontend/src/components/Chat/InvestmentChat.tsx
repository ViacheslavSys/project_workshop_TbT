import { MainContainer, ChatContainer, MessageList, Message, MessageInput, TypingIndicator } from "@chatscope/chat-ui-kit-react";
import { useSelector } from "react-redux";
import { type RootState } from "../../store/store";
import { useWebSocket } from "../../hooks/useWebSocket";

export default function InvestmentChat() {
  const { messages, typing } = useSelector((s:RootState)=>({ messages: s.chat.messages, typing: s.chat.typing }));
  const { sendMessage } = useWebSocket("wss://api.example.com/chat"); // заменить на ваш ws
  return (
    <div className="h-[70vh] bg-[var(--color-surface)] rounded-lg border border-white/10">
      <MainContainer>
        <ChatContainer>
          <MessageList typingIndicator={typing ? <TypingIndicator content="ИИ печатает…" /> : undefined}>
            {messages.map(m => (
              <Message key={m.id} model={{
                message: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
                sentTime: new Date().toLocaleTimeString(),
                sender: m.sender === "ai" ? "ai" : "user",
                direction: m.sender === "ai" ? "incoming" : "outgoing",
                position: "single"
              }}/>
            ))}
          </MessageList>
          <MessageInput placeholder="Опишите вашу финансовую цель…" onSend={(text)=>sendMessage(text, "goal_discussion")} attachButton={false}/>
        </ChatContainer>
      </MainContainer>
    </div>
  );
}
