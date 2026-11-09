import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Screen, H1, H2, P, Card, Row, Tag, Btn, C } from './ui';
import { useApp } from './store';
import { PARAMS, TH, ICON, N_AREAS } from './data';
import { average, failed, compatibleCrops, amendments, validate } from './analysis';
import { scanDevices, connectDevice, readOnce } from './bluetooth';

export function Splash({ navigation }) {
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('Login'), 1500);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={[st.center, { backgroundColor: '#fff' }]}>
      <View style={st.logo}>
        <Text style={{ fontSize: 46 }}>🌱</Text>
      </View>
      <H1>AgriSense</H1>
      <P>Smart soil monitoring. Better crop decisions.</P>
      <ActivityIndicator color={C.g} style={{ marginTop: 28 }} />
    </View>
  );
}

export function Login({ navigation }) {
  const go = () => navigation.replace('Main');
  return (
    <Screen>
      <View style={{ paddingTop: 60 }}>
        <H1>Welcome back</H1>
        <P>Log in to continue</P>
        <TextInput
          style={st.input}
          placeholder="Email or phone number"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput style={st.input} placeholder="Password" secureTextEntry />
        <Btn title="Log in" onPress={go} />
        <Btn title="Register" outline onPress={go} />
        <Btn title="Continue as guest" outline onPress={go} style={{ borderWidth: 0 }} />
      </View>
    </Screen>
  );
}

export function Home({ navigation }) {
  const { device, records } = useApp();
  const QuickAction = ({ icon, label, to }) => (
    <Card style={st.q} onPress={() => navigation.navigate(to)}>
      <Text style={{ fontSize: 26 }}>{icon}</Text>
      <P>{label}</P>
    </Card>
  );

  return (
    <Screen>
      <H1>Hello, Farmer!</H1>
      <Card>
        <P>Device status</P>
        <Row>
          <Text style={{ fontWeight: '700' }}>{device?.name || 'AgriSense device'}</Text>
          <Tag text={device ? 'Connected' : 'Not connected'} kind={device ? 'ok' : 'bad'} />
        </Row>
      </Card>
      <H2>Quick actions</H2>
      <View style={st.grid}>
        <QuickAction icon="⏱️" label="New monitoring" to="Monitor" />
        <QuickAction icon="📋" label="View records" to="Records" />
        <QuickAction icon="💡" label="Recommendations" to="Monitor" />
        <QuickAction icon="🔄" label="Sync data" to="Sync" />
      </View>
      <Btn title="Connect device" outline onPress={() => navigation.navigate('Connect')} />
      <P style={{ marginTop: 12, textAlign: 'center' }}>{records.length} saved record(s)</P>
    </Screen>
  );
}

export function Connect({ navigation }) {
  const { setDevice } = useApp();
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [connectingId, setConnectingId] = useState(null);

  const scan = async () => {
    setBusy(true);
    setList([]);
    try {
      const devices = await scanDevices();
      setList(devices);
      if (devices.length === 0) {
        Alert.alert(
          'No paired AgriSense device found',
          'Pair your ESP32 in Android Settings → Bluetooth first. The app lists paired AgriSense devices.'
        );
      }
    } catch (error) {
      Alert.alert('Bluetooth scan failed', error?.message || 'Turn on Bluetooth and allow Bluetooth/Nearby devices permission.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    scan();
    // Initial scan only; the user can tap Scan again to refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = async device => {
    setConnectingId(device.id);
    try {
      await connectDevice(device);
      setDevice(device);
      Alert.alert('Connected', `Successfully connected to ${device.name}.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Connection failed', error?.message || 'Make sure the ESP32 is paired and try again.');
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginVertical: 18 }}>
        <View style={[st.logo, { backgroundColor: C.g2 }]}>
          <Text style={{ fontSize: 40 }}>📡</Text>
        </View>
        <P>{busy ? 'Checking paired Bluetooth devices…' : `${list.length} AgriSense device(s) found`}</P>
      </View>
      <H2>Available devices</H2>
      {list.map(device => (
        <Card key={device.id}>
          <Row>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{device.name}</Text>
              <P>{device.address || device.id}</P>
            </View>
            <Btn
              title={connectingId === device.id ? 'Connecting…' : 'Connect'}
              disabled={busy || connectingId !== null}
              onPress={() => pick(device)}
              style={{ marginTop: 0, paddingVertical: 8 }}
            />
          </Row>
        </Card>
      ))}
      <Btn title={busy ? 'Checking…' : 'Scan again'} outline onPress={scan} disabled={busy || connectingId !== null} />
      <P style={{ marginTop: 8 }}>
        Note: Pair “AgriSense-ESP32” from your Android Bluetooth settings before scanning here.
      </P>
    </Screen>
  );
}

export function Monitor({ navigation }) {
  const { device, areas, session, setSession } = useApp();
  const done = areas.every(Boolean);

  const start = () => {
    if (!device) {
      Alert.alert('No device', 'Connect to an AgriSense device first.');
      navigation.navigate('Connect');
      return;
    }
    if (done) {
      navigation.navigate('Average');
      return;
    }
    navigation.navigate('Area', { index: areas.findIndex(area => !area) });
  };

  return (
    <Screen>
      <H1>New monitoring</H1>
      <P>Session name</P>
      <TextInput
        style={st.input}
        value={session.name}
        placeholder="e.g. North field - Oct 2026"
        onChangeText={name => setSession({ ...session, name })}
      />
      <P style={{ marginTop: 10 }}>Location (optional)</P>
      <TextInput
        style={st.input}
        value={session.location}
        placeholder="Barangay, municipality"
        onChangeText={location => setSession({ ...session, location })}
      />
      <H2>Sampling areas</H2>
      {areas.map((area, index) => (
        <Card key={index}>
          <Row>
            <Text>Area {index + 1}</Text>
            <Tag text={area ? 'Collected ✓' : 'Pending'} kind={area ? 'ok' : 'warn'} />
          </Row>
        </Card>
      ))}
      <P>Collect {N_AREAS} points per hectare in a zigzag (W) pattern. Insert the probe fully at the same depth each time.</P>
      <Btn title={done ? 'Analyze soil' : 'Start monitoring'} onPress={start} />
    </Screen>
  );
}

export function Area({ route, navigation }) {
  const { index } = route.params;
  const { areas, setAreas } = useApp();
  const [reading, setReading] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: `Area ${index + 1} readings` });
  }, [index, navigation]);

  const read = async () => {
    setBusy(true);
    try {
      const values = await readOnce();
      if (!validate(values)) {
        Alert.alert('Invalid reading', 'The ESP32 returned values outside the expected ranges. Check the probe and sensor response, then try again.');
        return;
      }
      setReading(values);
    } catch (error) {
      Alert.alert('Could not read sensor', error?.message || 'Check the Bluetooth connection, ESP32 power, RS485 wiring, and sensor response.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!reading) return;
    const nextAreas = [...areas];
    nextAreas[index] = reading;
    setAreas(nextAreas);
    navigation.goBack();
  };

  return (
    <Screen>
      <H2>Reading from device</H2>
      {reading ? (
        PARAMS.map(parameter => (
          <Card key={parameter.k}>
            <Row>
              <Text>{parameter.label}</Text>
              <Text style={{ fontWeight: '700' }}>{reading[parameter.k]} {parameter.unit}</Text>
            </Row>
          </Card>
        ))
      ) : (
        <P>{busy ? 'Requesting a live reading from the ESP32…' : 'No reading yet. Insert the probe fully into the soil, then tap Read from device.'}</P>
      )}
      <Btn title={busy ? 'Reading…' : 'Read from device'} outline onPress={read} disabled={busy} />
      <Row style={{ gap: 10 }}>
        <Btn title="Retake" outline onPress={() => setReading(null)} style={{ flex: 1 }} disabled={!reading || busy} />
        <Btn title="Save" onPress={save} style={{ flex: 1 }} disabled={!reading || busy} />
      </Row>
    </Screen>
  );
}

export function Average({ navigation }) {
  const { areas } = useApp();
  const avg = average(areas);
  if (!avg) {
    return <Screen><P>Collect all {N_AREAS} areas first.</P></Screen>;
  }
  const compatible = compatibleCrops(avg);

  return (
    <Screen>
      <H2>Average results ({N_AREAS} areas)</H2>
      {PARAMS.map(parameter => (
        <Card key={parameter.k}>
          <Row>
            <Text>{parameter.label}</Text>
            <Text style={{ fontWeight: '700' }}>{avg[parameter.k]} {parameter.unit}</Text>
          </Row>
        </Card>
      ))}
      <View style={[st.verdict, { backgroundColor: compatible.length ? C.okbg : C.badbg }]}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: compatible.length ? C.ok : C.bad }}>
          {compatible.length ? `${compatible.length} of 5 crops compatible` : 'No crop fully compatible'}
        </Text>
        <P>{compatible.length ? compatible.join(', ') : 'See amendment suggestions to improve your soil.'}</P>
      </View>
      <Btn title="View recommendations" onPress={() => navigation.navigate('Crops')} />
    </Screen>
  );
}

export function Crops({ navigation }) {
  const { areas, pref, setPref } = useApp();
  const avg = average(areas);
  if (!avg) return <Screen><P>Collect all {N_AREAS} areas first.</P></Screen>;

  return (
    <Screen>
      <P>Tap a crop to set it as your preferred crop.</P>
      <View style={{ marginTop: 10 }}>
        {Object.keys(TH).map(crop => {
          const failures = failed(avg, crop);
          return (
            <Card key={crop} onPress={() => setPref(crop)} style={crop === pref ? { borderColor: C.g, borderWidth: 2 } : null}>
              <Row>
                <Text style={{ fontSize: 17 }}>{ICON[crop]} <Text style={{ fontWeight: '700' }}>{crop}</Text></Text>
                <Tag text={failures.length ? `Incompatible · ${failures.length} off` : 'Compatible'} kind={failures.length ? 'bad' : 'ok'} />
              </Row>
              {crop === pref && <P>Preferred crop</P>}
            </Card>
          );
        })}
      </View>
      <Btn title="View soil amendment suggestions" onPress={() => navigation.navigate('Amend')} />
    </Screen>
  );
}

export function Amend({ navigation }) {
  const { areas, pref, saveRecord } = useApp();
  const avg = average(areas);
  if (!avg) return <Screen><P>Collect all {N_AREAS} areas first.</P></Screen>;
  const suggestions = amendments(avg, pref);

  const save = () => {
    saveRecord(avg, compatibleCrops(avg));
    navigation.popToTop();
    navigation.navigate('Main', { screen: 'Records' });
  };

  return (
    <Screen>
      <P>Preferred crop: <Text style={{ fontWeight: '700' }}>{ICON[pref]} {pref}</Text></P>
      <View style={{ marginTop: 10 }}>
        {suggestions.length ? suggestions.map(suggestion => (
          <Card key={suggestion.k}>
            <Row>
              <Text style={{ fontWeight: '700' }}>{PARAMS.find(parameter => parameter.k === suggestion.k)?.label || suggestion.k}</Text>
              <Tag text={suggestion.low ? 'Too low' : 'Too high'} kind="bad" />
            </Row>
            <P>Current {suggestion.value} · target {suggestion.range[0]}–{suggestion.range[1]}</P>
            <Text style={{ color: C.ink, marginTop: 4 }}>{suggestion.tip}</Text>
          </Card>
        )) : (
          <View style={[st.verdict, { backgroundColor: C.okbg }]}>
            <Text style={{ fontWeight: '700', color: C.ok }}>Your soil is compatible. No amendments needed.</Text>
          </View>
        )}
      </View>
      <P style={{ textAlign: 'center', marginTop: 8 }}>Guidance only. Not a replacement for advice from the Department of Agriculture or certified specialists.</P>
      <Btn title="Save assessment" onPress={save} />
    </Screen>
  );
}

export function Records() {
  const { records } = useApp();
  return (
    <Screen>
      <H1>Monitoring records</H1>
      {records.length ? records.map(record => (
        <Card key={record.id}>
          <Row>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{record.name}</Text>
              <P>{new Date(record.date).toLocaleString()} · {record.synced ? 'synced' : 'on this phone'}</P>
              {record.location ? <P>{record.location}</P> : null}
            </View>
            <Tag text={`${record.compatible.length} compatible`} kind={record.compatible.length ? 'ok' : 'bad'} />
          </Row>
        </Card>
      )) : <P>No records yet. Complete a monitoring session and tap Save assessment.</P>}
    </Screen>
  );
}

export function Sync() {
  const { sync, lastSync, records } = useApp();
  const [message, setMessage] = useState('');
  const pending = records.filter(record => !record.synced).length;

  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingTop: 30 }}>
        <View style={[st.logo, { backgroundColor: C.g2 }]}><Text style={{ fontSize: 40 }}>☁️</Text></View>
        <P>Last sync</P>
        <Text style={{ fontWeight: '700' }}>{lastSync ? new Date(lastSync).toLocaleString() : 'Never'}</Text>
        <P style={{ marginTop: 10 }}>{message || (pending ? `${pending} record(s) waiting to sync.` : 'All data are up to date.')}</P>
      </View>
      <Btn title="Sync now" onPress={async () => {
        try {
          const count = await sync();
          setMessage(`${count} record(s) synced locally.`);
        } catch (error) {
          setMessage(error?.message || 'Sync failed.');
        }
      }} />
      <P style={{ marginTop: 8 }}>This version stores records on this phone. Cloud sync is not connected to a server yet.</P>
    </Screen>
  );
}

export function Profile({ navigation }) {
  return (
    <Screen>
      <H1>Profile</H1>
      <Card><Text style={{ fontWeight: '700' }}>Juan Dela Cruz</Text><P>Farmer</P></Card>
      {['Account settings', 'Device management', 'Units: mg/kg, °C, %', 'About AgriSense'].map(title => (
        <Card key={title}><Text>{title}</Text></Card>
      ))}
      <Btn title="Log out" outline danger onPress={() => navigation.getParent()?.replace('Login')} />
    </Screen>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 92, height: 92, borderRadius: 46, backgroundColor: C.g2, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, fontSize: 14, marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  q: { width: '48.5%', alignItems: 'center', paddingVertical: 18 },
  verdict: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
});
