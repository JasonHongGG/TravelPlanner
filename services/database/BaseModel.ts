
import { IStorageAdapter } from "./interfaces/IStorageAdapter";

export interface IBaseModel<T> {
    create(data: T): Promise<T>;
    findById(id: string): Promise<T | null>;
    update(id: string, data: Partial<T>): Promise<T | null>;
}

export abstract class BaseModel<T> implements IBaseModel<T> {
    protected abstract collectionName: string;
    protected adapter: IStorageAdapter;

    constructor(adapter: IStorageAdapter) {
        this.adapter = adapter;
    }

    async create(data: T): Promise<T> {
        return this.adapter.create<T>(this.collectionName, data);
    }

    async findById(id: string): Promise<T | null> {
        return this.adapter.findById<T>(this.collectionName, id);
    }

    async update(id: string, data: Partial<T>): Promise<T | null> {
        return this.adapter.update<T>(this.collectionName, id, data);
    }
}
