
export interface IStorageAdapter {
    /**
     * Finds a single record in the given collection matching the criteria.
     * @param collection The name of the collection (e.g., 'users')
     * @param id The ID or primary key (e.g., user email)
     */
    findById<T>(collection: string, id: string): Promise<T | null>;

    /**
     * Creates a new record in the collection.
     * @param collection The name of the collection
     * @param data The data to create
     */
    create<T>(collection: string, data: T): Promise<T>;

    /**
     * Updates a record in the collection.
     * @param collection The name of the collection
     * @param id The ID of the record to update
     * @param data The partial data to update
     */
    update<T>(collection: string, id: string, data: Partial<T>): Promise<T | null>;

    /**
     * Custom method execution for specialized operations
     * @param collection Collection name
     * @param operation Name of the custom operation (e.g., 'transaction')
     * @param params Parameters for the operation
     */
    execute<T>(collection: string, operation: string, params: any): Promise<T>;
}
