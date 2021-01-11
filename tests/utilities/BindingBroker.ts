import { UserMessage } from "@uems/uemscommlib";
import CreateUserMessage = UserMessage.CreateUserMessage;
import UpdateUserMessage = UserMessage.UpdateUserMessage;
import DeleteUserMessage = UserMessage.DeleteUserMessage;
import ReadUserMessage = UserMessage.ReadUserMessage;
import { RabbitNetworkHandler } from "@uems/micro-builder";

interface MockBrokerInterface {
    on(name: 'query', callback: (message: ReadUserMessage, send: (data: any) => void) => void): void;

    on(name: 'delete', callback: (message: DeleteUserMessage, send: (data: any) => void) => void): void;

    on(name: 'update', callback: (message: UpdateUserMessage, send: (data: any) => void) => void): void;

    on(name: 'create', callback: (message: CreateUserMessage, send: (data: any) => void) => void): void;

    on(name: 'any', callback: (message: UserMessage.UserMessage, send: (data: any) => void) => void): void;
}

export class BindingBroker implements MockBrokerInterface {

    private _listeners: {
        'query': ((message: ReadUserMessage, send: (data: any) => void) => void)[],
        'delete': ((message: DeleteUserMessage, send: (data: any) => void) => void)[],
        'update': ((message: UpdateUserMessage, send: (data: any) => void) => void)[],
        'create': ((message: CreateUserMessage, send: (data: any) => void) => void)[],
        'any': ((message: UserMessage.UserMessage, send: (data: any) => void) => void)[],
    } = {
        'query': [],
        'delete': [],
        'update': [],
        'create': [],
        'any': [],
    }

    on(name: "query", callback: (message: UserMessage.ReadUserMessage, send: (data: any) => void) => void): void;
    on(name: "delete", callback: (message: UserMessage.DeleteUserMessage, send: (data: any) => void) => void): void;
    on(name: "update", callback: (message: UserMessage.UpdateUserMessage, send: (data: any) => void) => void): void;
    on(name: "create", callback: (message: UserMessage.CreateUserMessage, send: (data: any) => void) => void): void;
    on(name: "any", callback: (message: UserMessage.UserMessage, send: (data: any) => void) => void): void;
    on(name: "query" | "delete" | "update" | "create" | "any", callback: ((message: UserMessage.ReadUserMessage, send: (data: any) => void) => void) | ((message: UserMessage.DeleteUserMessage, send: (data: any) => void) => void) | ((message: UserMessage.UpdateUserMessage, send: (data: any) => void) => void) | ((message: UserMessage.CreateUserMessage, send: (data: any) => void) => void) | ((message: UserMessage.UserMessage, send: (data: any) => void) => void)): void {
        // @ts-ignore
        this._listeners[name].push(callback);
    }

    emit(name: "query", message: UserMessage.ReadUserMessage, send: (data: any) => void): void;
    emit(name: "delete", message: UserMessage.DeleteUserMessage, send: (data: any) => void): void;
    emit(name: "update", message: UserMessage.UpdateUserMessage, send: (data: any) => void): void;
    emit(name: "create", message: UserMessage.CreateUserMessage, send: (data: any) => void): void;
    emit(name: "any", message: UserMessage.UserMessage, send: (data: any) => void): void;
    emit(name: "query" | 'delete' | 'update' | 'create' | 'any', message: UserMessage.ReadUserMessage | UserMessage.DeleteUserMessage | UserMessage.UpdateUserMessage | UserMessage.CreateUserMessage | UserMessage.UserMessage, send: (data: any) => void) {
        // @ts-ignore
        this._listeners[name].forEach((e) => e(message, send));
        if (name !== 'any') {
            this._listeners.any.forEach((e) => e(message, send));
        }
    }

    clear(){
        this._listeners.query = [];
        this._listeners.delete = [];
        this._listeners.update = [];
        this._listeners.create = [];
        this._listeners.any = [];
    }

}

export const makeBindingBroker = () => new BindingBroker() as unknown as RabbitNetworkHandler<any, any, any, any, any, any>;
