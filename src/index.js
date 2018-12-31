const SerialPort = require('serialport');

const port = new SerialPort('/dev/ttyACM0', {
    baudRate: 115200,
    dataBits:8,
    stopBits:1,
}, onOpen)

const UX300 = {
    STX:'\x02',
    BEL:'\x07',
    SEP:'\x7c',
    ETX:'\x03',
    FS:'\x1c',
    ACK:'\x06',
    calcLRC: function(command) {
        
        var buf = new ArrayBuffer(command.length);
        var bufView = new Uint8Array(buf);
        for ( var i = 0; i < command.length; i++ ) {
            bufView[i] = command.charCodeAt(i);
        }

        var lrc = 0
        for ( var i = 0; i < command.length; i++ ) {
            lrc = ( lrc ^ bufView[i] ) & 0xFF;
        } 
        return String.fromCharCode(lrc);

    }, 
    doPay(amount, ticketNumber) {
        const data = '0200|' + amount + '|' + ticketNumber + '|1|1'
        const LRC = UX300.calcLRC(data + UX300.ETX)
        
        const command = UX300.STX + data + UX300.ETX + LRC
            
        if(serialport_opened) {
            
            port.write(command, function(err) {
                if(err)
                    console.log("Error:", err);
                else {
                    console.log("Enviado");
                }
            })

        }
    }
}

function onOpen(error) {
    if ( error ) {
        console.log('failed to open: ' + error);
    } else {
        console.log('serial port opened');
        serialport_opened = true;
        
    }
};

module.exports = {
    doPay: UX300.doPay
}
