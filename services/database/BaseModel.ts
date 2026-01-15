
export interface IBaseModel<T> {
    create(data: T): Promise<T>;
    findById(id: string): Promise<T | null>;
    findAll(): Promise<T[]>;
    update(id: string, data: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
}

export abstract class BaseModel<T> implements IBaseModel<T> {
    protected abstract collectionName: string;

    // These methods are placeholders for now, to be implemented with real DB logic later.
    // Currently they can just resolve to mock data or be empty.

    async create(data: T): Promise<T> {
        console.log(`[Database] ${this.collectionName}: Creating`, data);
        return Promise.resolve(data);
    }

    async findById(id: string): Promise<T | null> {
        console.log(`[Database] ${this.collectionName}: Finding by ID`, id);
        return Promise.resolve(null);
    }

    async findAll(): Promise<T[]> {
        console.log(`[Database] ${this.collectionName}: Finding all`);
        return Promise.resolve([]);
    }

    async update(id: string, data: Partial<T>): Promise<T | null> {
        console.log(`[Database] ${this.collectionName}: Updating ${id}`, data);
        return Promise.resolve(null); // Return null or mock updated object
    }

    async delete(id: string): Promise<boolean> {
        console.log(`[Database] ${this.collectionName}: Deleting ${id}`);
        return Promise.resolve(true);
    }
}
