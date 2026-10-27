import { DurableObject } from "cloudflare:workers";
import { countRequest, type RateLimitResult, type RateWindow } from "./rate-window.ts";

/**
 * One instance per user, addressed by uid, holding a fixed-window counter.
 *
 * A Durable Object rather than KV because a counter needs read-modify-write:
 * KV is eventually consistent, so two requests landing at once in different
 * locations can both read the old count. A Durable Object runs single-threaded
 * in one place, so concurrent requests from the same user queue up behind each
 * other and the count is exact.
 */
export class RateLimiter extends DurableObject {
  async consume(limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const stored = await this.ctx.storage.get<RateWindow>("window");
    const { next, result } = countRequest(stored, Date.now(), limit, windowSeconds);
    if (next) await this.ctx.storage.put<RateWindow>("window", next);
    return result;
  }
}
