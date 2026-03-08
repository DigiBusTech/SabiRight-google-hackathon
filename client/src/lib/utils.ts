import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getYouTubeEmbedUrl(url: string) {
  if (!url) return null;
  const cleanUrl = url.trim();
  
  // Handle various YouTube URL formats including shorts
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = cleanUrl.match(regExp);
  
  return (match && match[2].length === 11) 
    ? `https://www.youtube.com/embed/${match[2]}`
    : cleanUrl; // Return original if no match, though it might not work in iframe if not embed format
}
