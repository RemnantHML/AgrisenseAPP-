import { PermissionsAndroid, Platform } from 'react-native';

// Real ESP32 Bluetooth Classic SPP connection. The ESP32 must be paired in
// Android Settings first because this app lists bonded devices.
export const USE_MOCK = false;

const RESPONSE_TIMEOUT_MS = 10000;
const POLL_INTERVAL_MS = 250;
const DEVICE_PREFIX = 'AgriSense';

let bluetoothClassic = null;
let connection = null;
let connectedDevice = null;
let receiveBuffer = '';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function getBluetoothClassic() {
  if (!bluetoothClassic) {
    // This is a native module and requires an Android development build;
    // it will not work in Expo Go.
    const module = require('react-native-bluetooth-classic');
    bluetoothClassic = module.default ?? module;
  }
  return bluetoothClassic;
}

async function ensureBluetoothPermissions() {
  if (Platform.OS !== 'android') {
    throw new Error(
      'This Bluetooth Classic connection is configured for Android. iOS does not support this ESP32 SPP workflow.'
    );
  }

  if (Number(Platform.Version) >= 31) {
    const permission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
    const result = await PermissionsAndroid.request(permission, {
      title: 'Allow AgriSense Bluetooth access',
      message: 'AgriSense needs Bluetooth access to connect to your ESP32 soil-monitoring device.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });

    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error(
        'Bluetooth permission was denied. Allow Nearby devices/Bluetooth access in Android settings.'
      );
    }
  }
}

async function ensureBluetoothEnabled() {
  await ensureBluetoothPermissions();
  const bluetooth = getBluetoothClassic();
  const enabled = await bluetooth.isBluetoothEnabled();
  if (!enabled) {
    await bluetooth.requestBluetoothEnabled();
  }
  return bluetooth;
}

function normalizeDevice(device) {
  return {
    id: device.address ?? device.id,
    name: device.name || 'Unknown Bluetooth device',
    address: device.address ?? device.id,
    bonded: true,
  };
}

export async function scanDevices() {
  if (USE_MOCK) {
    return [];
  }

  const bluetooth = await ensureBluetoothEnabled();
  const bondedDevices = await bluetooth.getBondedDevices();
  return bondedDevices
    .filter(device => (device.name || '').startsWith(DEVICE_PREFIX))
    .map(normalizeDevice);
}

export async function connectDevice(device) {
  if (!device?.id) {
    throw new Error('The selected Bluetooth device has no address.');
  }

  const bluetooth = await ensureBluetoothEnabled();

  if (connection?.isConnected?.()) {
    try {
      await connection.disconnect();
    } catch (_) {
      // Continue and attempt the new connection.
    }
  }

  connection = null;
  connectedDevice = null;
  receiveBuffer = '';

  try {
    connection = await bluetooth.connectToDevice(device.id, {
      DELIMITER: '\n',
      DEVICE_CHARSET: 'utf-8',
    });
  } catch (error) {
    connection = null;
    throw new Error(
      `Could not connect to ${device.name || 'the ESP32'}. Make sure it is paired in Android Bluetooth settings and not connected to another app. ${error?.message || ''}`.trim()
    );
  }

  if (!connection) {
    throw new Error('Bluetooth did not return a connection to the ESP32.');
  }

  connectedDevice = normalizeDevice(device);

  // Verify the serial link with the firmware's PING/PONG command.
  try {
    await connection.write('PING\n');
    const response = await readLine(3500);
    if (response && response.trim() !== 'PONG') {
      // Some firmware versions may not answer PING. Keep the live link if
      // there is still an established connection, but surface explicit errors.
      if (response.startsWith('ERROR,')) {
        throw new Error(response);
      }
    }
  } catch (error) {
    if (!connection) throw error;
    // The device may use firmware without PING support. Actual READ checks
    // are still performed when a measurement is requested.
  }

  return true;
}

async function readLine(timeoutMs = RESPONSE_TIMEOUT_MS) {
  if (!connection) {
    throw new Error('No ESP32 connection. Connect the device first.');
  }

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (typeof connection.isConnected === 'function' && !connection.isConnected()) {
      connection = null;
      connectedDevice = null;
      throw new Error('The Bluetooth connection to the ESP32 was lost.');
    }

    let chunk = '';
    try {
      chunk = await connection.read();
    } catch (error) {
      throw new Error(`Could not read Bluetooth data: ${error?.message || error}`);
    }

    if (chunk) {
      receiveBuffer += String(chunk);
      const newlineIndex = receiveBuffer.indexOf('\n');
      if (newlineIndex >= 0) {
        const line = receiveBuffer.slice(0, newlineIndex).replace(/\r/g, '').trim();
        receiveBuffer = receiveBuffer.slice(newlineIndex + 1);
        if (line) return line;
      } else {
        // With DELIMITER configured, this library can return a complete line
        // without including the delimiter. Accept that format too.
        const candidate = receiveBuffer.replace(/\r/g, '').trim();
        if (candidate === 'PONG' || candidate.startsWith('ERROR,') || candidate.split(',').length === 6) {
          receiveBuffer = '';
          return candidate;
        }
      }
    } else {
      await wait(POLL_INTERVAL_MS);
    }
  }

  return null;
}

function parseSensorLine(line) {
  if (!line) {
    throw new Error('The ESP32 did not return a reading before the timeout.');
  }

  if (line.startsWith('ERROR,')) {
    const detail = line.slice('ERROR,'.length).replaceAll('_', ' ');
    throw new Error(`ESP32 sensor error: ${detail}`);
  }

  const fields = line.split(',').map(value => value.trim());
  if (fields.length !== 6 || fields.some(value => value === '')) {
    throw new Error(`Invalid ESP32 response: "${line}". Expected N,P,K,pH,M,T.`);
  }

  const [N, P, K, pH, M, T] = fields.map(Number);
  const values = { N, P, K, pH, M, T };
  if (Object.values(values).some(value => !Number.isFinite(value))) {
    throw new Error(`The ESP32 returned non-numeric sensor values: "${line}".`);
  }

  return values;
}

export async function readOnce() {
  if (USE_MOCK) {
    throw new Error('Mock readings are disabled. Connect to the real AgriSense ESP32.');
  }

  if (!connection || (typeof connection.isConnected === 'function' && !connection.isConnected())) {
    connection = null;
    connectedDevice = null;
    throw new Error('No active Bluetooth connection. Return to Connect device and reconnect.');
  }

  receiveBuffer = '';
  try {
    await connection.write('READ\n');
    const line = await readLine(RESPONSE_TIMEOUT_MS);
    return parseSensorLine(line);
  } catch (error) {
    throw new Error(error?.message || 'Unable to retrieve a sensor reading from the ESP32.');
  }
}

export async function disconnectDevice() {
  const oldConnection = connection;
  connection = null;
  connectedDevice = null;
  receiveBuffer = '';
  if (oldConnection) {
    try {
      await oldConnection.disconnect();
    } catch (_) {
      // The connection may already be closed.
    }
  }
}

export function getConnectedDevice() {
  return connectedDevice;
}
