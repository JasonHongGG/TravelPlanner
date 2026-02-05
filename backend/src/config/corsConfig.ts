import type { CorsOptions } from "cors";

const normalizeOrigin = (value: string) => value.trim().replace(/\/$/, "");

const rawOrigins = process.env.FRONTEND_ORIGIN || process.env.FRONTEND_ORIGINS;
const allowedOrigins = rawOrigins
    ? rawOrigins.split(",").map(normalizeOrigin).filter(Boolean)
    : [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:7000",
        "https://travelplanner.alberthongtunnel.dpdns.org",
        "http://travel-planner-frontend",
        "http://travel-planner-frontend:80"
    ];

export const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalized = normalizeOrigin(origin);
        if (allowedOrigins.includes(normalized)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
};
