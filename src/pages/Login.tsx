import { signInWithGoogle } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { BookOpen, LogIn } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col justify-center items-center p-4 text-white font-sans">
      <div className="w-full max-w-md bg-[#111111] p-8 rounded-2xl border border-gray-800 shadow-2xl flex flex-col items-center">
        <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
          <BookOpen className="w-8 h-8 text-blue-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-center">MedNotes Pro</h1>
        <p className="text-gray-400 text-center mb-8">
          The ultimate Obsidian-like note-taking app for MBBS students, powered by Gemini AI.
        </p>
        
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white text-black font-medium py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
