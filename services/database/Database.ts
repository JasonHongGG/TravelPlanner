
import { TripModel } from "./models/TripModel";

export class Database {
    private static instance: Database;

    // Models
    public trips: TripModel;

    private constructor() {
        console.log("[Database] Initializing Database Concept...");
        this.trips = new TripModel();
    }

    public static getInstance(): Database {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }

    public async connect(): Promise<void> {
        console.log("[Database] Connecting to database (Mock)...");
        // Logic to connect to real DB would go here
        console.log("[Database] Connected.");
    }
}

export const db = Database.getInstance();
