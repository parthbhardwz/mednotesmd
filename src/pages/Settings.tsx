import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Moon, Sun, Monitor, Type, Layout, Sparkles, Download, Shield, Bell, Database, Loader2 } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import Toast, { ToastType } from '../components/Toast';

export default function Settings() {
  const [autoFormat, setAutoFormat] = useState(true);
  const [fontSize, setFontSize] = useState('medium');
  const [defaultView, setDefaultView] = useState('split');
  const [autoSave, setAutoSave] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedAutoFormat = localStorage.getItem('app_autoFormat') !== 'false';
    const savedFontSize = localStorage.getItem('app_fontSize') || 'medium';
    const savedDefaultView = localStorage.getItem('app_defaultView') || 'split';
    const savedAutoSave = localStorage.getItem('app_autoSave') !== 'false';
    const savedNotifications = localStorage.getItem('app_notifications') !== 'false';

    setAutoFormat(savedAutoFormat);
    setFontSize(savedFontSize);
    setDefaultView(savedDefaultView);
    setAutoSave(savedAutoSave);
    setNotifications(savedNotifications);

    const fetchRecommendations = async () => {
      if (!auth.currentUser) return;
      try {
        const settingsRef = doc(db, 'userSettings', auth.currentUser.uid);
        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
          setRecommendations(snap.data().dailyRecommendations || []);
        }
      } catch (error) {
        console.error("Failed to fetch recommendations", error);
      }
    };
    fetchRecommendations();
  }, []);

  // Save settings to localStorage
  const saveSetting = (key: string, value: string | boolean) => {
    localStorage.setItem(`app_${key}`, String(value));
    // In a real app, you might also dispatch an event or use a context to update the app state immediately
  };

  const handleExport = async () => {
    if (!auth.currentUser) return;
    setIsExporting(true);
    try {
      const q = query(
        collection(db, 'notes'),
        where('userId', '==', auth.currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      
      const zip = new JSZip();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const content = data.content || data.rawContent || '';
        const title = data.title || 'Untitled_Note';
        // Sanitize filename
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        zip.file(`${safeTitle}_${doc.id}.md`, content);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'MedNotes_Export.zip');
      setToast({ message: 'Export successful!', type: 'success' });
    } catch (error) {
      console.error('Export failed:', error);
      setToast({ message: 'Failed to export notes.', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0a] text-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-1 flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 text-blue-500" />
              Settings
            </h1>
            <p className="text-gray-400 text-sm">Manage your preferences and application behavior.</p>
          </div>
        </header>

        <div className="space-y-8">
          {/* Appearance Section */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Layout className="w-4 h-4 text-purple-400" />
              Appearance
            </h2>
            <div className="bg-[#111111] border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-200">Editor Font Size</h3>
                  <p className="text-xs text-gray-500">Adjust the text size in the note editor.</p>
                </div>
                <select 
                  value={fontSize} 
                  onChange={(e) => { setFontSize(e.target.value); saveSetting('fontSize', e.target.value); }}
                  className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="xlarge">Extra Large</option>
                </select>
              </div>

              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-200">Default View Mode</h3>
                  <p className="text-xs text-gray-500">How notes open by default on desktop.</p>
                </div>
                <select 
                  value={defaultView} 
                  onChange={(e) => { setDefaultView(e.target.value); saveSetting('defaultView', e.target.value); }}
                  className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                >
                  <option value="edit">Edit Only</option>
                  <option value="split">Split View</option>
                  <option value="preview">Preview Only</option>
                </select>
              </div>
            </div>
          </section>

          {/* Editor & AI Section */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              Editor & AI
            </h2>
            <div className="bg-[#111111] border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-200">Auto-Magic Formatting</h3>
                  <p className="text-xs text-gray-500">Automatically structure notes when pasting or pausing.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={autoFormat} onChange={(e) => { setAutoFormat(e.target.checked); saveSetting('autoFormat', e.target.checked); }} />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-200">Auto-Save</h3>
                  <p className="text-xs text-gray-500">Save notes automatically as you type.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={autoSave} onChange={(e) => { setAutoSave(e.target.checked); saveSetting('autoSave', e.target.checked); }} />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Data & Privacy Section */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              AI Folder Recommendations
            </h2>
            <div className="bg-[#111111] border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
              <div className="p-4">
                <p className="text-xs text-gray-400 mb-3">
                  Gemini analyzes your folder structure daily to suggest improvements.
                </p>
                {recommendations.length > 0 ? (
                  <ul className="space-y-2">
                    {recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-300 bg-gray-900/50 p-2.5 rounded-lg border border-gray-800">
                        <Sparkles className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-4 text-gray-500 text-xs">
                    No recommendations available yet. Check back later!
                  </div>
                )}
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-400" />
              Data & Privacy
            </h2>
            <div className="bg-[#111111] border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-200">In-App Notifications</h3>
                  <p className="text-xs text-gray-500">Show toast notifications for actions like saving.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={notifications} onChange={(e) => { setNotifications(e.target.checked); saveSetting('notifications', e.target.checked); }} />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-200">Export All Data</h3>
                  <p className="text-xs text-gray-500">Download a backup of all your notes.</p>
                </div>
                <button 
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {isExporting ? 'Exporting...' : 'Export ZIP'}
                </button>
              </div>
            </div>
          </section>
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
