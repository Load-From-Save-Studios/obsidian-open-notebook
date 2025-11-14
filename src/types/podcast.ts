// Podcast types for Open Notebook integration

export interface APIEpisodeProfile {
  id: string;
  name: string;
  description?: string;
  speaker_config: string;
  outline_provider: string;
  outline_model: string;
  transcript_provider: string;
  transcript_model: string;
  default_briefing: string;
  num_segments: number;
}

export interface APISpeakerProfile {
  id: string;
  name: string;
  description?: string;
  tts_provider: string;
  tts_model: string;
  speakers: Array<{
    name: string;
    voice_id: string;
    backstory: string;
    personality: string;
  }>;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  notebookId: string;
  status: PodcastStatus;
  audioUrl?: string;
  audioPath?: string;
  duration?: number;
  created: Date;
  updated: Date;
  error?: string;
}

export interface APIPodcastEpisode {
  id: string;
  name: string;  // Backend uses "name", not "title"
  episode_profile: Record<string, any>;
  speaker_profile: Record<string, any>;
  briefing: string;
  audio_file?: string;
  audio_url?: string;
  transcript?: Record<string, any>;
  outline?: Record<string, any>;
  created?: string;
  job_status?: string;  // Backend uses "job_status", not "status"
}

export type PodcastStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PodcastGenerateRequest {
  episode_profile: string;
  speaker_profile: string;
  episode_name: string;
  notebook_id?: string;
  content?: string;
  briefing_suffix?: string;
}

export interface PodcastGenerateResponse {
  job_id: string;
  status: string;
  message: string;
  episode_profile: string;
  episode_name: string;
}
