const SerialPort = require('serialport')
const Delimiter = require('@serialport/parser-delimiter')
const event = require('events')

const emitter = new event.EventEmitter()
let port
let serialport_opened
let dataParser

function init(p, config){
    port = new SerialPort(p, config)
    serialport_opened = false
    dataParser = port.pipe(new Delimiter({delimiter:UX300.ETX}))
    initListeners()
}

function initListeners(){
    dataParser.on('data', function(data) {
        data = data.toString('utf-8').substring(1, data.toString('utf-8').length)
        
        let datas = data.split('|')
        parseTransaction(datas)
        port.flush()
        
    })

    port.on('error', function(data) {
        console.log('Error: ' + data)
    })
    
}

const UX300 = {
    STX:'\x02',
    BEL:'\x07',
    SEP:'\x7c',
    ETX:'\x03',
    FS:'\x1c',
    ACK:'\x06',
    //
    INTERMEDIATE_MESSAGES: '\u00020900',
    USE_CARD: '80',
    WRITE_PIN: '81',
    PROCESSING_PAYMENT: '82',

    PAYMENT_RESPONSE: '\u00020210',

    calcLRC: function(command) {
        command = command + UX300.ETX
        var buf = new ArrayBuffer(command.length);
        var bufView = new Uint8Array(buf);
        for ( var i = 0; i < command.length; i++ ) {
            bufView[i] = command.charCodeAt(i)
        }

        var lrc = 0
        for ( var i = 0; i < command.length; i++ ) {
            lrc = ( lrc ^ bufView[i] ) & 0xFF
        } 
        return String.fromCharCode(lrc)

    }, 
    
    polling() {
        const data = '0100'

        sendCommand(data)
    },

    pay(amount, ticketNumber) {
        const data = '0200|' + amount + '|' + ticketNumber + '|1|1'
        sendCommand(data)
    },

    closeTransactions() {
        const data = '0500|1'
        sendCommand(data)
    },

    lastTransaction() {
        const data = '0250|1'
        sendCommand(data)
    },

    cancelTransaction() {
        const data = '1200'
        sendCommand(data)
    },

    loadKeys() {
        const data = '0800'
        sendCommand(data)
    },

    initialize() {
        const data = '0070'
        sendCommand(data)
    },

    connect() {
        port.open(error => {
            if ( error ) {
                console.log('failed to open port: ' + error)
            } else {
                console.log('serial port opened')
                serialport_opened = true
                
            }
        })
    },

    bindOnOpen() {
        return new Promise((resolve, reject) => {
            port.on('open', resolve)
        })
    },

    close() {
        port.close(error => {
            if (error) {
                console.log('failed to close port: ' + error)
            } else {
                console.log('serial port closed!')
                serialport_opened = false
            }
        })
    }
}

function sendCommand(data) {
    if(serialport_opened) {
        const LRC = UX300.calcLRC(data)
        const command = UX300.STX + data + UX300.ETX + LRC
        port.write(command, function(err) {
            if(err)
                console.log("Error:", err)
            else {
                console.log("Command sended:", command)
            }
            port.write(UX300.ACK)
        })
    } else {
        console.log("Port closed")
    }
}

function parseTransaction(data) {
    switch(data[0]) {
        case UX300.INTERMEDIATE_MESSAGES:
            switch(data[1]) {
                case UX300.USE_CARD:
                    emitter.emit('intermediate_messages','use_card')
                    break;
                case UX300.WRITE_PIN:
                    emitter.emit('intermediate_messages', 'write_pin')
                    break;
                case UX300.PROCESSING_PAYMENT:
                    emitter.emit('intermediate_messages','processing_payment')
                    break;
            }
            break;
        case UX300.PAYMENT_RESPONSE:
            if(data[15] != undefined)
                emitter.emit('payment_voucher', data[15].match(/.{1,40}/g))
            break;

        default:
            console.log("Not recognized data:", data)
        break;
    }
}

module.exports = {
    init: init,
    connect: UX300.connect,
    onOpen: UX300.bindOnOpen,
    initialize: UX300.initialize,
    loadKeys: UX300.loadKeys,
    pay: UX300.pay,
    lastTransaction: UX300.lastTransaction,
    cancelTransaction: UX300.cancelTransaction,
    closeTransactions: UX300.closeTransactions,
    polling: UX300.polling,
    events: emitter
}