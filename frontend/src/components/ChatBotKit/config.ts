// Minimal config for react-chatbot-kit
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { createChatBotMessage } from "react-chatbot-kit";

const config = {
  botName: "InvestPro Assistant",
  initialMessages: [createChatBotMessage("Hi! How can I help you today?", {})],
  customStyles: {
    botMessageBox: { backgroundColor: "#1f2937" },
    chatButton: { backgroundColor: "#2563eb" },
  },
};

export default config;
