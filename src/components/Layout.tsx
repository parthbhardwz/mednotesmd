import { Outlet, Link, useNavigate } from 'react-router-dom';
import { auth, logOut } from '../firebase';
import { LogOut, BookOpen, MessageSquare, Menu, X, Trash2, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import Chatbot from './Chatbot';
import DailyScanner from './DailyScanner';
import WeeklyBacklinkScanner from './WeeklyBacklinkScanner';

export default function Layout() {
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    await logOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-100 font-sans overflow-hidden">
      <DailyScanner />
      <WeeklyBacklinkScanner />
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col border-r border-gray-800 bg-[#111111] transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className={`p-4 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && (
            <Link to="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white truncate">
              <BookOpen className="w-6 h-6 text-blue-500 shrink-0" />
              <span className="truncate">MedNotes Pro</span>
            </Link>
          )}
          {isSidebarCollapsed && (
            <Link to="/" title="MedNotes Pro">
              <BookOpen className="w-6 h-6 text-blue-500 shrink-0" />
            </Link>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-800 transition-colors hidden md:block"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          <Link to="/" className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-gray-300 hover:bg-gray-800 hover:text-white transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`} title="Subjects">
            <BookOpen className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="truncate">Subjects</span>}
          </Link>
          <button 
            onClick={() => setIsChatOpen(true)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-gray-300 hover:bg-gray-800 hover:text-white transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title="Gemini Assistant"
          >
            <MessageSquare className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="truncate">Gemini Assistant</span>}
          </button>
          <Link to="/trash" className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-gray-300 hover:bg-gray-800 hover:text-white transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`} title="Trash">
            <Trash2 className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="truncate">Trash</span>}
          </Link>
          <Link to="/settings" className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-gray-300 hover:bg-gray-800 hover:text-white transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`} title="Settings">
            <Settings className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="truncate">Settings</span>}
          </Link>
        </nav>

        <div className="p-3 border-t border-gray-800">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-3' : 'justify-between'}`}>
            <div className={`flex items-center gap-3 truncate ${isSidebarCollapsed ? 'justify-center' : ''}`} title={auth.currentUser?.displayName || 'User'}>
              {auth.currentUser?.photoURL ? (
                <img src={auth.currentUser.photoURL} alt="Profile" className="w-8 h-8 rounded-full shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium shrink-0">
                  {auth.currentUser?.displayName?.charAt(0) || 'U'}
                </div>
              )}
              {!isSidebarCollapsed && <span className="text-sm font-medium truncate">{auth.currentUser?.displayName}</span>}
            </div>
            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-gray-800 transition-colors shrink-0" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-gray-800 bg-[#111111] z-20 flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-white">
          <BookOpen className="w-5 h-5 text-blue-500" />
          MedNotes
        </Link>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-300">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-[#111111] z-20 flex flex-col border-t border-gray-800">
          <nav className="flex-1 p-4 space-y-4">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-200 hover:bg-gray-800">
              <BookOpen className="w-5 h-5" />
              Subjects
            </Link>
            <button 
              onClick={() => { setIsChatOpen(true); setIsMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-200 hover:bg-gray-800"
            >
              <MessageSquare className="w-5 h-5" />
              Gemini Assistant
            </button>
            <Link to="/trash" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-200 hover:bg-gray-800">
              <Trash2 className="w-5 h-5" />
              Trash
            </Link>
            <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-200 hover:bg-gray-800">
              <Settings className="w-5 h-5" />
              Settings
            </Link>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-gray-800">
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pt-16 md:pt-0 relative">
        <Outlet />
      </main>

      {/* Chatbot Drawer */}
      <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}
