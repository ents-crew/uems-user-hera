import { UserMessage, UserResponse } from "@uems/uemscommlib";
import { Collection, ObjectId } from "mongodb";
import ReadUserMessage = UserMessage.ReadUserMessage;
import CreateUserMessage = UserMessage.CreateUserMessage;
import DeleteUserMessage = UserMessage.DeleteUserMessage;
import UpdateUserMessage = UserMessage.UpdateUserMessage;
import InternalUser = UserResponse.InternalUser;
import { GenericMongoDatabase } from "@uems/micro-builder";

export class UserDatabase extends GenericMongoDatabase<ReadUserMessage, CreateUserMessage, DeleteUserMessage, UpdateUserMessage, InternalUser> {

    protected async createImpl(create: UserMessage.CreateUserMessage, details: Collection): Promise<string[]> {
        const { msg_id, msg_intention, status, ...document } = create;

        // @ts-ignore - TODO: do this properly later
        document.uid = document.id;
        // @ts-ignore
        delete document.id;

        const result = await details.insertOne(document);

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

        const query = {
            uid: id,
        };

        const result = await details
            .deleteOne(query);

        if (result.result.ok !== 1 || result.deletedCount !== 1) {
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

        const result: InternalUser[] = await details.find(find).toArray();

        for (const r of result) {
            // @ts-ignore
            r.id = r.uid;

            // @ts-ignore
            delete r._id;
            // @ts-ignore
            delete r.uid;

            if (!query.includeEmail) r.email = undefined;
            if (!query.includeHash) r.hash = undefined;
        }

        return result;
    }

    protected updateImpl(update: UserMessage.UpdateUserMessage): Promise<string[]> {
        return super.defaultUpdate(update)
    }

}
