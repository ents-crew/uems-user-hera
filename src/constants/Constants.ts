const CONSTANTS = {
    messages: {
        NO_CONFIG_FILE: 'config file could not be located at the specified path',
        INVALID_CONFIG_FILE: 'configuration file was invalid',
        COULD_NOT_CONNECT_TO_DB: 'could not connect to the specified database',
        COULD_NOT_CONNECT_TO_AMQPLIB: 'could not connect to the RabbitMQ/amqplib server provided'
    },
    codes: {
        NO_CONFIG_FILE: 2,
        INVALID_CONFIG_FILE: 3,
        COULD_NOT_CONNECT_TO_DB: 4,
        COULD_NOT_CONNECT_TO_AMQPLIB: 5,
    }
}

export default CONSTANTS;
