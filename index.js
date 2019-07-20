const net = require('net');
const ProtocolBuffer = require('./MCProtocolBuffer.js');

module.exports = (server, port, callback, timeout = 3000, protocol = -1) => {
  const handler = (resolve, reject) => {
    const socket = net.connect({ port: port, host: server }, () => {
      // Create and send a handshake
      socket.write(ProtocolBuffer.wrap(new ProtocolBuffer()
        // Packet ID
        .writeVarInt(0)
        // Minecraft Server Protocol
        .writeVarInt(protocol)
        // Server IP that was used to connect
        .writeString(server)
        // Port that was used to connect
        .writeUShort(port)
        // Next state request, 1 for status
        .writeVarInt(1)));
      // Send an empty request packet
      socket.write(ProtocolBuffer.wrap(new ProtocolBuffer().writeVarInt(0)));
    });

    let data = Buffer.allocUnsafe(0);
    socket.on('data', (chunk) => {
      data = Buffer.concat([data, chunk]);
      const response = new ProtocolBuffer(data);
      try {
        // Read the packet size
        const length = response.readVarInt();
        // Only continue if we've received the full packet
        if (data.length > length - response.buffer.length) {
          // We have the data we need so we can destroy the connection
          socket.destroy();
          try {
            // Skip the packet length and ID and parse the remaining data
            resolve(JSON.parse(response.readString(Math.ceil(length.toString(2).length / 8) + 1)));
          } catch (error) {
            // THe data is corrupt
            reject(error);
          }
        }
      } catch (error) { /* We don't have enough data yet */ }
    });

    socket.setTimeout(timeout, () => {
      socket.destroy();
      reject(new Error(`Socket timed out when connecting to [${server}:${port}]`));
    });

    socket.once('error', (error) => {
      socket.destroy();
      reject(error);
    });
  };

  if (typeof callback !== 'function') {
    protocol = timeout;
    timeout = callback;
    return new Promise(handler);
  } else {
    handler(
      data => {
        callback(null, data);
      },
      (error) => {
        callback(error);
      });
  }
};
