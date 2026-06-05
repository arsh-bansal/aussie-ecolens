'use client';

/**
 * Shared sign-in / auth background video.
 * - Plays through once, then eases into a freeze on the final frame (over the
 *   last RAMP seconds the playback rate ramps 1x -> ~0.15x) instead of looping
 *   or stopping dead.
 * - Wrapped in .auth-video-wrap so the focus zoom/blur (driven by the page's
 *   `auth--focused` class) composes with the video's own entry animation.
 */
export default function AuthVideo({ src = '/into-the-wild-unseen.mp4' }: { src?: string }) {
  return (
    <div className="auth-video-wrap">
      <video
        className="auth-video"
        autoPlay
        muted
        playsInline
        preload="auto"
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (!v.duration) return;
          const RAMP = 2.5; // seconds of slow-down before the freeze
          const remaining = v.duration - v.currentTime;
          if (remaining <= RAMP) {
            const t = Math.max(0, remaining / RAMP); // 1 -> 0 across the ramp
            v.playbackRate = 0.15 + 0.85 * (t * t);  // ease-out, floor 0.15x
          } else if (v.playbackRate !== 1) {
            v.playbackRate = 1;
          }
        }}
        onEnded={(e) => {
          const v = e.currentTarget;
          v.currentTime = Math.max(0, v.duration - 0.05);
          v.pause();
        }}
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}
