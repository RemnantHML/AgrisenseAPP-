import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Screen, H1, H2, P, Card, Row, Tag, Btn, C, formatValue } from './ui';
import { useApp, GUEST_OWNER } from './store';
import {
  registerAccount,
  signInAccount,
  resetPassword,
  prepareGuestSession,
  friendlyAuthError,
  restoreAccountSession,
  signOutAccount,
  currentAccountEmail,
} from './firebase';
import { PARAMS, ICON, N_AREAS } from './data';
import { average, evaluateCrops, compatibleCrops, amendments, validate } from './analysis';
import { currentSeason } from './season';
import { scanDevices, connectDevice, readOnce } from './bluetooth';

export function Splash({ navigation }) {
  const { switchOwner } = useApp();

  useEffect(() => {
    let cancelled = false;
    let timer;
    const minimumSplash = new Promise(resolve => { timer = setTimeout(resolve, 1500); });

    const start = async () => {
      // Show the splash for at least 1.5 s while checking for a saved email session.
      const [session] = await Promise.all([restoreAccountSession(4000).catch(() => null), minimumSplash]);
      if (cancelled) return;
      if (session) {
        switchOwner(session.uid);
        navigation.replace('Main');
      } else {
        navigation.replace('Login');
      }
    };
    start();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
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

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export function Login({ navigation }) {
  const { switchOwner } = useApp();
  const [mode, setMode] = useState('signin'); // 'signin' | 'register' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { ok: true/false, text: '...' }

  const fail = text => setNotice({ ok: false, text });
  const changeMode = next => {
    setMode(next);
    setNotice(null);
    setPassword('');
    setConfirm('');
  };
  const enterApp = owner => {
    switchOwner(owner);
    navigation.replace('Main');
  };

  const submit = async () => {
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) return fail('Enter a valid email address.');
    if (mode !== 'reset' && !password) return fail('Enter your password.');
    if (mode === 'register') {
      if (password.length < 6) return fail('Use a password with at least 6 characters.');
      if (password !== confirm) return fail('The two passwords do not match.');
    }

    setBusy(true);
    setNotice(null);
    try {
      if (mode === 'reset') {
        await resetPassword(address);
        setBusy(false);
        setNotice({ ok: true, text: 'If an account exists for this email, a reset link has been sent. Check your inbox and spam folder.' });
        return;
      }
      const user = mode === 'register'
        ? await registerAccount(address, password)
        : await signInAccount(address, password);
      enterApp(user.uid);
    } catch (error) {
      setBusy(false);
      fail(friendlyAuthError(error));
    }
  };

  const continueAsGuest = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await prepareGuestSession();
      enterApp(GUEST_OWNER);
    } catch (error) {
      setBusy(false);
      fail(friendlyAuthError(error));
    }
  };

  const titles = {
    signin: ['Welcome back', 'Log in to continue'],
    register: ['Create account', 'Register with your email and a password'],
    reset: ['Reset password', 'Enter your email to receive a reset link'],
  };

  return (
    <Screen>
      <View style={{ paddingTop: 60 }}>
        <H1>{titles[mode][0]}</H1>
        <P>{titles[mode][1]}</P>
        <P style={{ marginTop: 16, fontWeight: '600', color: C.ink }}>Email</P>
        <TextInput
          style={[st.input, { marginTop: 4 }]}
          placeholder="Email"
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
        />
        {mode !== 'reset' && (
          <>
            <P style={{ marginTop: 12, fontWeight: '600', color: C.ink }}>Password</P>
            <TextInput
              style={[st.input, { marginTop: 4 }]}
              placeholder="Password"
              accessibilityLabel="Password"
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              editable={!busy}
            />
          </>
        )}
        {mode === 'register' && (
          <>
            <P style={{ marginTop: 12, fontWeight: '600', color: C.ink }}>Confirm password</P>
            <TextInput
              style={[st.input, { marginTop: 4 }]}
              placeholder="Confirm password"
              accessibilityLabel="Confirm password"
              secureTextEntry
              autoCapitalize="none"
              value={confirm}
              onChangeText={setConfirm}
              editable={!busy}
            />
          </>
        )}

        {notice && <P style={{ marginTop: 10, color: notice.ok ? C.ok : C.bad }}>{notice.text}</P>}
        {busy && <ActivityIndicator color={C.g} style={{ marginTop: 12 }} />}

        <Btn
          title={mode === 'signin' ? 'Log in' : mode === 'register' ? 'Register' : 'Send reset email'}
          onPress={submit}
          disabled={busy}
        />
        {mode === 'signin' && (
          <>
            <Btn title="Forgot password?" outline onPress={() => changeMode('reset')} disabled={busy} style={{ borderWidth: 0 }} />
            <Btn title="Create account" outline onPress={() => changeMode('register')} disabled={busy} />
          </>
        )}
        {mode !== 'signin' && (
          <Btn title="Back to log in" outline onPress={() => changeMode('signin')} disabled={busy} />
        )}
        <Btn title="Continue as guest" outline onPress={continueAsGuest} disabled={busy} style={{ borderWidth: 0 }} />
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
  const evaluation = evaluateCrops(avg);
  if (!evaluation) {
    return <Screen><P>The averaged readings could not be evaluated. Retake the readings and try again.</P></Screen>;
  }
  const compatible = evaluation.filter(result => result.compatible).map(result => result.crop);

  return (
    <Screen>
      <H2>Average results ({N_AREAS} areas)</H2>
      {PARAMS.map(parameter => (
        <Card key={parameter.k}>
          <Row>
            <Text>{parameter.label}</Text>
            <Text style={{ fontWeight: '700' }}>{formatValue(avg[parameter.k])} {parameter.unit}</Text>
          </Row>
        </Card>
      ))}
      <View style={[st.verdict, { backgroundColor: compatible.length ? C.okbg : C.badbg }]}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: compatible.length ? C.ok : C.bad }}>
          {compatible.length
            ? `${compatible.length} of ${evaluation.length} crops compatible`
            : 'No supported crop is compatible based on the six measured parameters.'}
        </Text>
        <P>
          {compatible.length
            ? compatible.join(', ')
            : 'Use View recommendations below to open the Crop Recommendation screen and see the flagged parameters and threshold details.'}
        </P>
      </View>
      <Btn title="View recommendations" onPress={() => navigation.navigate('Crops')} />
    </Screen>
  );
}

export function Crops({ navigation }) {
  const { areas, pref, setPref } = useApp();
  const avg = average(areas);
  if (!avg) return <Screen><P>Collect all {N_AREAS} areas first.</P></Screen>;
  const evaluation = evaluateCrops(avg);
  if (!evaluation) {
    return <Screen><P>The averaged readings could not be evaluated. Retake the readings and try again.</P></Screen>;
  }

  return (
    <Screen>
      <P>Current season: <Text style={{ fontWeight: '700' }}>{currentSeason()}</Text></P>
      <P style={{ marginTop: 6 }}>Tap a crop to set it as your preferred crop.</P>
      <View style={{ marginTop: 10 }}>
        {evaluation.map(({ crop, compatible, failedParameters }) => (
          <Card key={crop} onPress={() => setPref(crop)} style={crop === pref ? { borderColor: C.g, borderWidth: 2 } : null}>
            <Row>
              <Text style={{ fontSize: 17 }}>{ICON[crop]} <Text style={{ fontWeight: '700' }}>{crop}</Text></Text>
              <Tag text={compatible ? 'Compatible' : 'Incompatible'} kind={compatible ? 'ok' : 'bad'} />
            </Row>
            {failedParameters.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <P style={{ fontWeight: '700', color: C.ink }}>Flagged parameters</P>
                {failedParameters.map(parameter => (
                  <P key={parameter.key}>• {parameter.label} – {parameter.status}</P>
                ))}
              </View>
            )}
            {crop === pref && <P>Preferred crop</P>}
          </Card>
        ))}
      </View>
      <P style={{ textAlign: 'center', marginTop: 8 }}>Compatibility is based only on the six measured parameters.</P>
      <Btn title="View soil amendment suggestions" onPress={() => navigation.navigate('Amend')} />
    </Screen>
  );
}

export function Amend({ navigation }) {
  const { areas, pref, saveRecord } = useApp();
  const avg = average(areas);
  if (!avg) return <Screen><P>Collect all {N_AREAS} areas first.</P></Screen>;

  // The list shown on this screen. The SAME list is saved with the record, so a saved
  // record always holds exactly what the user saw (label, status and tip as displayed).
  const suggestions = amendments(avg, pref).map(suggestion => ({
    key: suggestion.k,
    label: PARAMS.find(parameter => parameter.k === suggestion.k)?.label || suggestion.k,
    status: suggestion.low ? 'Too low' : 'Too high',
    value: suggestion.value,
    range: [suggestion.range[0], suggestion.range[1]],
    tip: suggestion.tip,
  }));

  const save = () => {
    saveRecord(avg, compatibleCrops(avg), suggestions);
    navigation.popToTop();
    navigation.navigate('Main', { screen: 'Records' });
  };

  return (
    <Screen>
      <P>Current season: <Text style={{ fontWeight: '700' }}>{currentSeason()}</Text></P>
      <P style={{ marginTop: 6 }}>Preferred crop: <Text style={{ fontWeight: '700' }}>{ICON[pref]} {pref}</Text></P>
      <View style={{ marginTop: 10 }}>
        {suggestions.length ? suggestions.map(suggestion => (
          <Card key={suggestion.key}>
            <Row>
              <Text style={{ fontWeight: '700' }}>{suggestion.label}</Text>
              <Tag text={suggestion.status} kind="bad" />
            </Row>
            <P>Current {formatValue(suggestion.value)} · target {suggestion.range[0]}–{suggestion.range[1]}</P>
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

export function Records({ navigation }) {
  const { records } = useApp();
  return (
    <Screen>
      <H1>Monitoring records</H1>
      {records.length ? records.map(record => (
        <Card key={record.id} onPress={() => navigation.navigate('RecordDetail', { id: record.id })}>
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

const DetailRow = ({ label, value }) => (
  <Row style={{ marginTop: 8 }}>
    <Text style={{ flex: 1 }}>{label}</Text>
    <Text style={{ flex: 1, fontWeight: '700', textAlign: 'right' }}>{value}</Text>
  </Row>
);

export function RecordDetail({ route, navigation }) {
  const { records, owner, deleteRecord } = useApp();
  const record = records.find(item => item.id === route.params?.id);
  if (!record) {
    return <Screen><P>This record could not be found.</P></Screen>;
  }

  const savedDate = new Date(record.date);
  const dateText = Number.isNaN(savedDate.getTime()) ? 'Unknown' : savedDate.toLocaleString();
  const preferredText = record.pref ? `${ICON[record.pref] || ''} ${record.pref}`.trim() : 'Not recorded';
  const compatibleText = Array.isArray(record.compatible) && record.compatible.length
    ? record.compatible.join(', ')
    : 'None';

  // Which delete is allowed right now (this stage deletes from the phone only):
  //   'unsynced' = never uploaded, so only the phone copy exists
  //   'guest'    = uploaded in guest mode; its cloud copy cannot be removed from guest mode
  //   null       = uploaded under an email account; cloud deletion comes in a later stage, so no button
  const deleteKind = !record.synced ? 'unsynced' : owner === GUEST_OWNER ? 'guest' : null;

  const runDelete = () => {
    try {
      const deleted = deleteRecord(record.id, record.synced);
      if (deleted && navigation.isFocused()) navigation.goBack(); // back to the Records list
    } catch (error) {
      Alert.alert('Could not delete', error?.message || 'Something went wrong. Nothing was deleted.');
    }
  };

  const confirmDelete = () => {
    const details = `${record.name || 'Untitled session'}\nSaved: ${dateText}\n\n`;
    const warning = deleteKind === 'guest'
      ? 'This record was uploaded while using guest mode. Its cloud copy cannot be removed from guest mode and will remain in Firebase. Delete it from this phone only? This cannot be undone.'
      : 'This record has not been uploaded. It will be deleted from this phone. This cannot be undone.';
    Alert.alert('Delete this record?', details + warning, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: runDelete },
    ]);
  };

  return (
    <Screen>
      <H2>Assessment</H2>
      <Card>
        <DetailRow label="Assessment name" value={record.name || 'Untitled session'} />
        <DetailRow label="Location" value={record.location || 'Not provided'} />
        <DetailRow label="Date" value={dateText} />
        <DetailRow label="Preferred crop" value={preferredText} />
        <DetailRow label="Compatible crops" value={compatibleText} />
      </Card>

      <H2>Average soil readings</H2>
      <Card>
        {PARAMS.map(parameter => (
          <DetailRow
            key={parameter.k}
            label={parameter.label}
            value={`${formatValue(record.avg?.[parameter.k])} ${parameter.unit}`.trim()}
          />
        ))}
      </Card>

      <H2>Amendment recommendations</H2>
      {Array.isArray(record.amendments) ? (
        record.amendments.length ? (
          record.amendments.map((item, index) => (
            <Card key={item.key || index}>
              <Row>
                <Text style={{ fontWeight: '700', flex: 1 }}>{item.label || item.key}</Text>
                {item.status ? <Tag text={item.status} kind="bad" /> : null}
              </Row>
              <P>
                Measured {formatValue(item.value)}
                {Array.isArray(item.range) && item.range.length === 2 ? ` · target ${item.range[0]}–${item.range[1]}` : ''}
              </P>
              {item.tip ? <Text style={{ color: C.ink, marginTop: 4 }}>{item.tip}</Text> : null}
            </Card>
          ))
        ) : (
          <View style={[st.verdict, { backgroundColor: C.okbg }]}>
            <Text style={{ fontWeight: '700', color: C.ok }}>Your soil is compatible. No amendments needed.</Text>
          </View>
        )
      ) : (
        <Card>
          <P>Amendment recommendations were not saved with this record.</P>
        </Card>
      )}

      <H2>Synchronization</H2>
      <Card>
        <Row>
          <Text>Status</Text>
          <Tag text={record.synced ? 'Synced' : 'On this phone only'} kind={record.synced ? 'ok' : 'warn'} />
        </Row>
      </Card>

      {deleteKind ? (
        <Btn title="Delete record" outline danger onPress={confirmDelete} style={{ marginTop: 20 }} />
      ) : null}
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
          setMessage(
            count > 0
              ? `${count} record(s) uploaded to the cloud.`
              : 'Nothing to upload. All records are already synced.'
          );
        } catch (error) {
          setMessage(error?.message || 'Sync failed.');
        }
      }} />
      <P style={{ marginTop: 8 }}>Records are saved on this phone first. They are uploaded to the cloud only when you tap Sync now with an internet connection.</P>
    </Screen>
  );
}

export function Profile({ navigation }) {
  const { owner, records, switchOwner } = useApp();
  const isGuest = owner === GUEST_OWNER;
  const email = isGuest ? null : currentAccountEmail();
  const pending = records.filter(record => !record.synced).length;

  // Signs out of Firebase (accounts only), clears only in-memory state, then shows Login.
  // Records stored on the phone are never deleted.
  const leave = async () => {
    try {
      if (!isGuest) await signOutAccount();
      switchOwner(GUEST_OWNER);
      navigation.getParent()?.replace('Login');
    } catch {
      Alert.alert('Could not log out', 'Something went wrong while logging out. Please try again.');
    }
  };

  const logOut = () => {
    if (!pending) {
      leave();
      return;
    }
    const when = isGuest ? 'the next time you tap Sync now as a guest' : 'the next time you log in and tap Sync now';
    Alert.alert(
      'Log out?',
      `${pending} record(s) are not uploaded yet. They stay on this phone and upload ${when}. Log out anyway?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: leave },
      ]
    );
  };

  return (
    <Screen>
      <H1>Profile</H1>
      <Card>
        <P>{isGuest ? 'Using AgriSense as' : 'Signed in as'}</P>
        <Text style={{ fontWeight: '700' }}>{isGuest ? 'Guest' : email || 'Email account'}</Text>
        {isGuest && <P>Guest records stay on this phone until you tap Sync now. They are not linked to an email account.</P>}
      </Card>
      {['Account settings', 'Device management', 'Units: mg/kg, °C, %', 'About AgriSense'].map(title => (
        <Card key={title}><Text>{title}</Text></Card>
      ))}
      <Btn title="Log out" outline danger onPress={logOut} />
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
