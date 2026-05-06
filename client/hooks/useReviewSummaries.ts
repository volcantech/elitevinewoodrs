import { useState, useEffect } from "react";

export interface ReviewSummary {
  average: number;
  total: number;
}

export type ReviewSummariesMap = Record<string, ReviewSummary>;

let cachedSummaries: ReviewSummariesMap | null = null;
let fetchPromise: Promise<ReviewSummariesMap> | null = null;

function fetchSummaries(): Promise<ReviewSummariesMap> {
  if (cachedSummaries) return Promise.resolve(cachedSummaries);
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch("/api/reviews/summaries")
    .then((r) => r.json())
    .then((data) => {
      cachedSummaries = data;
      fetchPromise = null;
      return data as ReviewSummariesMap;
    })
    .catch(() => {
      fetchPromise = null;
      return {} as ReviewSummariesMap;
    });
  return fetchPromise;
}

export function invalidateReviewSummaries(vehicleId: string, newAverage: number, newTotal: number) {
  if (cachedSummaries) {
    cachedSummaries = {
      ...cachedSummaries,
      [vehicleId]: { average: newAverage, total: newTotal },
    };
  }
}

export function useReviewSummaries() {
  const [summaries, setSummaries] = useState<ReviewSummariesMap>(cachedSummaries ?? {});

  useEffect(() => {
    fetchSummaries().then((data) => setSummaries(data));
  }, []);

  return summaries;
}
