import fs from 'fs/promises';
import path from 'path';
import { _ml } from './logging/Log';
import { UserDatabase } from "./database/UserDatabase";
import bind from "./Binding";
import { ConfigurationSchema } from "./ConfigurationTypes";

import { RabbitNetworkHandler } from '@uems/micro-builder';
import { UserMessage as UM, UserMessageValidator, UserResponse as UR, UserResponseValidator } from '@uems/uemscommlib';
import CONSTANTS from "./constants/Constants";
import { LoggedError } from "./error/LoggedError";
import { MongoClient } from "mongodb";

const CONFIG_FILE_LOCATION = process.env.UEMS_HERA_CONFIG_LOCATION ?? path.join(__dirname, '..', '..', 'config', 'configuration.json');

const __ = _ml(__filename);

__.info('starting hera...');

async function launch() {
    let configData;

    try {
        configData = await fs.readFile(CONFIG_FILE_LOCATION, { encoding: 'utf8' });
        __.debug('loaded configuration file');
    } catch (e) {
        if (e.code === 'ENOENT') {
            __.error('failed to launch: ' + CONSTANTS.messages.NO_CONFIG_FILE);
            process.exitCode = CONSTANTS.codes.NO_CONFIG_FILE;
            throw new LoggedError();
        }

        throw e;
    }

    let configJSON;

    try {
        configJSON = JSON.parse(configData);
    } catch (e) {
        __.error('failed to launch: ' + CONSTANTS.messages.INVALID_CONFIG_FILE + ' (invalid JSON)', { e });
        process.exitCode = CONSTANTS.codes.INVALID_CONFIG_FILE;
        throw new LoggedError();
    }

    const parsed = ConfigurationSchema.safeParse(configJSON);
    if (!parsed.success) {
        __.error('failed to launch: ' + CONSTANTS.messages.INVALID_CONFIG_FILE + ' (invalid content)', {
            warnings: parsed.error,
        });
        process.exitCode = CONSTANTS.codes.INVALID_CONFIG_FILE;
        throw new LoggedError();
    }
    let config = parsed.data;

    let database!: UserDatabase;

    try {
        __.info('setting up database connection');
        await new Promise<void>(async (resolve, reject) => {
            if (process.env.UEMS_RAW_MONGO_URI) {
                __.info('using raw uri');
                const client = new MongoClient(process.env.UEMS_RAW_MONGO_URI, {
                    useUnifiedTopology: true,
                });
                await client.connect();
                database = new UserDatabase(client.db(), config.database.collections);
            } else {
                database = new UserDatabase(config.database);
            }

            const readyUnbind = database.once('ready', () => {
                readyUnbind();
                resolve();
            });

            const errorUnbind = database.once('error', (e) => {
                errorUnbind();
                reject(e);
            });
        });

        __.info('database connection enabled');
    } catch (e) {
        __.error('failed to launch: ' + CONSTANTS.messages.COULD_NOT_CONNECT_TO_DB, { e });
        process.exitCode = CONSTANTS.codes.COULD_NOT_CONNECT_TO_DB;
        throw new LoggedError();
    }

    let messenger: RabbitNetworkHandler<UM.UserMessage,
        UM.CreateUserMessage,
        UM.DeleteUserMessage,
        UM.ReadUserMessage,
        UM.UpdateUserMessage,
        UR.UserReadResponseMessage | UR.UserResponseMessage>;

    try {
        messenger = new RabbitNetworkHandler<UM.UserMessage,
            UM.CreateUserMessage,
            UM.DeleteUserMessage,
            UM.ReadUserMessage,
            UM.UpdateUserMessage,
            UR.UserReadResponseMessage | UR.UserResponseMessage>
        (
            config.message,
            (data) => new UserMessageValidator().validate(data),
            (data) => new UserResponseValidator().validate(data),
        );

        await new Promise<void>((resolve, reject) => {
            const unbindError = messenger.once('error', (err) => {
                unbindError();
                reject(err);
            });

            const unbindReady = messenger.once('ready', () => {
                unbindReady();
                resolve();
            });
        });

        __.info('message broker enabled');
    } catch (e) {
        __.error('failed to launch: ' + CONSTANTS.messages.COULD_NOT_CONNECT_TO_AMQPLIB, { e });
        process.exitCode = CONSTANTS.codes.COULD_NOT_CONNECT_TO_AMQPLIB;
        throw new LoggedError();
    }

    __.info('binding database to messenger');
    bind(database, messenger);

    __.info('hera up and running');
}

launch().catch((e) => {
    if (!(e instanceof LoggedError)) {
        __.error('failed to launch: an unknown error was encountered', { e });
    }
})
