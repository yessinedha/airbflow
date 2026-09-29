'use client'

import { useState } from 'react'
import type { DashboardReview } from '@/lib/dashboard/reviews'

interface ReviewCarouselLabels {
  title: string
  description: string
  empty: string
  verified: string
  rating: string
  pause: string
  resume: string
}

export function ReviewCarousel({
  reviews,
  labels,
}: {
  reviews: DashboardReview[]
  labels: ReviewCarouselLabels
}) {
  const publishedReviews = reviews.filter((review) => review.consentGiven && review.verified)
  const [paused, setPaused] = useState(false)
  const shouldRoll = publishedReviews.length > 1
  const reviewCopies = Array.from({ length: shouldRoll ? 2 : 1 }, (_, index) => index)

  return (
    <section
      aria-labelledby="community-reviews-title"
      className="relative isolate overflow-hidden rounded-card border border-border bg-surface shadow-card"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -end-20 -top-24 -z-10 h-64 w-64 rounded-full bg-brand/10 blur-3xl"
      />
      <div className="relative p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="label-mono text-brand">✦ · {labels.verified}</p>
            <h2 id="community-reviews-title" className="display mt-2 text-2xl font-semibold sm:text-3xl">
              {labels.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{labels.description}</p>
          </div>

          {publishedReviews.length > 1 ? (
            <button
              type="button"
              aria-pressed={paused}
              onClick={() => setPaused((current) => !current)}
              className="shrink-0 rounded-control border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-ink-muted transition hover:border-brand/50 hover:text-ink"
            >
              {paused ? labels.resume : labels.pause}
            </button>
          ) : null}
        </div>

        {publishedReviews.length === 0 ? (
          <div className="mt-6 rounded-card border border-dashed border-border-strong bg-surface-2/60 px-5 py-8 text-center">
            <span aria-hidden="true" className="text-2xl text-brand">
              ✦
            </span>
            <p className="mt-2 text-sm text-ink-muted">{labels.empty}</p>
          </div>
        ) : (
          <div
            className="review-roll-viewport mt-6 max-h-[36rem] overflow-hidden"
            role="region"
            aria-label={labels.title}
            aria-roledescription="carousel"
          >
            <div
              className={shouldRoll ? 'review-roll-track' : undefined}
              style={
                shouldRoll
                  ? {
                      animationDuration: `${Math.max(24, publishedReviews.length * 3)}s`,
                      animationPlayState: paused ? 'paused' : 'running',
                    }
                  : undefined
              }
            >
              {reviewCopies.map((copy) => (
                <div
                  key={copy}
                  className={`review-roll-copy divide-y divide-border${copy === 1 ? ' review-roll-copy-clone' : ''}`}
                  aria-hidden={copy === 1 ? true : undefined}
                >
                  {publishedReviews.map((review) => (
                    <article
                      key={review.id}
                      className="grid gap-2 px-1 py-4 first:pt-1 last:pb-1 sm:grid-cols-[12rem_minmax(0,1fr)_9rem] sm:items-center sm:gap-5"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-3 sm:flex-col sm:items-start sm:justify-center sm:gap-1">
                        <p className="min-w-0 truncate text-sm font-semibold text-ink">{review.name}</p>
                        {review.emoji ? (
                          <span aria-hidden="true" className="shrink-0 text-base">
                            {review.emoji}
                          </span>
                        ) : null}
                        {review.rating ? (
                          <p className="shrink-0 text-xs tracking-wider text-brand" aria-label={labels.rating.replace('{rating}', String(review.rating))}>
                            <span aria-hidden="true">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                          </p>
                        ) : null}
                      </div>

                      <p className="min-w-0 text-sm leading-relaxed text-ink-muted">{review.comment}</p>

                      <p className="flex items-center gap-1.5 text-[11px] font-medium text-positive sm:justify-end">
                        <span aria-hidden="true" className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-positive-soft">
                          ✓
                        </span>
                        {labels.verified}
                      </p>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}