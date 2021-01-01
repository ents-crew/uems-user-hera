import fs from 'fs/promises';
import path from 'path';
import * as z from 'zod';
import { _ml } from './logging/Log';
import { UserDatabase } from "./database/UserDatabase";
import bind from "./Binding";
import { UserValidators } from "@uems/uemscommlib/build/user/UserValidators";
import UserMessageValidator = UserValidators.UserMessageValidator;
import UserResponseValidator = UserValidators.UserResponseValidator;
import { ConfigurationSchema } from "./ConfigurationTypes";
import { RabbitNetworkHandler as GenericRabbitNetworkHandler } from "@uems/micro-builder/build/messaging/GenericRabbitNetworkHandler";
import { UserMessage as UM, UserResponse as UR } from "@uems/uemscommlib/build/user";

const __ = _ml(__filename);
const _b = _ml(`${__filename} | bind`);

__.info('starting hera...');

let messager: GenericRabbitNetworkHandler<any, any, any, any, any, any> | undefined;
let database: UserDatabase | undefined;
let configuration: z.infer<typeof ConfigurationSchema> | undefined;

fs.readFile(path.join(__dirname, '..', 'config', 'configuration.json'), { encoding: 'utf8' })
    .then((file) => {
        __.debug('loaded configuration file');

        configuration = ConfigurationSchema.parse(JSON.parse(file));
    })
    .then(() => (new Promise<UserDatabase>((resolve, reject) => {
        if (!configuration) {
            __.error('reached an uninitialised configuration, this should not be possible');
            reject(new Error('uninitialised configuration'));
            return;
        }

        __.info('setting up database connection');

        database = new UserDatabase(configuration.database);

        const unbind = database.once('error', (err) => {
            __.error('failed to setup the database connection', {
                error: err,
            });

            reject(err);
        });

        database.once('ready', () => {
            __.info('database connection enabled');
            // Make sure we dont later try and reject a resolved promise from an unrelated error
            unbind();

            if (database) resolve(database);
            else reject(new Error('database is invalid'));
        });
    })))
    .then(() => (new Promise<void>((resolve, reject) => {
        if (!configuration) {
            __.error('reached an uninitialised configuration, this should not be possible');
            reject(new Error('uninitialised configuration'));
            return;
        }

        __.info('setting up the message broker');

        messager = new GenericRabbitNetworkHandler<UM.UserMessage,
            UM.CreateUserMessage,
            UM.DeleteUserMessage,
            UM.ReadUserMessage,
            UM.UpdateUserMessage,
            UR.UserReadResponseMessage | UR.UserResponseMessage>
        (
            configuration.message,
            (data) => new UserMessageValidator().validate(data),
            (data) => new UserResponseValidator().validate(data),
        );

        const unbind = messager.once('error', (err) => {
            __.error('failed to setup the message broker', {
                error: err,
            });

            reject(err);
        });

        messager.once('ready', () => {
            __.info('message broker enabled');
            // Make sure we dont later try and reject a resolved promise from an unrelated error
            unbind();
            resolve();
        });
    })))
    .then(() => {
        if (!messager || !database) {
            __.error('reached an uninitialised database or messenger, this should not be possible');
            throw new Error('uninitialised database or messenger');
        }

        __.info('binding database to messenger');

        bind(database, messager);

        // We're ready to start!
        __.info('hera up and running');
    })
    .catch((err) => {
        __.error('failed to launch', {
            error: err as unknown,
        });
    });
