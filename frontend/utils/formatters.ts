import React from 'react';
import { TripData } from '../types';

// Helper to safely render content (handles strings, numbers, objects)
export const safeRender = (content: any): React.ReactNode => {
  if (typeof content === 'string') return content;
  if (typeof content === 'number') return content;
  if (typeof content === 'object' && content !== null) {
    if (content.description) return content.description;
    if (content.text) return content.text;
    if (content.type) return `${content.type}: ${content.description || ''}`;
    return JSON.stringify(content);
  }
  return '';
};

// Helper to parse cost string to number (e.g., "¥2000" -> 2000)
export const parseCostToNumber = (costStr: string | undefined): number => {
  if (!costStr) return 0;
  // Remove commas and non-numeric chars except digits
  const clean = costStr.replace(/,/g, '');
  const match = clean.match(/(\d+)/);
  if (match) {
    return parseInt(match[0], 10);
  }
  return 0;
};

// Map i18n code to display name
export const formatLanguage = (lng: string | undefined): string => {
  if (!lng) return '';
  switch (lng) {
    case 'en-US': return 'English';
    case 'ja-JP': return '日本語';
    case 'ko-KR': return '한국어';
    case 'zh-TW': return '繁體中文';
    case 'zh-CN': return '简体中文';
    default: return lng; // Fallback to code
  }
};
