// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Chatbot from "react-chatbot-kit";
import config from "../ChatBotKit/config";
import MessageParser from "../ChatBotKit/MessageParser";
import ActionProvider from "../ChatBotKit/ActionProvider";

export default function InvestmentChat() {
  return (
    <div className="card">
      <div className="card-header">Chat Assistant</div>
      <div className="card-body">
        <div className="h-[70vh]">
          <Chatbot
            config={config as any}
            messageParser={MessageParser as any}
            actionProvider={ActionProvider as any}
            placeholderText="Type your message..."
          />
        </div>
      </div>
    </div>
  );
}



