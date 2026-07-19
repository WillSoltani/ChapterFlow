"use client";

import { ProfileSkeletonShimmer } from "./ProfileSkeletonShimmer";

export function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-450 space-y-8 px-4 pb-28 pt-7 sm:px-6 lg:px-10 lg:pt-8 xl:px-16">
      {/* Hero skeleton */}
      <div className="rounded-4xl border border-(--cf-border) bg-(--cf-surface-strong) p-6 sm:p-7 lg:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <ProfileSkeletonShimmer className="h-20 w-20 shrink-0 !rounded-full sm:h-[100px] sm:w-[100px]" />
          <div className="flex-1 space-y-3">
            <ProfileSkeletonShimmer className="h-5 w-32" />
            <ProfileSkeletonShimmer className="h-9 w-64" />
            <ProfileSkeletonShimmer className="h-4 w-40" />
            <ProfileSkeletonShimmer className="h-4 w-72" />
            <div className="flex gap-6 pt-2">
              <ProfileSkeletonShimmer className="h-14 w-24" />
              <ProfileSkeletonShimmer className="h-14 w-24" />
              <ProfileSkeletonShimmer className="h-14 w-24" />
            </div>
          </div>
        </div>
      </div>
      {/* Section skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-3xl border border-(--cf-border) bg-(--cf-surface-strong) p-6">
          <ProfileSkeletonShimmer className="h-5 w-40 mb-4" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ProfileSkeletonShimmer className="h-32" />
            <ProfileSkeletonShimmer className="h-32" />
            <ProfileSkeletonShimmer className="h-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
