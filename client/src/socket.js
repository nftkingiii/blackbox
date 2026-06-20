export function openRoomStream(code, onMessage) {
  const events = new EventSource(`/api/rooms/${code}/events`);
  events.onmessage = (event) => onMessage(JSON.parse(event.data));
  return events;
}

export async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
