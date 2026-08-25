import type { DemoPerson, DemoProject } from "@/lib/demo-data";

export const createdProjectsKey = "projectmatch-created-projects-v1";
export const availabilityKey = "projectmatch-availability-2026";

export type StudentProject = DemoProject & {
  ownerId: string;
  ownerName: string;
  institution: "SRM University";
  createdAtMs: number;
};

export type ChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAtMs: number;
};

export type DirectoryStudent = DemoPerson & { id?: string; isCurrent?: boolean };

function readArray<T>(key: string): T[] {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T[] : [];
  } catch {
    return [];
  }
}

export function readCreatedProjects(): StudentProject[] {
  return readArray<StudentProject>(createdProjectsKey);
}

export function saveCreatedProject(project: StudentProject): void {
  const projects = readCreatedProjects().filter((item) => item.id !== project.id);
  window.localStorage.setItem(createdProjectsKey, JSON.stringify([project, ...projects]));
}

export function chatStorageKey(projectId: string): string {
  return `projectmatch-chat-v1-${projectId}`;
}

export function readChat(projectId: string): ChatMessage[] {
  return readArray<ChatMessage>(chatStorageKey(projectId));
}

export function saveChat(projectId: string, messages: ChatMessage[]): void {
  window.localStorage.setItem(chatStorageKey(projectId), JSON.stringify(messages.slice(-100)));
}

export function conversationId(firstStudentId: string, secondStudentId: string): string {
  return [firstStudentId, secondStudentId].sort().join("--");
}

export function directChatStorageKey(id: string): string {
  return `projectmatch-direct-chat-v1-${id}`;
}

export function readDirectChat(id: string): ChatMessage[] {
  return readArray<ChatMessage>(directChatStorageKey(id));
}

export function saveDirectChat(id: string, messages: ChatMessage[]): void {
  window.localStorage.setItem(directChatStorageKey(id), JSON.stringify(messages.slice(-100)));
}

export function readAvailability(): string[] {
  return readArray<string>(availabilityKey);
}

export function availableWeekdays(blocks: string[]): number[] {
  const result = new Set<number>();
  for (const block of blocks) {
    const date = block.slice(0, 10);
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (Number.isFinite(day)) result.add((day + 6) % 7);
  }
  return [...result].sort((a, b) => a - b);
}
