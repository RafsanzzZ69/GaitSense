const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export type AssessmentSummary = {
  id: string;
  capturedAt: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  overallScore?: number;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) throw new Error(`GaitSense API error (${response.status})`);
  return response.json() as Promise<T>;
}

export const api = {
  listAssessments: () => request<AssessmentSummary[]>('/assessments'),
  getAssessment: (id: string) => request<AssessmentSummary>(`/assessments/${id}`),
};
