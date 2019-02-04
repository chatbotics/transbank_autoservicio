const SerialPort = require('serialport')
const event = require('events')

const emitter = new event.EventEmitter()
let port
let serialport_opened

let isPulling = false;
let isIniting = false;
let isInitingResult = false;


function init(p, config) {
    port = new SerialPort(p, config)
    /* serialport_opened = false */
    initListeners()
}

function initListeners() {
    let resultVoucher = Buffer.alloc(0)
    port.on('data', function (data) {

        if (data[0] == 6) {
            if (isPulling) {
                isPulling = false;
                parseTransaction([UX300.POLLING_REQUEST, ''])
            }

            if (isIniting) {
                isIniting = false;
                parseTransaction([UX300.INITIALIZATION_REQUEST, ''])
            }

            if (isInitingResult) {
                isInitingResult = false;
                parseTransaction([UX300.INITIALIZATION_RESPONSE_REQUEST, ''])
            }

            console.log("ES UN ACK!")
        }
        else if (data[0] == 2 && data[data.length - 2] == 3) {
            let result = data.slice(1, data.length - 2).toString('utf-8')
            parseTransaction(result.split('|'))
        }
        else {
            resultVoucher = Buffer.concat([resultVoucher, data])

            for (let e of data) {
                if (e == 3) {
                    parseTransaction(resultVoucher.slice(1).toString('utf-8').split('|'))
                    resultVoucher = Buffer.alloc(0)
                    break;
                }
            }
        }
    })

    port.on('error', function (data) {
        // console.log('Error: ' + data)
    })

}

const UX300 = {
    STX: '\x02',
    BEL: '\x07',
    SEP: '\x7c',
    ETX: '\x03',
    FS: '\x1c',
    ACK: '\x06',
    NAK: '\x15',

    PAYMENT_REQUEST: '0200',
    PAYMENT_RESPONSE: '0210',

    LAST_PAYMENT_REQUEST: '0250',
    LAST_PAYMENT_RESPONSE: '0260',

    CANCEL_TRANSACTION_REQUEST: '1200',
    CANCEL_TRANSACTION_RESPONSE: '1210',

    CLOSE_TRANSACTIONS_REQUEST: '0500',
    CLOSE_TRANSACTIONS_RESPONSE: '0510',

    LOAD_KEYS_REQUEST: '0800',
    LOAD_KEYS_RESPONSE: '0810',

    POLLING_REQUEST: '0100',

    INITIALIZATION_REQUEST: '0070',

    INITIALIZATION_RESPONSE_REQUEST: '0080',
    INITIALIZATION_RESPONSE_RESPONSE: '1080',

    ENCRYPTED_PAN_REQUEST: '0400',
    ENCRYPTED_PAN_RESPONSE: '0410',

    INTERMEDIATE_MESSAGES: '0900',
    USE_CARD: '80',
    WRITE_PIN: '81',
    PROCESSING_PAYMENT: '82',

    REJECTED: '01',
    APPROVED: '00',
    TRANSBANK_NO_RESPONSE: '02',
    CONNECTION_FAIL: '03',
    TRANSACTION_WAS_CANCELLED: '04',
    TRANSACTION_DOESNT_EXISTS: '05',
    UNSUPPORTED_CARD: '06',
    CANCELLED_TRANSACTION: '07',
    CANT_CANCEL_TRANSACTION: '08',
    CARD_READ_ERROR: '09',
    LOW_AMOUNT_ERROR: '10',
    PAYMENT_DOESNT_EXISTS: '11',
    UNSUPPORTED_TRANSACTION: '12',
    MUST_EXECUTE_CLOSE: '13',
    CRYPT_ERROR_PAN: '14',
    DEBIT_OPERATION_ERROR: '15',

    INITIALIZATION_SUCCESS: '90',
    INITIALIZATION_FAIL: '91',
    READER_DISCONNECTED: '92',

    POS_DISABLED: 'pos_disabled',

    calcLRC: function (command) {
        command = command + UX300.ETX
        var buf = new ArrayBuffer(command.length)
        var bufView = new Uint8Array(buf)
        for (var i = 0; i < command.length; i++) {
            bufView[i] = command.charCodeAt(i)
        }

        var lrc = 0
        for (var i = 0; i < command.length; i++) {
            lrc = (lrc ^ bufView[i]) & 0xFF
        }
        return String.fromCharCode(lrc)

    },

    polling() {
        isPulling = true;
        sendCommand(UX300.POLLING_REQUEST)
    },
    polling_2() {
        console.log('polling_2 interno')
        return new Promise(async (resolve, reject) => {
            const data = UX300.POLLING_REQUEST
            const LRC = UX300.calcLRC(data)
            const command = UX300.STX + data + UX300.ETX + LRC

            let writePromise = new Promise((_resolve, _reject) => {
                port.write(command, (err) => {
                    err ? reject() : _resolve()
                })
            })

            await writePromise
            console.log('polling_2 interno promise')
            const cb = (data) => {
                if (data[0] == 6) {
                    console.log('Polling 2 recibido');
                    console.log(data);
                    port.removeListener('data', cb)
                    resolve();
                }
            }
            port.on('data', cb)
        })
    },
    pay(amount, ticketNumber) {
        const data = UX300.PAYMENT_REQUEST + '|' + amount + '|' + ticketNumber + '|1|1'
        sendCommand(data)
    },
    closeTransactions() {
        const data = UX300.CLOSE_TRANSACTIONS_REQUEST + '|1'
        sendCommand(data)
    },

    lastTransaction() {
        const data = UX300.LAST_PAYMENT_REQUEST + '|1'
        sendCommand(data)
    },

    cancelTransaction() {
        sendCommand(UX300.CANCEL_TRANSACTION_REQUEST)
    },

    loadKeys() {
        sendCommand(UX300.LOAD_KEYS_REQUEST)
    },

    initialize() {
        isIniting = true;
        sendCommand(UX300.INITIALIZATION_REQUEST)
    },
    result_initialize() {
        isInitingResult = true;
        sendCommand(UX300.INITIALIZATION_RESPONSE_REQUEST)
    },
    initialize_2() {
        return new Promise(async (resolve, reject) => {
            const data = UX300.INITIALIZATION_REQUEST
            const LRC = UX300.calcLRC(data)
            const command = UX300.STX + data + UX300.ETX + LRC

            let writePromise = new Promise((_resolve, _reject) => {
                port.write(command, (err) => {
                    err ? reject() : _resolve()
                })
            })

            await writePromise

            const cb2 = (data) => {
                if (data[0] == 6) {
                    port.removeListener('data', cb2)
                    console.log('remove listener')
                    resolve();
                }
            }
            port.on('data', cb2)
        })
    },
    connect() {
        port.open(error => {
            if (error) {
                // console.log('failed to open port: ' + error)
                emitter.emit('error', UX300.POS_DISABLED)
            } else {
                console.log('serial port opened')
                /* serialport_opened = true */
            }
        })
    },

    onOpen() {
        return new Promise((resolve, reject) => {
            port.on('open', resolve)
        })
    },

    flush() {
        port.flush(error => {
            if (error) {
                console.log('failed to flush port: ' + error)
            } else {
                console.log('serial port flushed!')
            }
        })
    },

    close() {
        port.close(error => {
            if (error) {
                console.log('failed to close port: ' + error)
            } else {
                console.log('serial port closed!')
                /* serialport_opened = false */
            }
        })
    }
}

function sendCommand(data) {
    console.log('enviando commando')
    /* console.log(serialport_opened, port.isOpen) */
    if (port.isOpen) {
        const LRC = UX300.calcLRC(data)
        const command = UX300.STX + data + UX300.ETX + LRC
        port.write(command, function (err) {
            if (err)
                console.log("Error:", err)
            else {
                console.log("Command sended:", command)
            }
        })
    } else {
        UX300.connect()
        console.log("Port closed")
    }
}

function parseTransaction(data) {
    let typeMessage = data[0]
    let responseCode = data[1]
    switch (typeMessage) {
        case UX300.INTERMEDIATE_MESSAGES:
            emitter.emit(UX300.INTERMEDIATE_MESSAGES, data[1])
            break

        case UX300.PAYMENT_RESPONSE:
            switch (responseCode) {
                case UX300.APPROVED:
                    if (data[15] != undefined) {
                        transbankInfo = {
                            responseCode: data[1],
                            commerceCode: data[2],
                            terminalId: data[3],
                            ticketNumber: data[4],
                            autorizationCode: data[5],
                            amount: data[6],
                            lastCardNumber: data[7],
                            cardType: data[8]
                        }

                        if (transbankInfo.cardType == 'DB') {
                            transbankInfo.accountingDate = data[9]
                            transbankInfo.accountNumber = data[10]
                        } else if (transbankInfo.cardType == 'CR') {
                            transbankInfo.cardAbbreviation = data[11]
                        }
                        transbankInfo.transactionDate = data[13]
                        transbankInfo.transactionHour = data[14]
                        console.log(data)
                        emitter.emit('payment_voucher', { voucher: data[15].match(/.{1,40}/g), transbankInfo })
                        port.write(UX300.ACK)
                    }
                    else {
                        emitter.emit('error', data[1])
                        port.write(UX300.ACK)
                    }
                    break;
                default:
                    emitter.emit('error', responseCode)
                    port.write(UX300.ACK)
                    break;
            }
            break;

        case UX300.CLOSE_TRANSACTIONS_RESPONSE:
            if (responseCode == UX300.APPROVED) {
                emitter.emit('transactions_close', data[4].match(/.{1,40}/g))
                port.write(UX300.ACK)
            }
            break
        case UX300.LOAD_KEYS_RESPONSE:
            console.log('Llaves cargadas', typeMessage)
            port.write(UX300.ACK)
            break
        case UX300.POLLING_REQUEST:
            emitter.emit('polling_response')
            port.write(UX300.ACK)
            break
        case UX300.LAST_PAYMENT_RESPONSE:
            emitter.emit('last_payment_response', responseCode, data[15].match(/.{1,40}/g))
            port.write(UX300.ACK)
            break
        case UX300.CANCEL_TRANSACTION_RESPONSE:
            emitter.emit('canceled_transaction', responseCode)
            port.write(UX300.ACK)
            break
        case UX300.INITIALIZATION_REQUEST:
            emitter.emit('initialization_request')
            break
        case UX300.INITIALIZATION_RESPONSE_REQUEST:
            emitter.emit('initialization_response_request')
            break
        case UX300.INITIALIZATION_RESPONSE_RESPONSE:
            emitter.emit('initialization_response_response', data)
            break
        default:
            console.log('default', typeMessage)
    }
}

module.exports = {
    init: init,
    events: emitter,
    ...UX300
}