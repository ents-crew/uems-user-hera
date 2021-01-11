import { UserMessage, UserResponse } from "@uems/uemscommlib";
import { Collection, FilterQuery, ObjectId, UpdateOneOptions, UpdateQuery } from "mongodb";
import { GenericMongoDatabase } from "@uems/micro-builder";
import ReadUserMessage = UserMessage.ReadUserMessage;
import CreateUserMessage = UserMessage.CreateUserMessage;
import DeleteUserMessage = UserMessage.DeleteUserMessage;
import UpdateUserMessage = UserMessage.UpdateUserMessage;
import InternalUser = UserResponse.InternalUser;

export type InDatabaseUser = {
    _id: ObjectId,
    email: string,
    hash: string,
    name: string,
    uid: string,
    username: string,
    profile?: string,
};

export type CreateInDatabaseUser = Omit<InDatabaseUser, '_id'>;

const stripUndefined = <T>(data: T): T => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as unknown as T;

const dbToInternal = (data: InDatabaseUser, withHash: boolean, withEmail: boolean): InternalUser => stripUndefined({
    username: data.username,
    id: data.uid,
    name: data.name,
    profile: data.profile,
    email: withEmail ? data.email : undefined,
    hash: withHash ? data.hash : undefined,
});

const createToDb = (data: CreateUserMessage): CreateInDatabaseUser => stripUndefined({
    name: data.name,
    email: data.email,
    hash: data.hash,
    uid: data.id,
    username: data.username,
    profile: data.profile,
});

export class UserDatabase extends GenericMongoDatabase<ReadUserMessage, CreateUserMessage, DeleteUserMessage, UpdateUserMessage, InternalUser> {

    protected async createImpl(create: UserMessage.CreateUserMessage, details: Collection): Promise<string[]> {
        const { msg_id, msg_intention, status, ...document } = create;

        const targetDocument = createToDb(create);
        const result = await details.insertOne(targetDocument);

        if (result.insertedCount !== 1 || result.insertedId === undefined) {
            throw new Error('failed to insert')
        }

        const id = (result.insertedId as ObjectId).toHexString();
        await super.log(id, 'inserted');

        // @ts-ignore
        return [document.uid];
    }

    protected async deleteImpl(remove: UserMessage.DeleteUserMessage, details: Collection): Promise<string[]> {
        const { id } = remove;
        if (typeof (id) !== 'string') throw new Error('invalid ID type');

        const query = {
            uid: id,
        };

        const result = await details
            .deleteOne(query);

        if (result.deletedCount !== 1) {
            throw new Error('invalid user ID');
        }

        if (result.result.ok !== 1) {
            throw new Error('failed to delete');
        }

        await this.log(id, 'deleted');

        return [id];
    }

    protected async queryImpl(query: UserMessage.ReadUserMessage, details: Collection): Promise<InternalUser[]> {
        const find: Record<string, unknown> = {};

        if (query.id) {
            find.uid = query.id;
        }

        if (query.name) {
            find.$text = {
                $search: query.name,
            };
        }

        if (query.username) {
            find.$text = {
                $search: find.$text ? (`${(find.$text as any).$search} ${query.username}`) : query.username,
            };
        }

        if (query.email) {
            find.email = query.email;
        }

        return (await details.find(find).toArray())
            .map((d) => dbToInternal(d, query.includeHash ?? false, query.includeEmail ?? false));
    }

    protected async updateImpl(update: UserMessage.UpdateUserMessage, details: Collection): Promise<string[]> {
        const filter: FilterQuery<InDatabaseUser> = {
            uid: update.id,
        };

        const changes: UpdateQuery<InDatabaseUser> = {
            $set: {
                ...(update.profile ? { profile: update.profile } : {}),
                ...(update.username ? { username: update.username } : {}),
                ...(update.hash ? { hash: update.hash } : {}),
                ...(update.email ? { email: update.email } : {}),
                ...(update.name ? { name: update.name } : {}),
            }
        }

        if (Object.keys(changes.$set ?? {}).length === 0) {
            throw new Error('no operations provided');
        }

        const result = await details.updateOne(filter, changes);

        if (result.matchedCount === 0) {
            throw new Error('invalid user ID');
        }

        if (result.result.ok !== 1) {
            throw new Error('failed to delete');
        }

        return [update.id];
    }

    public async assert(assert: UserMessage.AssertUserMessage): Promise<void> {
        if (!this._details) {
            throw new Error('database not initialised before assert');
        }

        const upsert: UpdateQuery<InternalUser> = {
            $set: {
                email: assert.email,
                name: assert.name,
                uid: assert.id,
                username: assert.username,
            },
            $setOnInsert: {
                hash: '',
            }
        }

        const options: UpdateOneOptions = {
            upsert: true,
        }

        await this._details.updateOne({
            uid: assert.id,
        }, upsert, options)
    }

}
