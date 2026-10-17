import { useState, useEffect, useCallback, useRef } from 'react';
import { useStreamFiClient } from '../context/useStreamFiClient.js';

export type ProposalStatus = 'active' | 'passed' | 'failed' | 'pending';

export interface GovernorProposal {
  id: string;
  description: string;
  targetConfig: Record<string, unknown>;
  status: ProposalStatus;
  proposer: string;
  startTime: number;
  endTime: number;
  votesFor: bigint;
  votesAgainst: bigint;
}

export interface UseGovernorProposalsResult {
  proposals: GovernorProposal[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * #836 — Hook wrapping GovernorModule.getProposals().
 * Provides React bindings to query active governor proposals for
 * protocol governance inspection.
 *
 * @param pollIntervalMs - Polling interval in milliseconds. Default 30_000.
 * @param statusFilter - Optional array of proposal statuses to filter by.
 */
export function useGovernorProposals(
  pollIntervalMs = 30_000,
  statusFilter?: ProposalStatus[],
): UseGovernorProposalsResult {
  const { client, isReady } = useStreamFiClient();
  const [proposals, setProposals] = useState<GovernorProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  const fetchProposals = useCallback(() => {
    const requestId = ++requestIdRef.current;

    if (!isReady || !client?.governor) {
      setProposals([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    client.governor
      .getProposals()
      .then((data) => {
        if (requestIdRef.current !== requestId) return;
        const filtered = statusFilter
          ? data.filter((p) => statusFilter.includes(p.status))
          : data;
        setProposals(filtered);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
  }, [client, isReady, statusFilter]);

  useEffect(() => {
    fetchProposals();
    if (pollIntervalMs <= 0) return;
    const interval = setInterval(fetchProposals, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchProposals, pollIntervalMs]);

  return { proposals, loading, error, refetch: fetchProposals };
}
