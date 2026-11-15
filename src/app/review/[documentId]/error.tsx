'use client';
import { ReviewDetailNotice } from '@/components/review';
export default function ReviewDetailError({ reset }: { reset: () => void }) { return <ReviewDetailNotice state="error" onRetry={reset} />; }
