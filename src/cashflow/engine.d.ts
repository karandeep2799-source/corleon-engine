export interface CommissionReleaseResult {
  released: number;
}

export function releaseHeldCommissions(
  now?: Date,
  limit?: number,
): Promise<CommissionReleaseResult>;
