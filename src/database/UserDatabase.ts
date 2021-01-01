import { UserMessage, UserResponse } from "@uems/uemscommlib";
import { UserValidators } from "@uems/uemscommlib/build/user/UserValidators";
import { Collection, ObjectId } from "mongodb";
import ReadUserMessage = UserMessage.ReadUserMessage;
import CreateUserMessage = UserMessage.CreateUserMessage;
import DeleteUserMessage = UserMessage.DeleteUserMessage;
import UpdateUserMessage = UserMessage.UpdateUserMessage;
import UserRepresentation = UserValidators.UserRepresentation;
import InternalUser = UserResponse.InternalUser;
import { GenericMongoDatabase } from "@uems/micro-builder";

export class UserDatabase extends GenericMongoDatabase<ReadUserMessage, CreateUserMessage, DeleteUserMessage, UpdateUserMessage, UserRepresentation> {

    protected async createImpl(create: UserMessage.CreateUserMessage, details: Collection): Promise<string[]> {
        const { msg_id, msg_intention, status, ...document } = create;

        const result = await details.insertOne(document);

        if (result.insertedCount !== 1 || result.insertedId === undefined) {
            throw new Error('failed to insert')
        }

        const id = (result.insertedId as ObjectId).toHexString();
        await super.log(id, 'inserted');

        return [id];
    }

    protected deleteImpl(remove: UserMessage.DeleteUserMessage): Promise<string[]> {
        return super.defaultDelete(remove);
    }

    protected async queryImpl(query: UserMessage.ReadUserMessage, details: Collection): Promise<UserValidators.UserRepresentation[]> {
        const find: Record<string, unknown> = {};

        if (query.id) {
            if (!ObjectId.isValid(query.id)) throw new Error('invalid query id');
            find._id = new ObjectId(query.id);
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
            r.id = r._id.toString();

            // @ts-ignore
            delete r._id;

            if (!query.includeEmail) r.email = undefined;
            if (!query.includeHash) r.hash = undefined;
        }

        return result;
    }

    protected updateImpl(update: UserMessage.UpdateUserMessage): Promise<string[]> {
        return super.defaultUpdate(update)
    }

}
