import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, deleteDoc, collection, query, where, orderBy } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import GithubSlugger from 'github-slugger';
import { ArrowLeft, Save, Trash2, Wand2, Loader2, SplitSquareHorizontal, FileText, AlertTriangle, Book, Clock, Edit3, Eye, Sparkles, Download, FolderInput, List } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import Toast, { ToastType } from '../components/Toast';
import { ALL_SUBJECTS } from '../constants';
import { format } from 'date-fns';

export default function NoteEditor() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState<any>(null);
  const [subjectNotes, setSubjectNotes] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [subfolder, setSubfolder] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [formattedContent, setFormattedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [autoFormat, setAutoFormat] = useState(true);
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [autoSave, setAutoSave] = useState(true);
  const [fontSize, setFontSize] = useState('medium');
  const [notifications, setNotifications] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);
  const lastFormattedContent = useRef('');
  const rawContentRef = useRef('');

  useEffect(() => {
    rawContentRef.current = rawContent;
  }, [rawContent]);

  useEffect(() => {
    const savedAutoFormat = localStorage.getItem('app_autoFormat') !== 'false';
    const savedDefaultView = (localStorage.getItem('app_defaultView') as 'split' | 'edit' | 'preview') || 'split';
    const savedAutoSave = localStorage.getItem('app_autoSave') !== 'false';
    const savedFontSize = localStorage.getItem('app_fontSize') || 'medium';
    const savedNotifications = localStorage.getItem('app_notifications') !== 'false';

    setAutoFormat(savedAutoFormat);
    setViewMode(savedDefaultView);
    setAutoSave(savedAutoSave);
    setFontSize(savedFontSize);
    setNotifications(savedNotifications);
  }, []);

  useEffect(() => {
    if (!noteId || !auth.currentUser) return;

    const unsubscribe = onSnapshot(doc(db, 'notes', noteId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setNote({ id: docSnap.id, ...data });
        
        // Only set initial state if we haven't typed anything yet to prevent cursor jumping
        if (isInitialLoad.current) {
          setTitle(data.title || '');
          setSubfolder(data.subfolder || '');
          setRawContent(data.rawContent || '');
          setFormattedContent(data.content || '');
          lastFormattedContent.current = data.rawContent || '';
          isInitialLoad.current = false;
        }
      } else {
        navigate('/');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `notes/${noteId}`);
    });

    return () => unsubscribe();
  }, [noteId, navigate]);

  useEffect(() => {
    if (!note?.subject || !auth.currentUser) return;
    const q = query(
      collection(db, 'notes'),
      where('userId', '==', auth.currentUser.uid),
      where('subject', '==', note.subject)
    );
    const unsub = onSnapshot(q, (snap) => {
      // Filter out trashed notes client-side to avoid needing a composite index immediately
      const activeNotes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((n: any) => !n.isTrashed)
        .sort((a: any, b: any) => {
          const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
          const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
          return timeB - timeA;
        });
      setSubjectNotes(activeNotes);
    });
    return () => unsub();
  }, [note?.subject]);

  const saveNote = useCallback(async (newTitle: string, newRaw: string, newFormatted: string, newSubfolder: string = subfolder) => {
    if (!noteId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'notes', noteId), {
        title: newTitle,
        subfolder: newSubfolder,
        rawContent: newRaw,
        content: newFormatted,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notes/${noteId}`);
    } finally {
      setIsSaving(false);
    }
  }, [noteId, subfolder]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newRaw = e.target.value;
    setRawContent(newRaw);

    if (autoSave) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveNote(title, newRaw, formattedContent, subfolder);
      }, 1000);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);

    if (autoSave) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveNote(newTitle, rawContent, formattedContent, subfolder);
      }, 1000);
    }
  };

  const handleSubfolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSubfolder = e.target.value;
    setSubfolder(newSubfolder);

    if (autoSave) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveNote(title, rawContent, formattedContent, newSubfolder);
      }, 1000);
    }
  };

  const extractHeading = (text: string) => {
    const match = text.match(/^#\s+(.*)/m);
    return match ? match[1].trim() : null;
  };

  const formatWithGemini = async (textToFormat: string = rawContent, isAuto: boolean = false) => {
    if (!textToFormat.trim()) return;
    if (isAuto && textToFormat === lastFormattedContent.current) return;

    setIsFormatting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Get existing subfolders for context
      const existingSubfolders = Array.from(new Set(subjectNotes.map(n => n.subfolder).filter(Boolean)));

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `You are an expert medical note-taker for an MBBS student. The user is pasting raw text or rough notes.
Your job is to seamlessly transform this into beautifully structured, comprehensive Markdown, and also suggest a title and a subfolder (chapter/system) for this note.

Ensure you utilize all Markdown features where appropriate:
- Headings (H1, H2, H3) for structure. ALWAYS start with a single H1 (# Heading) that represents the main topic.
- Paragraphs and Line Breaks for readability
- Emphasis (bold, italics) for key medical terms
- Blockquotes for important excerpts
- Lists (bulleted and numbered) for symptoms, treatments, etc.
- Code blocks if there's any technical/lab data formatting needed
- Horizontal Rules to separate major sections
- Links and Images (preserve them if they exist in the raw text)
- Callouts/Admonitions: Use emojis for callouts (e.g., "> **📝 NOTE:**", "> **💡 TIP:**", "> **⚠️ WARNING:**", "> **🛑 CAUTION:**")
- Escape characters properly
- Preserve any HTML if present

Do NOT add external medical information that isn't implied by the raw text, just structure and format the existing content perfectly. If the text is already well-formatted markdown, just return it as is or slightly improve the typography.

Existing subfolders in this subject: ${existingSubfolders.join(', ') || 'None yet'}
If one of the existing subfolders fits perfectly, use it. Otherwise, suggest a new, concise subfolder name (e.g., "Cardiology", "GIT", "Infectious Diseases").

Raw Text:
${textToFormat}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              formattedContent: { type: "STRING", description: "The beautifully structured markdown content." },
              suggestedTitle: { type: "STRING", description: "A concise title for the note based on the content." },
              suggestedSubfolder: { type: "STRING", description: "The suggested subfolder (chapter/system) for this note." }
            },
            required: ["formattedContent", "suggestedTitle", "suggestedSubfolder"]
          }
        }
      });

      let result;
      try {
        result = JSON.parse(response.text || '{}');
      } catch (e) {
        console.error("Failed to parse Gemini JSON response", e);
        throw new Error("Invalid response format");
      }

      const newFormatted = result.formattedContent || textToFormat;
      lastFormattedContent.current = newFormatted;
      
      let newTitle = title;
      if (!title || title === 'Untitled Note') {
        newTitle = result.suggestedTitle || extractHeading(newFormatted) || 'Untitled Note';
        setTitle(newTitle);
      }

      let newSubfolder = subfolder;
      if (!subfolder) {
        newSubfolder = result.suggestedSubfolder || '';
        setSubfolder(newSubfolder);
      }
      
      // If it's an auto-format, we update the raw content to the structured version
      setRawContent(newFormatted);
      setFormattedContent(newFormatted);
      await saveNote(newTitle, newFormatted, newFormatted, newSubfolder);
      
      if (!isAuto && notifications) setToast({ message: 'Notes formatted successfully!', type: 'success' });
    } catch (error) {
      console.error("Error formatting with Gemini:", error);
      if (!isAuto && notifications) setToast({ message: 'Failed to format notes. Please try again.', type: 'error' });
    } finally {
      setIsFormatting(false);
    }
  };

  const handleBlur = () => {
    if (autoFormat && rawContent !== lastFormattedContent.current) {
      formatWithGemini(rawContent, true);
    }
  };

  const handlePaste = () => {
    if (autoFormat) {
      setTimeout(() => {
        if (rawContentRef.current !== lastFormattedContent.current) {
          formatWithGemini(rawContentRef.current, true);
        }
      }, 500);
    }
  };

  const handleDelete = async () => {
    if (!noteId) return;
    try {
      await updateDoc(doc(db, 'notes', noteId), {
        isTrashed: true,
        trashedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      navigate(`/subject/${note.subject}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notes/${noteId}`);
    }
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([formattedContent || rawContent], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = `${title || 'Untitled_Note'}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleMove = async (newSubjectId: string) => {
    if (!noteId) return;
    try {
      // First, just move it to the new subject
      await updateDoc(doc(db, 'notes', noteId), {
        subject: newSubjectId,
        updatedAt: serverTimestamp()
      });
      setShowMoveModal(false);
      if (notifications) setToast({ message: 'Note moved successfully! Categorizing...', type: 'success' });

      // Then, asynchronously ask Gemini for a new subfolder in the new subject
      const textToFormat = formattedContent || rawContent;
      if (textToFormat.trim()) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: `You are an expert medical note-taker. The user just moved a note to a new subject.
Based on the note content, suggest a concise subfolder name (chapter/system) for this note in its new subject.
Return ONLY the subfolder name as a plain string, nothing else.

Note Content:
${textToFormat.substring(0, 1000)}...`,
        });
        
        const suggestedSubfolder = response.text?.trim() || '';
        if (suggestedSubfolder) {
          await updateDoc(doc(db, 'notes', noteId), {
            subfolder: suggestedSubfolder,
            updatedAt: serverTimestamp()
          });
          setSubfolder(suggestedSubfolder);
          if (notifications) setToast({ message: `Note auto-categorized into ${suggestedSubfolder}`, type: 'success' });
        }
      }

    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notes/${noteId}`);
    }
  };

  const headings = useMemo(() => {
    if (!formattedContent) return [];
    const slugger = new GithubSlugger();
    const regex = /^(#{1,6})\s+(.+)$/gm;
    const matches = [];
    let match;
    while ((match = regex.exec(formattedContent)) !== null) {
      matches.push({
        level: match[1].length,
        text: match[2].trim(),
        id: slugger.slug(match[2].trim())
      });
    }
    return matches;
  }, [formattedContent]);

  const hasMatchingHeading = useMemo(() => {
    if (!title || !formattedContent) return false;
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^#\\s+${escapedTitle}`, 'i');
    return regex.test(formattedContent.trim());
  }, [title, formattedContent]);

  if (!note) return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  const subjectName = ALL_SUBJECTS.find(s => s.id === note.subject)?.name || 'Subject';

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small': return 'text-xs';
      case 'large': return 'text-lg';
      case 'xlarge': return 'text-xl';
      case 'medium':
      default: return 'text-sm';
    }
  };

  const getProseSizeClass = () => {
    switch (fontSize) {
      case 'small': return 'prose-sm';
      case 'large': return 'prose-lg';
      case 'xlarge': return 'prose-xl';
      case 'medium':
      default: return 'prose-base';
    }
  };

  return (
    <div className="flex h-full bg-[#0a0a0a] text-gray-100 font-sans overflow-hidden">
      {/* Secondary Sidebar (Notes List) */}
      <div className="hidden lg:flex w-72 flex-col border-r border-gray-800 bg-[#0f0f0f]">
        <div className="p-4 border-b border-gray-800 flex items-center gap-2">
          <Book className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-gray-200 truncate">{subjectName}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {subjectNotes.map(sn => (
            <Link
              key={sn.id}
              to={`/note/${sn.id}`}
              className={`block p-3 rounded-lg transition-colors ${sn.id === noteId ? 'bg-blue-900/20 border border-blue-900/50 text-blue-100' : 'hover:bg-[#1a1a1a] text-gray-400 hover:text-gray-200'}`}
            >
              <div className="font-medium truncate mb-1">{sn.title || 'Untitled Note'}</div>
              <div className="flex items-center gap-1 text-xs opacity-60">
                <Clock className="w-3 h-3" />
                {sn.updatedAt?.toDate ? format(sn.updatedAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Editor Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 md:p-3 border-b border-gray-800 bg-[#111111] overflow-x-auto no-scrollbar gap-2">
          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-400 shrink-0">
            <button onClick={() => navigate(`/subject/${note.subject}`)} className="hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{subjectName}</span>
            </button>
            <span className="hidden sm:inline">/</span>
            <span className="text-gray-200 truncate max-w-[120px] sm:max-w-[180px]">{title || 'Untitled Note'}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex bg-gray-900 rounded-md p-0.5 border border-gray-800 mr-1">
              <button onClick={() => setViewMode('edit')} className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === 'edit' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                <Edit3 className="w-3.5 h-3.5 sm:hidden" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button onClick={() => setViewMode('split')} className={`hidden md:flex px-2 py-1 rounded text-xs font-medium transition-colors items-center gap-1 ${viewMode === 'split' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                <SplitSquareHorizontal className="w-3.5 h-3.5 hidden sm:inline" />
                <span>Split</span>
              </button>
              <button onClick={() => setViewMode('preview')} className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === 'preview' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                <Eye className="w-3.5 h-3.5 sm:hidden" />
                <span className="hidden sm:inline">Preview</span>
              </button>
            </div>

            <span className="text-[10px] text-gray-500 mr-1 hidden lg:inline-block">
              {isSaving ? 'Saving...' : 'Saved'}
            </span>

            <button
              onClick={() => setAutoFormat(!autoFormat)}
              className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-all text-[10px] border ${autoFormat ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'text-gray-400 hover:text-gray-200 border-transparent'}`}
              title="Auto-format on pause or paste"
            >
              <Sparkles className="w-3 h-3" />
              <span>Auto-Magic</span>
            </button>

            <button
              onClick={() => formatWithGemini(rawContent, false)}
              disabled={isFormatting || !rawContent.trim()}
              className="flex items-center gap-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-2.5 py-1 rounded-md text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isFormatting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Format</span>
            </button>

            <button
              onClick={handleDownload}
              className="p-1.5 text-gray-400 hover:text-blue-400 rounded hover:bg-gray-800 transition-colors"
              title="Download Markdown"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowMoveModal(true)}
              className="p-1.5 text-gray-400 hover:text-green-400 rounded hover:bg-gray-800 transition-colors"
              title="Move Note"
            >
              <FolderInput className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowOutline(!showOutline)}
              className={`p-1.5 rounded transition-colors ${showOutline ? 'text-white bg-gray-800' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
              title="Toggle Outline"
            >
              <List className="w-4 h-4" />
            </button>

            <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-gray-800 transition-colors" title="Move to Trash">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Move Note Modal */}
        {showMoveModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-[#111111] border border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-bold mb-4">Move Note</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto mb-6 pr-2">
                {ALL_SUBJECTS.map(subj => (
                  <button
                    key={subj.id}
                    onClick={() => handleMove(subj.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${subj.id === note.subject ? 'bg-blue-900/20 text-blue-400 border border-blue-900/50' : 'bg-gray-800/50 hover:bg-gray-700 text-gray-300'}`}
                    disabled={subj.id === note.subject}
                  >
                    {subj.name}
                    {subj.id === note.subject && <span className="float-right text-xs opacity-60">Current</span>}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowMoveModal(false)}
                className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-[#111111] border border-gray-800 rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-center mb-2">Delete Note?</h3>
              <p className="text-gray-400 text-center mb-8">
                This note will be moved to the Trash and kept for 30 days.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Move to Trash
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Raw Input */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className={`flex-1 flex flex-col border-r border-gray-800 ${viewMode === 'edit' ? 'w-full max-w-5xl mx-auto border-r-0' : 'w-1/2'}`}>
              <div className="p-1.5 bg-[#111111] border-b border-gray-800 text-[10px] font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Raw Notes
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col">
                <input
                  type="text"
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="Untitled Note"
                  className="bg-transparent border-none text-2xl md:text-3xl font-bold text-white focus:outline-none focus:ring-0 placeholder-gray-700 mb-2 w-full"
                />
                <div className="flex items-center gap-2 mb-4 text-gray-500">
                  <FolderInput className="w-3.5 h-3.5" />
                  <input
                    type="text"
                    value={subfolder}
                    onChange={handleSubfolderChange}
                    placeholder="Add to subfolder (e.g. Cardiology)"
                    className="bg-transparent border-none text-xs font-medium text-gray-400 focus:outline-none focus:ring-0 placeholder-gray-600 w-full"
                  />
                </div>
                <textarea
                  value={rawContent}
                  onChange={handleContentChange}
                  onBlur={handleBlur}
                  onPaste={handlePaste}
                  placeholder="Start typing your raw notes here... Auto-Magic will format them when you paste or click away."
                  className={`flex-1 w-full bg-transparent text-gray-300 resize-none focus:outline-none font-mono leading-relaxed min-h-[500px] ${getFontSizeClass()}`}
                />
              </div>
            </div>
          )}

          {/* Markdown Preview */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={`flex-1 flex flex-col bg-[#0a0a0a] ${viewMode === 'preview' ? 'w-full max-w-5xl mx-auto' : 'w-1/2'}`}>
              <div className="p-1.5 bg-[#111111] border-b border-gray-800 text-[10px] font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <SplitSquareHorizontal className="w-3 h-3" /> Structured Preview
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className={`prose prose-invert prose-blue max-w-none ${getProseSizeClass()}`}>
                  {!hasMatchingHeading && (
                    <h1 className="text-2xl md:text-3xl font-bold mb-6 text-white border-b border-gray-800 pb-3">{title || 'Untitled Note'}</h1>
                  )}
                  {formattedContent ? (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]} 
                      rehypePlugins={[rehypeHighlight, rehypeRaw, rehypeSlug]}
                    >
                      {formattedContent}
                    </ReactMarkdown>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 mt-20">
                      <Wand2 className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-center px-4">Start typing in the editor.<br/>Auto-Magic will structure your notes automatically!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Outline Sidebar */}
          {showOutline && (
            <div className="w-64 border-l border-gray-800 bg-[#111111] flex flex-col absolute right-0 top-0 bottom-0 z-10 md:relative shadow-2xl md:shadow-none">
              <div className="p-4 border-b border-gray-800 font-medium text-gray-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <List className="w-4 h-4" /> Outline
                </div>
                <button onClick={() => setShowOutline(false)} className="md:hidden text-gray-500 hover:text-gray-300">
                  &times;
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {headings.length > 0 ? (
                  <ul className="space-y-1">
                    {headings.map((heading, index) => (
                      <li key={index} style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}>
                        <a 
                          href={`#${heading.id}`}
                          onClick={() => {
                            if (window.innerWidth < 768) setShowOutline(false);
                          }}
                          className="text-sm text-gray-400 hover:text-blue-400 transition-colors block truncate py-1"
                          title={heading.text}
                        >
                          {heading.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-500 text-center mt-10">
                    No headings found.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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
