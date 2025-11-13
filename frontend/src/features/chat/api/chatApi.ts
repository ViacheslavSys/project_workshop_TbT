import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function sendChatMessage(userId: string, message: string): Promise<string> {
  const formData = new FormData();
  formData.append("user_id", userId);
  formData.append("message", message);
  const res = await axios.post(`${BASE_URL}/dialog/chat`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const data = res.data as { response?: string };
  if (!data || typeof data.response !== "string") {
    throw new Error("Некорректный ответ сервера");
  }
  return data.response;
}

