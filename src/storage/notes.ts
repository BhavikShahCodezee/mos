import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NoteItem {
  id: string;
  content: string;
  updatedAt: number;
}

const NOTES_KEY = 'mos:notes:v1';

export async function loadNotes(): Promise<NoteItem[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NoteItem[];
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function saveNotes(notes: NoteItem[]): Promise<void> {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export async function upsertNote(note: NoteItem): Promise<NoteItem[]> {
  const notes = await loadNotes();
  const index = notes.findIndex((n) => n.id === note.id);
  if (index >= 0) notes[index] = note;
  else notes.unshift(note);
  await saveNotes(notes);
  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteNote(noteId: string): Promise<NoteItem[]> {
  const notes = await loadNotes();
  const next = notes.filter((n) => n.id !== noteId);
  await saveNotes(next);
  return next.sort((a, b) => b.updatedAt - a.updatedAt);
}

