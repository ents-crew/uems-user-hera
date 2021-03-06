import { constants } from "http2";
import { UserDatabase } from "./database/UserDatabase";
import { MsgStatus, UserMessage, UserResponse } from "@uems/uemscommlib";
import { _ml } from "./logging/Log";
import { RabbitNetworkHandler, tryApplyTrait } from "@uems/micro-builder/build/src";
import { ClientFacingError } from "./error/ClientFacingError";

const _b = _ml(__filename, 'binding');

// @ts-ignore
const requestTracker: ('success' | 'fail')[] & { save: (d: 'success' | 'fail') => void } = [];
requestTracker.save = function save(d) {
    if (requestTracker.length >= 50) requestTracker.shift();
    requestTracker.push(d);
    tryApplyTrait('successful', requestTracker.filter((e) => e === 'success').length);
    tryApplyTrait('fail', requestTracker.filter((e) => e === 'fail').length);
};

async function execute(
    message: UserMessage.UserMessage,
    database: UserDatabase | undefined,
    send: (res: UserResponse.UserResponseMessage | UserResponse.UserReadResponseMessage) => void,
) {
    if (!database) {
        _b.warn('query was received without a valid database connection');

        requestTracker.save('fail');
        send({
            msg_intention: message.msg_intention,
            msg_id: message.msg_id,
            userID: message.userID,
            status: MsgStatus.FAIL,
            result: ['service is not ready'],
        });

        return;
    }

    let status: number = constants.HTTP_STATUS_INTERNAL_SERVER_ERROR;
    let result: string[] | UserResponse.InternalUser[] = [];

    try {
        switch (message.msg_intention) {
            case 'CREATE':
                result = await database.create(message);
                status = MsgStatus.SUCCESS;
                break;
            case 'DELETE':
                result = await database.delete(message);
                status = MsgStatus.SUCCESS;
                break;
            case 'READ':
                result = await database.query(message);
                status = MsgStatus.SUCCESS;
                break;
            case 'UPDATE':
                result = await database.update(message);
                status = MsgStatus.SUCCESS;
                break;
            default:
                status = MsgStatus.FAIL;
                result = ['invalid message intention'];
        }
    } catch (e) {
        _b.error('failed to query database for events', {
            error: e as unknown,
        });

        send({
            msg_intention: message.msg_intention,
            msg_id: message.msg_id,
            userID: message.userID,
            status: MsgStatus.FAIL,
            result: [e instanceof ClientFacingError ? e.message : 'failed to create user due to an internal service error'],
        });
        requestTracker.save('fail');
        return;
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
    requestTracker.save('success');
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
        // These messages are automatically handled by the handlers shown above
        if (['READ', 'DELETE', 'UPDATE', 'CREATE'].includes(message.msg_intention)) return undefined;

        if (message.msg_intention === 'ASSERT') {
            return database.assert(message);
        }

        requestTracker.save('fail');
        return send({
            msg_intention: message.msg_intention,
            msg_id: message.msg_id,
            userID: message.userID,
            status: MsgStatus.FAIL,
            result: ['invalid message intention'],
        });
    })
}
