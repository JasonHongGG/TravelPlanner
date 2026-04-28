import { TripDay } from '../types';

// Helper to calculate the correct map configuration (Route vs Single City)
export const getDayMapConfig = (day: TripDay | undefined, destination: string) => {
    const city = destination;
    if (day && day.stops && day.stops.length > 0) {
        if (day.stops.length === 1) {
            // Single Stop Focus
            const stopName = day.stops[0].name;
            const query = `${stopName}, ${city}`;
            return {
                url: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=14&ie=UTF8&iwloc=&output=embed`,
                label: `Focusing on: ${stopName}`
            };
        } else {
            // Route Planning Mode (Start -> Waypoints -> End)
            const stops = day.stops;
            const origin = `${stops[0].name}, ${city}`;
            
            // Remaining stops are destinations/waypoints
            // "daddr" supports multiple locations separated by "+to:"
            const destinations = stops.slice(1).map(s => `${s.name}, ${city}`);
            
            const encodedOrigin = encodeURIComponent(origin);
            const encodedDestinations = destinations.map(d => encodeURIComponent(d)).join('+to:');
            
            return {
                url: `https://maps.google.com/maps?saddr=${encodedOrigin}&daddr=${encodedDestinations}&output=embed`,
                label: `Day ${day.day} Route • ${stops.length} Stops`
            };
        }
    } else {
        // Fallback to City View
        return {
            url: `https://maps.google.com/maps?q=${encodeURIComponent(city)}&t=&z=13&ie=UTF8&iwloc=&output=embed`,
            label: `Exploring: ${city}`
        };
    }
};
