export enum AppStep {
  AUTH = 0,
  DASHBOARD = 1,
  PROMPT = 2,
  STYLE = 3,
  GENERATING = 4,
  RESULT = 5,
  FEEDBACK = 6
}

export enum ArtStyle {
  THREE_D = '3D Render',
  PHOTOGRAPH = 'Photograph',
  ILLUSTRATION = 'Illustration',
  PAINTING = 'Painting',
  CARTOON = 'Cartoon',
  INFOGRAPHIC = 'Infographic',
  DIAGRAM = 'Technical Diagram',
  STICK = 'Stick Figure'
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
}

export interface GenerationRequest {
  prompt: string;
  style: ArtStyle;
  baseImage: string | null; // Base64 string for editing
}

export interface HistoryItem {
  id: string;
  image: string;
  prompt: string;
  style: string;
  date: Date;
}