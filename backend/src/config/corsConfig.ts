import type { CorsOptions } from "cors";

const rawOrigins = process.env.FRONTEND_ORIGIN || process.env.FRONTEND_ORIGINS;
const allowedOrigins = rawOrigins
    ? rawOrigins.split(",").map(origin => origin.trim()).filter(Boolean)
    : ["http://localhost:5173", "http://localhost:3000"];

export const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
    }
};
