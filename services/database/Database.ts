
import { TripModel } from "./models/TripModel";
import { UserModel } from "./models/UserModel";
import { RestApiAdapter } from "./adapters/RestApiAdapter";

export class Database {
    private static instance: Database;

    public trips: TripModel;
    public users: UserModel;

    private constructor() {
        console.log("[Database] Initializing Database with RestApiAdapter...");
        const adapter = new RestApiAdapter();

        // Inject adapter into models
        this.trips = new TripModel(adapter);
        this.users = new UserModel(adapter);
    }

    public static getInstance(): Database {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }
}

export const db = Database.getInstance();
