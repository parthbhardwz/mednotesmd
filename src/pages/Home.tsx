import { Link } from 'react-router-dom';
import { MAJOR_SUBJECTS, SPECIALTY_SUBJECTS } from '../constants';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0a] text-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3">Final Year MBBS</h1>
          <p className="text-gray-400 text-base max-w-2xl">
            Organize your clinical notes, case presentations, and study materials.
          </p>
        </header>

        <section className="mb-12">
          <h2 className="text-xl font-semibold tracking-tight text-white mb-4 flex items-center gap-3">
            <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
            Major Subjects
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MAJOR_SUBJECTS.map((subject) => (
              <Link
                key={subject.id}
                to={`/subject/${subject.id}`}
                className="group relative flex flex-col p-4 bg-[#111111] border border-gray-800 rounded-xl hover:bg-[#1a1a1a] hover:border-blue-500/50 transition-all duration-300"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-100 mb-1">{subject.name}</h3>
                  <span className="text-[10px] font-semibold tracking-wider text-blue-400 uppercase">Major</span>
                </div>
                <div className="mt-4 flex items-center text-xs font-medium text-blue-500 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">
                  Open <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-white mb-4 flex items-center gap-3">
            <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
            Specialty Subjects
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SPECIALTY_SUBJECTS.map((subject) => (
              <Link
                key={subject.id}
                to={`/subject/${subject.id}`}
                className="group relative flex flex-col p-4 bg-[#111111] border border-gray-800 rounded-xl hover:bg-[#1a1a1a] hover:border-purple-500/50 transition-all duration-300"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-100 mb-1">{subject.name}</h3>
                  <span className="text-[10px] font-semibold tracking-wider text-purple-400 uppercase">Specialty</span>
                </div>
                <div className="mt-4 flex items-center text-xs font-medium text-purple-500 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">
                  Open <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
