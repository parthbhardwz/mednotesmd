import { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import Toast, { ToastType } from './Toast';
import { differenceInDays, isToday } from 'date-fns';

export default function WeeklyBacklinkScanner() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const runScan = async () => {
      if (!auth.currentUser) return;
      const userId = auth.currentUser.uid;
      const settingsRef = doc(db, 'userSettings', userId);

      try {
        const settingsSnap = await getDoc(settingsRef);
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.lastBacklinkScanDate) {
            const lastScan = new Date(data.lastBacklinkScanDate);
            const daysSince = differenceInDays(today, lastScan);
            if (daysSince < 7) {
              return; // Less than a week ago
            }
          }
        }

        // Fetch all notes
        const q = query(collection(db, 'notes'), where('userId', '==', userId));
        const notesSnap = await getDocs(q);
        const notes: any[] = notesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((n: any) => !n.isTrashed);

        if (notes.length < 2) return; // Need at least 2 notes to link between them

        // Check if any notes were updated today (on a day when no new notes are added/updated)
        const updatedToday = notes.some((note: any) => {
          if (!note.updatedAt?.toDate) return false;
          return isToday(note.updatedAt.toDate());
        });

        if (updatedToday) {
          console.log("Notes were updated today, postponing weekly backlink scan.");
          return;
        }

        // Mark as scanned today immediately to prevent retry loops if it fails or user navigates away
        await setDoc(settingsRef, {
          userId,
          lastBacklinkScanDate: todayStr
        }, { merge: true });

        setToast({ message: 'Running weekly AI backlink scan in background...', type: 'info' });

        const catalog = notes.map((n: any) => ({ id: n.id, title: n.title }));
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        let linksAdded = 0;

        // Process notes sequentially
        for (const note of notes) {
          if (!note.content || note.content.trim() === '') continue;

          const otherNotes = catalog.filter(c => c.id !== note.id);
          if (otherNotes.length === 0) continue;

          try {
            const response = await ai.models.generateContent({
              model: 'gemini-3.1-flash-preview', // Faster model for bulk operations
              contents: `You are an expert medical AI assistant. Your task is to add markdown backlinks to a medical note.

Catalog of available notes:
${JSON.stringify(otherNotes)}

Current Note Content:
${note.content}

Task:
1. Identify medical terms, concepts, or phrases in the "Current Note Content" that semantically match the titles in the "Catalog of available notes".
2. Replace those terms with markdown links pointing to the note's ID. Format: [matched text](/note/NOTE_ID).
3. DO NOT change any other text, formatting, or meaning.
4. DO NOT add links if the term is already linked.
5. Return ONLY the updated markdown content. If no links are applicable, return the original content exactly as is.`,
            });

            let updatedContent = response.text?.trim() || '';
            
            // Strip markdown code blocks if Gemini wraps the response
            if (updatedContent.startsWith('\`\`\`markdown')) {
              updatedContent = updatedContent.replace(/^\`\`\`markdown\n/, '').replace(/\n\`\`\`$/, '');
            } else if (updatedContent.startsWith('\`\`\`')) {
              updatedContent = updatedContent.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
            }

            // Ensure the response isn't empty and is reasonably similar in length to avoid data loss
            if (updatedContent && updatedContent !== note.content && updatedContent.length > note.content.length * 0.5) {
              await updateDoc(doc(db, 'notes', note.id), {
                content: updatedContent,
                rawContent: updatedContent,
                updatedAt: serverTimestamp()
              });
              linksAdded++;
            }
          } catch (err) {
            console.error(`Failed to process note ${note.id} for backlinks:`, err);
          }
          
          // Small delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        if (linksAdded > 0) {
          setToast({ message: `Weekly scan complete! Added backlinks to ${linksAdded} notes.`, type: 'success' });
        } else {
          setToast({ message: `Weekly scan complete! No new backlinks needed.`, type: 'info' });
        }

      } catch (error) {
        console.error("Weekly backlink scan failed:", error);
      }
    };

    const timer = setTimeout(runScan, 15000); // Run 15 seconds after load to not interfere with DailyScanner
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
