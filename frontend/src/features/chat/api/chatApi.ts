import axios from "axios";
import { buildUrl } from "../../../api/http";

export async function sendChatMessage(userId: string, message: string): Promise<string> {
  const formData = new FormData();
  formData.append("user_id", userId);
  formData.append("message", message);
  const res = await axios.post(buildUrl("/dialog/chat"), formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const data = res.data as { response?: string };
  if (!data || typeof data.response !== "string") {
    throw new Error("Некорректный ответ сервера");
  }
  return data.response;
}
