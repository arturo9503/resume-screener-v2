export interface Posting {
  job_id: number;
  company_name: string;
  title: string;
  description: string;
  location: string;
}

export interface ResumeResult {
  ID: number;
  Category: string;
  Resume_str: string;
  Resume_html: string;
  score: number;
}

export interface ChatSource {
  ID: number;
  Category: string;
  score: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
