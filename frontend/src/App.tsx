import { useState, useEffect } from "react";
import { fetchPostings, searchResumes } from "./api";
import type { Posting, ResumeResult } from "./types";
import JobSelector from "./components/JobSelector";
import ResumeRanking from "./components/ResumeRanking";
import ChatPanel from "./components/ChatPanel";

export default function App() {
  const [postings, setPostings] = useState<Posting[]>([]);
  const [selectedPosting, setSelectedPosting] = useState<Posting | null>(null);
  const [results, setResults] = useState<ResumeResult[]>([]);
  const [loadingPostings, setLoadingPostings] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPostings()
      .then(setPostings)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingPostings(false));
  }, []);

  async function handleSelectPosting(posting: Posting | null) {
    setSelectedPosting(posting);
    setResults([]);
    if (!posting) return;
    setLoadingSearch(true);
    try {
      const ranked = await searchResumes(posting.description);
      setResults(ranked);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoadingSearch(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Resume Screener</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          AI-powered semantic search powered by pgvector + Claude
        </p>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-[480px] flex flex-col border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            {loadingPostings ? (
              <p className="text-sm text-gray-400">Loading postings…</p>
            ) : error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : (
              <JobSelector
                postings={postings}
                selected={selectedPosting}
                onSelect={handleSelectPosting}
              />
            )}
          </div>

          <div className="flex-1 p-4">
            {loadingSearch && (
              <p className="text-sm text-gray-400">Ranking resumes…</p>
            )}
            {!loadingSearch && selectedPosting && results.length > 0 && (
              <ResumeRanking results={results} />
            )}
            {!loadingSearch && !selectedPosting && (
              <p className="text-sm text-gray-400">
                Select a job posting to rank candidates.
              </p>
            )}
          </div>
        </div>

        {/* Right panel — chat */}
        <div className="flex-1 flex flex-col">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
