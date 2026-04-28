import type { AttractionRecommendation, TripStop } from '../types';

export type ExplorerTab = 'attraction' | 'food';
export type ExplorerStopStatus = 'keep' | 'remove' | 'neutral';

export type ExplorerRecommendationBuckets = Record<ExplorerTab, AttractionRecommendation[]>;

export function getPromptLanguageName(lng: string): string {
    switch (lng) {
        case 'en-US': return 'English';
        case 'ja-JP': return 'Japanese';
        case 'ko-KR': return 'Korean';
        default: return 'Traditional Chinese';
    }
}

export function createInitialStopStatuses(stops: TripStop[]): Record<string, ExplorerStopStatus> {
    return stops.reduce<Record<string, ExplorerStopStatus>>((statuses, stop) => {
        statuses[stop.name] = 'neutral';
        return statuses;
    }, {});
}

export function collectKnownRecommendationNames(input: {
    currentStops: Pick<TripStop, 'name'>[];
    results: ExplorerRecommendationBuckets;
    buffer: ExplorerRecommendationBuckets;
    tab: ExplorerTab;
}): string[] {
    return [
        ...input.currentStops.map(stop => stop.name),
        ...input.results[input.tab].map(item => item.name),
        ...input.buffer[input.tab].map(item => item.name)
    ];
}