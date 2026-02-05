import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define colors for each level (for console output)
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

// Tell winston that we want to link the colors
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    // winston.format.colorize({ all: true }), // Colorize for console, generally used in dev
    winston.format.printf(
        (info) => `[${info.timestamp}] ${info.level}: ${info.message}${info.correlationId ? ` (CID: ${info.correlationId})` : ''}`
    )
);

// JSON format for file logging (Machine Readable)
const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
);

// Define transports
const transports = [
    // Console: standardized readable format
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            format
        ),
    }),
    // Error File: only errors
    new winston.transports.File({
        filename: path.join('logs', 'error.log'),
        level: 'error',
        format: jsonFormat,
    }),
    // Combined File: all logs
    new winston.transports.File({
        filename: path.join('logs', 'combined.log'),
        format: jsonFormat,
    }),
];

export const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
    levels,
    transports,
});
