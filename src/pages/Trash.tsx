import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { Trash2, RotateCcw, AlertTriangle, FileText, Clock } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import Toast, { ToastType } from '../components/Toast';

interface TrashedNote {
  id: string;
  title: string;
  subject: string;
  trashedAt: any;
}

export default function Trash() {
  const [trashedNotes, setTrashedNotes] = useState<TrashedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'notes'),
      where('userId', '==', auth.currentUser.uid),
      where('isTrashed', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TrashedNote[];
      
      // Auto-delete notes older than 30 days
      notesData.forEach(async (note) => {
        if (note.trashedAt?.toDate) {
          const daysLeft = 30 - differenceInDays(new Date(), note.trashedAt.toDate());
          if (daysLeft <= 0) {
            try {
              await deleteDoc(doc(db, 'notes', note.id));
            } catch (error) {
              console.error("Failed to auto-delete note:", error);
            }
          }
        }
      });

      const filteredAndSorted = notesData
        .filter(note => {
          if (!note.trashedAt?.toDate) return true;
          return (30 - differenceInDays(new Date(), note.trashedAt.toDate())) > 0;
        })
        .sort((a: any, b: any) => {
          const timeA = a.trashedAt?.toMillis ? a.trashedAt.toMillis() : 0;
          const timeB = b.trashedAt?.toMillis ? b.trashedAt.toMillis() : 0;
          return timeB - timeA;
        });

      setTrashedNotes(filteredAndSorted);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notes');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRestore = async (noteId: string) => {
    try {
      await updateDoc(doc(db, 'notes', noteId), {
        isTrashed: false,
        trashedAt: null
      });
      setToast({ message: 'Note restored successfully!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notes/${noteId}`);
    }
  };

  const handlePermanentDelete = async (noteId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this note? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'notes', noteId));
      setToast({ message: 'Note permanently deleted.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notes/${noteId}`);
    }
  };

  const emptyTrash = async () => {
    if (!window.confirm("Are you sure you want to empty the trash? All notes will be permanently deleted.")) return;
    try {
      await Promise.all(trashedNotes.map(note => deleteDoc(doc(db, 'notes', note.id))));
      setToast({ message: 'Trash emptied successfully.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'notes');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0a] text-gray-100 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-gray-800 pb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
              <Trash2 className="w-8 h-8 text-red-500" />
              Recycle Bin
            </h1>
            <p className="text-gray-400">Notes are kept here for 30 days before being permanently deleted.</p>
          </div>
          {trashedNotes.length > 0 && (
            <button
              onClick={emptyTrash}
              className="inline-flex items-center justify-center gap-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              Empty Trash
            </button>
          )}
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : trashedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-800 rounded-2xl bg-[#111111]">
            <Trash2 className="w-12 h-12 text-gray-600 mb-4 opacity-50" />
            <h3 className="text-xl font-medium text-white mb-2">Trash is empty</h3>
            <p className="text-gray-400 text-center max-w-sm">
              No notes have been deleted recently.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {trashedNotes.map((note) => {
              const daysLeft = note.trashedAt?.toDate ? 30 - differenceInDays(new Date(), note.trashedAt.toDate()) : 30;
              
              return (
                <div key={note.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#111111] border border-gray-800 rounded-xl hover:border-gray-700 transition-colors gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-800/50 rounded-lg text-gray-400 mt-1">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-200 mb-1">{note.title || 'Untitled Note'}</h3>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Deleted {note.trashedAt?.toDate ? format(note.trashedAt.toDate(), 'MMM d, yyyy') : 'recently'}
                        </span>
                        <span className={`font-medium ${daysLeft <= 3 ? 'text-red-400' : 'text-orange-400'}`}>
                          {daysLeft > 0 ? `${daysLeft} days left` : 'Deleting soon'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleRestore(note.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restore
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(note.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
