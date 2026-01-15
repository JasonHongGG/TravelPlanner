
import { BaseModel } from "../BaseModel";
import { Trip } from "../../../types";

export class TripModel extends BaseModel<Trip> {
    protected collectionName = 'trips';

    // You can add specific Trip-related database methods here
    async findByStatus(status: string): Promise<Trip[]> {
        console.log(`[Database] ${this.collectionName}: Finding by status ${status}`);
        return Promise.resolve([]);
    }
}
