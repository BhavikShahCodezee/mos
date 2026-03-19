import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { NoteItem, deleteNote, loadNotes } from '@/src/storage/notes';

function notePreview(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= 80) return clean;
  return `${clean.slice(0, 80)}...`;
}

export default function NotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotes = useCallback(async () => {
    setRefreshing(true);
    const list = await loadNotes();
    setNotes(list);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes, router]);

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
    }, [fetchNotes])
  );

  const onDelete = useCallback((note: NoteItem) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const next = await deleteNote(note.id);
            setNotes(next);
          },
        },
      ]
    );
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/note-editor' as never)}>
        <Text style={styles.addButtonText}>Add Note</Text>
      </TouchableOpacity>
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchNotes} />}
      >
        {notes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptyBody}>Tap Add Note to create and print.</Text>
          </View>
        ) : (
          notes.map((note) => (
            <View key={note.id} style={styles.noteCard}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => onDelete(note)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.noteBody}
                onPress={() => router.push({ pathname: '/note-editor' as never, params: { id: note.id } })}
              >
                <Text style={styles.noteText}>{notePreview(note.content)}</Text>
                <Text style={styles.noteDate}>{new Date(note.updatedAt).toLocaleString()}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fc', padding: 16, gap: 12 },
  addButton: { backgroundColor: '#0a7ea4', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  listContent: { gap: 10, paddingBottom: 16 },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    position: 'relative',
    overflow: 'visible',
  },
  noteBody: {
    padding: 14,
    gap: 8,
    paddingTop: 40,
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 10,
    zIndex: 10,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  deleteButtonText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
  noteText: { color: '#111827', fontSize: 15, lineHeight: 20 },
  noteDate: { color: '#6b7280', fontSize: 12 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  emptyBody: { color: '#6b7280' },
});

