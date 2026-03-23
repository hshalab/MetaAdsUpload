"use client";

import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import { useParams } from "next/navigation";
import { VideoPlayer } from "@/components/review/video-player";
import { VideoControls } from "@/components/review/video-controls";
import { Timeline } from "@/components/review/timeline";
import { CommentList } from "@/components/review/comment-list";
import { CommentInput } from "@/components/review/comment-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock, Megaphone, Video, Loader2 } from "lucide-react";
import {
  type DeliverableVersion,
  type ReviewComment,
  playerReducer,
  initialPlayerState,
} from "@/lib/review-types";

interface ReviewData {
  assignment: { id: string; title: string; autoName: string | null };
  version: DeliverableVersion;
  versions: DeliverableVersion[];
  allowComments: boolean;
}

export default function PublicReviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [guestName, setGuestName] = useState("");

  const [playerState, playerDispatch] = useReducer(playerReducer, initialPlayerState);
  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchReviewData = useCallback(
    async (pw?: string) => {
      try {
        let res: Response;

        if (pw) {
          // POST with password in body (secure — not in URL/logs)
          res = await fetch(`/api/review/${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: pw }),
          });
        } else {
          // Initial GET — will return 401 if password required
          res = await fetch(`/api/review/${token}`);
        }

        if (res.status === 401) {
          const data = await res.json();
          if (data.requiresPassword) {
            setNeedsPassword(true);
            setPasswordError(!!pw);
            setLoading(false);
            return;
          }
          // Password was wrong
          setNeedsPassword(true);
          setPasswordError(true);
          setLoading(false);
          return;
        }

        if (!res.ok) throw new Error("Invalid or expired link");

        const data = await res.json();
        setReviewData(data);
        setNeedsPassword(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/review/${token}/comments`);
      if (res.ok) setComments(await res.json());
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchReviewData();
  }, [fetchReviewData]);

  useEffect(() => {
    if (reviewData) fetchComments();
  }, [reviewData, fetchComments]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    fetchReviewData(password);
  };

  const handlePlay = () => {
    videoRef.current?.play();
    playerDispatch({ type: "SET_PLAYING", playing: true });
  };
  const handlePause = () => {
    videoRef.current?.pause();
    playerDispatch({ type: "SET_PLAYING", playing: false });
  };
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      playerDispatch({ type: "SET_TIME", time });
    }
  };
  const handleSetRate = (rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    playerDispatch({ type: "SET_RATE", rate });
  };
  const handleSetVolume = (volume: number) => {
    if (videoRef.current) videoRef.current.volume = volume;
    playerDispatch({ type: "SET_VOLUME", volume });
  };
  const handleToggleMute = () => {
    if (videoRef.current) videoRef.current.muted = !playerState.muted;
    playerDispatch({ type: "SET_MUTED", muted: !playerState.muted });
  };

  const handleSubmitComment = async (data: {
    body: string;
    timecodeSeconds: number | null;
    annotation: import("@/lib/review-types").AnnotationData | null;
    isInternal: boolean;
    guestName: string | null;
  }) => {
    try {
      const res = await fetch(`/api/review/${token}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyText: data.body,
          timecodeSeconds: data.timecodeSeconds,
          annotation: data.annotation,
          guestName: data.guestName || guestName || "Guest",
        }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      await fetchComments();
    } catch {}
  };

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">
            {error}
          </h2>
          <p className="text-slate-500 text-sm">
            This review link may have expired or been revoked.
          </p>
        </div>
      </div>
    );
  }

  // Password gate
  if (needsPassword) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <form
          onSubmit={handlePasswordSubmit}
          className="w-full max-w-sm space-y-4 p-6 rounded-xl border border-white/10 bg-[#111827]"
        >
          <div className="flex items-center gap-3 mb-2">
            <Lock className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">
              Password Required
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            Enter the password to access this review.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(false);
            }}
            placeholder="Password"
            className={`w-full px-3 py-2 rounded-lg bg-white/5 border text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
              passwordError ? "border-red-500" : "border-white/10"
            }`}
            autoFocus
          />
          {passwordError && (
            <p className="text-xs text-red-400">Incorrect password</p>
          )}
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  if (!reviewData) return null;

  const { assignment, version } = reviewData;
  const isVideo = version.contentType.startsWith("video/");

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
            <Megaphone className="h-3.5 w-3.5 text-white" />
          </div>
          <h1 className="text-sm font-semibold text-white truncate">
            {assignment.autoName || assignment.title}
          </h1>
          <span className="text-xs text-slate-500">
            V{version.versionNumber}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video */}
        <div className="flex-1 flex flex-col p-4">
          <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
            <VideoPlayer
              ref={videoRef}
              src={version.r2Url}
              contentType={version.contentType}
              onTimeUpdate={(time) =>
                playerDispatch({ type: "SET_TIME", time })
              }
              onDurationChange={(dur) =>
                playerDispatch({ type: "SET_DURATION", duration: dur })
              }
              onPlay={() =>
                playerDispatch({ type: "SET_PLAYING", playing: true })
              }
              onPause={() =>
                playerDispatch({ type: "SET_PLAYING", playing: false })
              }
              onBufferUpdate={(buffered) =>
                playerDispatch({ type: "SET_BUFFERED", buffered })
              }
            />
          </div>

          {isVideo && (
            <div className="mt-2 space-y-1">
              <Timeline
                currentTime={playerState.currentTime}
                duration={playerState.duration}
                buffered={playerState.buffered}
                comments={comments}
                onSeek={handleSeek}
              />
              <VideoControls
                playerState={playerState}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onSetRate={handleSetRate}
                onSetVolume={handleSetVolume}
                onToggleMute={handleToggleMute}
                onToggleFullscreen={() => {}}
              />
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="w-[360px] border-l border-white/5 flex flex-col">
          <div className="px-4 py-3 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">
              Comments ({comments.length})
            </h2>
          </div>

          <ScrollArea className="flex-1 px-4 py-2">
            <CommentList
              comments={comments}
              onSeek={handleSeek}
            />
          </ScrollArea>

          {reviewData.allowComments && (
            <div className="border-t border-white/5 p-4">
              <div className="mb-2">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <CommentInput
                onSubmit={(data) => handleSubmitComment(data)}
                currentTimecode={
                  !playerState.playing ? playerState.currentTime : undefined
                }
                isGuest
                guestName={guestName}
                onGuestNameChange={setGuestName}
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center py-2 border-t border-white/5 text-xs text-slate-600">
        Powered by MetaAds
      </div>
    </div>
  );
}
