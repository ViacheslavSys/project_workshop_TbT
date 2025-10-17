// Simple front-only auth stub for demo purposes
// - Ensures a default user test@mail.ru / 123 exists
// - Stores users in localStorage under key "demo_users"
// - Stores current user id in localStorage under key "demo_current_user"

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  password: string; // plain for demo only
};

const USERS_KEY = "demo_users";
const CURRENT_KEY = "demo_current_user";

function readUsers(): DemoUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeUsers(users: DemoUser[]) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch {}
}

export function initFakeUsers() {
  const users = readUsers();
  const exists = users.some(u => u.email.toLowerCase() === "test@mail.ru");
  if (!exists) {
    users.push({ id: crypto.randomUUID(), name: "Test User", email: "test@mail.ru", password: "123" });
    writeUsers(users);
  }
}

export function register(name: string, email: string, password: string): DemoUser {
  const users = readUsers();
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("Email already registered");
  }
  const user: DemoUser = { id: crypto.randomUUID(), name: name || email.split("@")[0], email, password };
  users.push(user);
  writeUsers(users);
  try { localStorage.setItem(CURRENT_KEY, user.id); } catch {}
  return user;
}

export function login(email: string, password: string): DemoUser {
  const users = readUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!user) throw new Error("Invalid email or password");
  try { localStorage.setItem(CURRENT_KEY, user.id); } catch {}
  return user;
}

export function logout() {
  try { localStorage.removeItem(CURRENT_KEY); } catch {}
}

export function current(): DemoUser | null {
  try {
    const id = localStorage.getItem(CURRENT_KEY);
    if (!id) return null;
    const users = readUsers();
    return users.find(u => u.id === id) || null;
  } catch {
    return null;
  }
}

