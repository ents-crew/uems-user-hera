import { constants } from "http2";
import { UserDatabase } from "./database/UserDatabase";
import { UserMessage, UserResponse } from "@uems/uemscommlib";
import { _ml } from "./logging/Log";
import { RabbitNetworkHandler } from "@uems/micro-builder";

const _b = _ml(__filename, 'binding');

async function execute(
    message: UserMessage.UserMessage,
    database: UserDatabase | undefined,
    send: (res: UserResponse.UserResponseMessage | UserResponse.UserReadResponseMessage) => void,
) {
    if (!database) {
        _b.warn('query was received without a valid database connection');
        throw new Error('uninitialised database connection');
    }

    let status: number = constants.HTTP_STATUS_INTERNAL_SERVER_ERROR;
    let result: string[] | UserResponse.InternalUser[] = [];

    try {
        switch (message.msg_intention) {
            case 'CREATE':
                result = await database.create(message);
                status = constants.HTTP_STATUS_OK;
                break;
            case 'DELETE':
                result = await database.delete(message);
                status = constants.HTTP_STATUS_OK;
                break;
            case 'READ':
                result = await database.query(message);
                status = constants.HTTP_STATUS_OK;
                break;
            case 'UPDATE':
                result = await database.update(message);
                status = constants.HTTP_STATUS_OK;
                break;
            default:
                status = constants.HTTP_STATUS_BAD_REQUEST;
        }
    } catch (e) {
        _b.error('failed to query database for events', {
            error: e as unknown,
        });
    }

    if (message.msg_intention === 'READ') {
        send({
            msg_intention: message.msg_intention,
            msg_id: message.msg_id,
            status,
            result: result as UserResponse.InternalUser[],
            userID: message.userID,
        });
    } else {
        send({
            msg_intention: message.msg_intention,
            msg_id: message.msg_id,
            status,
            result: result as string[],
            userID: message.userID,
        });
    }
}

export default function bind(database: UserDatabase, broker: RabbitNetworkHandler<any, any, any, any, any, any>): void {
    broker.on('query', (message, send) => execute(message, database, send));
    _b.debug('bound [query] event');

    broker.on('delete', (message, send) => execute(message, database, send));
    _b.debug('bound [delete] event');

    broker.on('update', (message, send) => execute(message, database, send));
    _b.debug('bound [update] event');

    broker.on('create', (message, send) => execute(message, database, send));
    _b.debug('bound [create] event');

    broker.on('any', (message, send) => {
        if (message.msg_intention === 'ASSERT'){
            return database.assert(message);
        }

        return Promise.resolve();
    })
}
