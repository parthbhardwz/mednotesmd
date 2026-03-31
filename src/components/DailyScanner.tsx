import { useEffect, useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { ALL_SUBJECTS } from '../constants';
import Toast, { ToastType } from './Toast';

export default function DailyScanner() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const runScan = async () => {
      if (!auth.currentUser) return;
      const userId = auth.currentUser.uid;
      const settingsRef = doc(db, 'userSettings', userId);
      
      try {
        const settingsSnap = await getDoc(settingsRef);
        const today = new Date().toISOString().split('T')[0];
        
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.lastScanDate === today) {
            return; // Already scanned today
          }
        }

        // Fetch all notes
        const q = query(collection(db, 'notes'), where('userId', '==', userId));
        const notesSnap = await getDocs(q);
        const notes = notesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((n: any) => !n.isTrashed);

        if (notes.length === 0) return;

        // Group notes by subject and subfolder
        const structure: Record<string, Record<string, string[]>> = {};
        notes.forEach((note: any) => {
          const subject = ALL_SUBJECTS.find(s => s.id === note.subject)?.name || note.subject;
          const subfolder = note.subfolder || 'Uncategorized';
          if (!structure[subject]) structure[subject] = {};
          if (!structure[subject][subfolder]) structure[subject][subfolder] = [];
          structure[subject][subfolder].push(note.title || 'Untitled Note');
        });

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: `You are an expert medical organizer. Analyze the following folder structure of a medical student's notes.
Provide a concise list of recommendations to improve the organization. For example, suggest merging similar subfolders, creating new subfolders for uncategorized notes, or renaming subfolders for better clarity.
Return the recommendations as a JSON array of strings.

Current Structure:
${JSON.stringify(structure, null, 2)}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: { type: "STRING" }
            }
          }
        });

        let recommendations: string[] = [];
        try {
          recommendations = JSON.parse(response.text || '[]');
        } catch (e) {
          console.error("Failed to parse recommendations", e);
        }

        // Save recommendations and update last scan date
        await setDoc(settingsRef, {
          userId,
          lastScanDate: today,
          dailyRecommendations: recommendations
        }, { merge: true });

        if (recommendations.length > 0) {
          setToast({ message: 'New folder organization recommendations available!', type: 'info' });
        }

      } catch (error) {
        console.error("Daily scan failed:", error);
      }
    };

    // Run scan after a short delay to not block initial render
    const timer = setTimeout(runScan, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!toast) return null;

  return (
    <Toast
      message={toast.message}
      type={toast.type}
      onClose={() => setToast(null)}
    />
  );
}
