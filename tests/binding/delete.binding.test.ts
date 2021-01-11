import winston from "winston";

winston.add(new winston.transports.Console());

import MongoUnit from 'mongo-unit';
import { UserDatabase } from "../../src/database/UserDatabase";
import { Db, MongoClient, ObjectId } from 'mongodb';
import { BindingBroker } from "../utilities/BindingBroker";
import bind from "../../src/Binding";
import { MsgStatus, UserMessage } from "@uems/uemscommlib";
import DeleteUserMessage = UserMessage.DeleteUserMessage;

jest.setTimeout(20000);

describe('executing delete messages delete the proper entities', () => {

    let client: MongoClient;
    let db: Db;
    let database: UserDatabase;
    let broker: BindingBroker;

    beforeAll(async () => {
        // Setup the in memory mongo db database
        await MongoUnit.start();

        // Create the database connection and connect to the one we just created in memory
        client = new MongoClient(MongoUnit.getUrl(), {
            useUnifiedTopology: true,
        });
        await client.connect();

        // Then create a user database around this
        db = client.db('testing');
        database = new UserDatabase(db, {
            details: 'details',
            changelog: 'changelog',
        });

        broker = new BindingBroker();
    });

    afterAll(async () => {
        // Shutdown our connection to the database
        await client.close();

        // Then stop the in memory database
        await MongoUnit.stop();
    });

    // Before we begin each test we'll reset the database to make sure that we start on a clean slate
    beforeEach(async () => {
        await db.collection('details').insertMany([
            {
                _id: new ObjectId("56d9bf92f9be48771d6fe5b1"),
                email: "one@b.com",
                hash: "",
                name: "name",
                uid: "uid1",
                username: "user one",
            }, {
                _id: new ObjectId("56d9bf92f9be48771d6fe5b2"),
                email: "two@b.com",
                hash: "",
                name: "name",
                uid: "uid2",
                username: "user two",
            }, {
                _id: new ObjectId("56d9bf92f9be48771d6fe5b3"),
                email: "three@b.com",
                hash: "",
                name: "name",
                uid: "uid3",
                username: "user three",
            }
        ]);
        // @ts-ignore - this is based on the actual code so may need reviewing on change
        bind(database, broker);
    });

    afterEach(async () => {
        await db.collection('details').deleteMany({});
        broker.clear();
    })

    it('basic delete should succeed', (done) => {
        broker.emit('delete', {
            msg_intention: "DELETE",
            userID: 'anonymous',
            status: 0,
            msg_id: 0,
            id: 'uid1'
        }, (message) => {
            expect(message).toHaveProperty('result');
            expect(message).toHaveProperty('status');

            expect(message.status).toEqual(MsgStatus.SUCCESS);
            expect(message.result).toHaveLength(1);
            expect(message.result[0]).toEqual('uid1');

            done();
        });
    });

    it('deleting with the ObjectID should not work', (done) => {
            // @ts-ignore
        broker.emit('delete', {
            msg_intention: "DELETE",
            userID: 'anonymous',
            status: 0,
            msg_id: 0,
            id: new ObjectId('56d9bf92f9be48771d6fe5b2')
        } as DeleteUserMessage, (message) => {
            expect(message).toHaveProperty('result');
            expect(message).toHaveProperty('status');

            expect(message.status).toEqual(MsgStatus.FAIL);
            expect(message.result).toHaveLength(1);
            expect(message.result[0]).toEqual('invalid ID type');

            broker.emit('delete', {
                msg_intention: "DELETE",
                userID: 'anonymous',
                status: 0,
                msg_id: 0,
                id: '56d9bf92f9be48771d6fe5b2'
            }, (message) => {
                expect(message).toHaveProperty('result');
                expect(message).toHaveProperty('status');

                expect(message.status).toEqual(MsgStatus.FAIL);
                expect(message.result).toHaveLength(1);
                expect(message.result[0]).toEqual('invalid user ID');

                done();
            });
        });

    })

    it('deleting with additional properties acts normally', (done) => {
        // @ts-ignore
        broker.emit('delete', {
            msg_intention: "DELETE",
            userID: 'anonymous',
            status: 0,
            msg_id: 0,
            id: 'uid3',
            // @ts-ignore
            somethingElse: 'a',
        }, (message) => {
            expect(message).toHaveProperty('result');
            expect(message).toHaveProperty('status');

            expect(message.status).toEqual(MsgStatus.SUCCESS);
            expect(message.result).toHaveLength(1);
            expect(message.result[0]).toEqual('uid3');

            done();
        });
    });
});
