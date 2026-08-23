/** Type-only contract shared by the content script and the startup-safe worker. */
export type ProjectOption = {
  id: string;
  name: string;
};

export type AnalyzeYouTubeRequest = {
  type: "ANALYZE_YOUTUBE";
  videoId: string;
  title: string;
  channelId?: string;
  reAnalyze: boolean;
  projectId?: string;
  instruction?: string;
};

export type GetLocalHealthRequest = { type: "GET_LOCAL_HEALTH" };
export type GetYouTubeJobsRequest = { type: "GET_YOUTUBE_JOBS" };
export type GetFarplaneProjectsRequest = { type: "GET_FARPLANE_PROJECTS" };

export type RuntimeRequest =
  | AnalyzeYouTubeRequest
  | GetLocalHealthRequest
  | GetYouTubeJobsRequest
  | GetFarplaneProjectsRequest;
