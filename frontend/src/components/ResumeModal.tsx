import { useEffect, useRef } from "react";
import type { ResumeResult } from "../types";

interface Props {
  resume: ResumeResult;
  onClose: () => void;
}

export default function ResumeModal({ resume, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="relative flex h-[80vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Resume ID {resume.ID}
            </h2>
            <p className="text-sm text-gray-500">{resume.Category}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto p-6 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{
            __html: resume.Resume_html || resume.Resume_str,
          }}
        />
      </div>
    </div>
  );
}
