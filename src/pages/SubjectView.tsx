import { useParams, Link, useNavigate } from 'react-router-dom';
import { ALL_SUBJECTS } from '../constants';
import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, orderBy, updateDoc, writeBatch } from 'firebase/firestore';
import { FileText, Plus, ChevronLeft, Calendar, Clock, FolderEdit, X } from 'lucide-react';
import { format } from 'date-fns';

interface Note {
  id: string;
  title: string;
  subfolder?: string;
  updatedAt: any;
}

export default function SubjectView() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const subject = ALL_SUBJECTS.find((s) => s.id === subjectId);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManageFolders, setShowManageFolders] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{ oldName: string, newName: string } | null>(null);

  useEffect(() => {
    if (!auth.currentUser || !subjectId) return;

    const q = query(
      collection(db, 'notes'),
      where('userId', '==', auth.currentUser.uid),
      where('subject', '==', subjectId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((n: any) => !n.isTrashed)
        .sort((a: any, b: any) => {
          const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
          const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
          return timeB - timeA;
        }) as Note[];
      setNotes(notesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notes');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [subjectId]);

  const handleCreateNote = async (subfolder?: string) => {
    if (!auth.currentUser || !subjectId) return;
    try {
      const newNoteRef = doc(collection(db, 'notes'));
      await setDoc(newNoteRef, {
        id: newNoteRef.id,
        userId: auth.currentUser.uid,
        subject: subjectId,
        subfolder: subfolder || '',
        title: 'Untitled Note',
        content: '',
        rawContent: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      navigate(`/note/${newNoteRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notes');
    }
  };

  if (!subject) return <div className="p-8 text-white">Subject not found</div>;

  const notesBySubfolder = notes.reduce((acc, note) => {
    const folder = note.subfolder || 'Uncategorized';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(note);
    return acc;
  }, {} as Record<string, Note[]>);

  const sortedSubfolders = Object.keys(notesBySubfolder).sort((a, b) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  const handleRenameFolder = async () => {
    if (!editingFolder || !editingFolder.newName.trim() || editingFolder.oldName === editingFolder.newName) {
      setEditingFolder(null);
      return;
    }

    try {
      const batch = writeBatch(db);
      const notesToUpdate = notesBySubfolder[editingFolder.oldName] || [];
      
      notesToUpdate.forEach(note => {
        const noteRef = doc(db, 'notes', note.id);
        batch.update(noteRef, { subfolder: editingFolder.newName.trim(), updatedAt: serverTimestamp() });
      });

      await batch.commit();
      setEditingFolder(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notes');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0a] text-gray-100 p-4 md:p-8 font-sans relative">
      <div className="max-w-7xl mx-auto">
        <Link to="/" className="inline-flex items-center text-sm text-gray-400 hover:text-white mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Subjects
        </Link>
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-1">{subject.name}</h1>
            <p className="text-gray-400 text-base">Manage your notes and clinical cases.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowManageFolders(true)}
              className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              <FolderEdit className="w-4 h-4" />
              Manage Folders
            </button>
            <button
              onClick={() => handleCreateNote()}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20 text-sm"
            >
              <Plus className="w-4 h-4" />
              New Note
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-800 rounded-xl bg-[#111111]">
            <FileText className="w-10 h-10 text-gray-600 mb-3" />
            <h3 className="text-lg font-medium text-white mb-1">No notes yet</h3>
            <p className="text-gray-400 text-sm text-center max-w-sm mb-4">
              Create your first note for {subject.name} to start organizing your studies.
            </p>
            <button
              onClick={() => handleCreateNote()}
              className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Note
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedSubfolders.map(folder => (
              <div key={folder} className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <h2 className="text-xl font-semibold text-gray-200">{folder}</h2>
                  <button
                    onClick={() => handleCreateNote(folder === 'Uncategorized' ? '' : folder)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> New in {folder}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {notesBySubfolder[folder].map((note) => (
                    <Link
                      key={note.id}
                      to={`/note/${note.id}`}
                      className="group flex flex-col p-4 bg-[#111111] border border-gray-800 rounded-xl hover:bg-[#1a1a1a] hover:border-gray-600 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-1.5 bg-gray-800/50 rounded-md text-blue-400">
                          <FileText className="w-4 h-4" />
                        </div>
                      </div>
                      <h3 className="text-base font-medium text-gray-100 mb-1 line-clamp-2 group-hover:text-blue-400 transition-colors">
                        {note.title || 'Untitled Note'}
                      </h3>
                      <div className="mt-auto pt-3 flex items-center gap-3 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {note.updatedAt?.toDate ? format(note.updatedAt.toDate(), 'MMM d, yyyy') : 'Just now'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manage Folders Modal */}
      {showManageFolders && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Manage Subfolders</h3>
              <button onClick={() => setShowManageFolders(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {sortedSubfolders.filter(f => f !== 'Uncategorized').length === 0 ? (
                <p className="text-gray-500 text-center py-4">No subfolders created yet.</p>
              ) : (
                sortedSubfolders.filter(f => f !== 'Uncategorized').map(folder => (
                  <div key={folder} className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                    {editingFolder?.oldName === folder ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          value={editingFolder.newName}
                          onChange={(e) => setEditingFolder({ ...editingFolder, newName: e.target.value })}
                          className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-blue-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameFolder();
                            if (e.key === 'Escape') setEditingFolder(null);
                          }}
                        />
                        <button onClick={handleRenameFolder} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-medium">Save</button>
                        <button onClick={() => setEditingFolder(null)} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-md font-medium">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-gray-300">{folder}</span>
                        <button
                          onClick={() => setEditingFolder({ oldName: folder, newName: folder })}
                          className="text-sm text-blue-400 hover:text-blue-300"
                        >
                          Rename
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
