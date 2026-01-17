
import { BaseModel } from "../BaseModel";
import { Trip } from "../../../types";

export class TripModel extends BaseModel<Trip> {
    protected collectionName = 'trips';

    // The generic methods (create, findById, etc.) are already handled by BaseModel + Adapter
    // specific Trip-related methods can be added here
}
