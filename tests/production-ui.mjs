import { chromium } from 'playwright';

const baseURL = process.env.APP_URL || 'https://office.creativeprocess.io';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';
const suffix = Date.now().toString().slice(-8);
const auditUsername = `ui_audit_${suffix}`;
const auditPassword = 'Audit12345!';
const auditRoom = `UI Audit Theater ${suffix}`;
const auditPersonalRoom = `Audit Private Office ${suffix}`;
const auditFloor = `UI Audit Floor ${suffix}`;
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function step(name, action) {
  const started = Date.now();
  await action();
  results.push({ name, milliseconds: Date.now() - started });
  process.stdout.write(`PASS ${name}\n`);
}

async function login(page, username, password) {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('your.username').fill(username);
  await page.getByPlaceholder('Your password').fill(password);
  await page.getByRole('button', { name: 'Enter office' }).click();
  await page.getByText('Creativeprocess Office', { exact: true }).waitFor();
  return exitPersonalOffice(page);
}

async function exitPersonalOffice(page) {
  const welcome = page.getByText('Permission remains your choice').locator('xpath=ancestor::section').getByRole('button', { name: 'Enter my office' });
  const showedWelcome = Boolean(await welcome.count());
  if (showedWelcome) await welcome.click();
  const leaveOffice = page.getByRole('button', { name: 'Leave office' });
  await leaveOffice.waitFor({ timeout: 10000 });
  await page.locator('#btn-toggle-camera[title="Turn Camera On"]').waitFor({ timeout: 5000 });
  await page.locator('#btn-toggle-mic[title="Mute Microphone"]').waitFor({ timeout: 5000 });
  await leaveOffice.click();
  await leaveOffice.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: /Online/ }).waitFor({ timeout: 5000 });
  return showedWelcome;
}

const browserArgs = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  '--auto-select-desktop-capture-source=Entire screen',
];
if (process.env.FAKE_AUDIO_FILE) browserArgs.push(`--use-file-for-fake-audio-capture=${process.env.FAKE_AUDIO_FILE}`);

const browser = await chromium.launch({
  headless: true,
  args: browserArgs,
});

const context = await browser.newContext();
await context.grantPermissions(['camera', 'microphone', 'clipboard-read', 'clipboard-write'], { origin: baseURL });
const page = await context.newPage();
const runtimeErrors = [];
page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('favicon')) runtimeErrors.push(`console: ${message.text()}`);
});

let createdUserId;
let createdRoomId;
let createdGameRoomId;
let createdFloorId;
let createdPersonalRoomId;
let mediaMeetingRoomId;
let sharedMeetingRoomId;
let createdConversationId;

try {
  await step('HTTPS login and password visibility', async () => {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    assert(await page.title() === 'Creativeprocess Office', `Unexpected browser title: ${await page.title()}`);
    assert(await page.locator('link[rel="icon"][href="/creativeprocess-mark.svg"]').count() === 1, 'Creativeprocess favicon is missing');
    assert(await page.locator('[class*="FF5F56"], [class*="FFBD2E"], [class*="27C93F"]').count() === 0, 'macOS window dots remain on the login screen');
    const password = page.getByPlaceholder('Your password');
    assert(await password.getAttribute('type') === 'password', 'Password is not initially masked');
    await password.locator('xpath=..').getByRole('button').click();
    assert(await password.getAttribute('type') === 'text', 'Password visibility button failed');
    await page.getByPlaceholder('your.username').fill('admin');
    await password.fill(adminPassword);
    await page.getByRole('button', { name: 'Enter office' }).click();
    await page.getByText('Creativeprocess Office', { exact: true }).waitFor();
    assert(page.url().startsWith('https://'), 'App is not using HTTPS');
    await exitPersonalOffice(page);
  });

  await step('Top bar sound and presence status controls', async () => {
    await page.getByTitle('Toggle sounds').click();
    await page.getByRole('button', { name: /Online/ }).click();
    await page.getByRole('button', { name: 'Away', exact: true }).click();
    await page.getByRole('button', { name: /Away/ }).click();
    await page.getByRole('button', { name: 'Online', exact: true }).click();
  });

  await step('Main floor and right-side floor navigator', async () => {
    const floorNavigator = page.getByRole('complementary', { name: 'Office floors' });
    await floorNavigator.waitFor();
    const mainFloor = floorNavigator.getByRole('button', { name: 'Open Main Floor' });
    await mainFloor.waitFor();
    assert(await mainFloor.getAttribute('aria-current') === 'page', 'The user did not open on their assigned main floor');
    assert(await floorNavigator.locator('button').count() >= 1, 'Floor mini-map cards are missing');
  });

  await step('Ambiance and global reaction controls', async () => {
    await page.locator('#btn-toggle-bg-strip').click();
    await page.getByTitle('Minimal Dark Zinc').click();
    await page.locator('#btn-emoji-picker-toggle').click();
    await page.getByTitle('Send 🔥').click();
  });

  await step('Admin-only PostgreSQL explorer controls', async () => {
    await page.locator('#btn-bottom-schema').click();
    for (const label of ['users', 'teams', 'rooms', 'presence_status']) {
      await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    }
    await page.getByRole('button', { name: 'SQL DDL Script' }).click();
    await page.getByRole('button', { name: 'Copy SQL' }).click();
    await page.getByRole('button', { name: /Copied DDL|Copy failed/ }).waitFor();
    await page.locator('.fixed.inset-0').getByRole('button').first().click();
  });

  await step('Profile cancel and save controls', async () => {
    await page.getByRole('button', { name: 'Open account menu' }).click();
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Open account menu' }).click();
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await page.getByPlaceholder('e.g. Reviewing UI Figma specs').fill('Production UI audit');
    await page.getByRole('button', { name: 'Save Presence' }).click();
    await page.getByText('Edit Profile & Presence Badges').waitFor({ state: 'detached' });
  });

  await step('Owner analytics and account creation', async () => {
    await page.getByRole('button', { name: 'Open account menu' }).click();
    await page.getByRole('button', { name: 'Owner dashboard' }).click();
    await page.getByText('Room utilization').waitFor();
    const analytics = await page.evaluate(() => fetch('/api/admin/analytics?days=30').then(async (response) => ({ status: response.status, body: await response.json() })));
    assert(analytics.status === 200, `Owner analytics returned HTTP ${analytics.status}`);
    assert(analytics.body.range?.days === 30, 'Analytics date filter was not applied');
    for (const key of ['members', 'daily', 'rooms', 'sessions', 'events']) assert(Array.isArray(analytics.body[key]), `Analytics ${key} collection is missing`);
    assert(analytics.body.summary && typeof analytics.body.summary.tracked_seconds === 'number', 'Analytics time summary is missing');
    await page.getByRole('button', { name: 'Floors', exact: true }).click();
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByLabel('Floor name').fill(auditFloor);
    await page.getByLabel('Floor color').fill('#5B8DEF');
    await page.getByLabel('Description').fill('Temporary production floor validation');
    await page.getByRole('button', { name: 'Create floor' }).click();
    await page.getByText('Floor created.').waitFor();
    const floorList = await page.evaluate(() => fetch('/api/floors').then((response) => response.json()));
    createdFloorId = floorList.find((floor) => floor.name === auditFloor)?.id;
    assert(createdFloorId, 'Created floor was not returned by the API');
    await page.getByRole('button', { name: new RegExp(`^Floor \\d+\\s+${auditFloor}`) }).click();
    await page.getByRole('button', { name: 'Move up' }).click();
    await page.getByText('Floor order updated.').waitFor();
    await page.getByRole('button', { name: 'Move down' }).click();
    await page.getByText('Floor order updated.').waitFor();
    await page.getByRole('button', { name: 'Accounts & access' }).click();
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByLabel('Display name').fill('UI Audit User');
    await page.getByLabel('Username').fill(auditUsername);
    await page.getByLabel('Role / title').fill('QA Auditor');
    await page.getByLabel('Temporary password').fill(auditPassword);
    await page.getByLabel('Main floor', { exact: true }).selectOption(createdFloorId);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByText('Account created.').waitFor();
    const users = await page.evaluate(() => fetch('/api/users').then((response) => response.json()));
    const createdUser = users.find((user) => user.username === auditUsername);
    createdUserId = createdUser?.id;
    createdPersonalRoomId = createdUser?.personalRoomId;
    assert(createdUserId, 'Created account was not returned by the API');
    assert(createdPersonalRoomId, 'Created account did not receive a personal office');
    assert(createdUser.defaultFloorId === createdFloorId, 'Created account did not receive its selected main floor');
  });

  await step('Account edit, access toggles, and save', async () => {
    await page.getByRole('button', { name: new RegExp(`UI Audit User.*@${auditUsername}`) }).click();
    const enabled = page.getByRole('button', { name: /Account enabled/ });
    await enabled.click();
    await enabled.click();
    const administrator = page.getByRole('button', { name: /Administrator/ });
    await administrator.click();
    await administrator.click();
    await page.getByLabel('Role / title').fill('Production Auditor');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByText('Account updated.').waitFor();
  });

  await step('Room create, edit, and room-management tabs', async () => {
    await page.getByRole('button', { name: 'Rooms', exact: true }).click();
    await page.getByRole('button', { name: new RegExp("UI Audit User's Office") }).click();
    assert(await page.getByLabel('Room type').isDisabled(), 'Personal office type can be changed');
    assert(await page.getByRole('button', { name: 'Delete room' }).count() === 0, 'Personal office exposes a delete button');
    await page.getByLabel('Room name').fill(auditPersonalRoom);
    await page.getByRole('button', { name: 'Save room' }).click();
    await page.getByText('Room updated.').waitFor();
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByLabel('Room name').fill(auditRoom);
    await page.getByLabel('Room type').selectOption('theater');
    await page.getByLabel('Room floor').selectOption(createdFloorId);
    await page.getByLabel('Capacity').fill('6');
    await page.getByLabel('Description').fill('Temporary production validation room');
    const createRoomResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/rooms') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create room' }).click();
    const createdRoomResponse = await createRoomResponse;
    assert(createdRoomResponse.status() === 201, `Room creation returned HTTP ${createdRoomResponse.status()}`);
    const rooms = await page.evaluate(() => fetch('/api/rooms').then((response) => response.json()));
    createdRoomId = rooms.find((room) => room.name === auditRoom)?.id;
    mediaMeetingRoomId = rooms.find((room) => room.ownerUserId && room.ownerUserId !== createdUserId)?.id;
    sharedMeetingRoomId = rooms.find((room) => room.type === 'meeting' && !room.isPersonal)?.id;
    assert(createdRoomId, 'Created room was not returned by the API');
    const gameResponse = await page.evaluate(({ name, floorId }) => fetch('/api/admin/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type: 'game', capacity: 6, floorId, description: 'Temporary production game-room validation' }) }).then((response) => response.json()), { name: `UI Audit Game ${suffix}`, floorId: createdFloorId });
    createdGameRoomId = gameResponse.room?.id;
    assert(createdGameRoomId, 'Temporary game room was not created');
    await page.getByRole('button', { name: new RegExp(auditRoom) }).click();
    await page.getByRole('heading', { name: 'Edit room' }).waitFor();
    await page.getByLabel('Capacity').fill('7');
    const updateResponse = page.waitForResponse((response) => response.url().includes(`/api/admin/rooms/${createdRoomId}`) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Save room' }).click();
    const roomResponse = await updateResponse;
    assert(roomResponse.ok(), `Room update returned HTTP ${roomResponse.status()} for ${roomResponse.request().postData()}: ${await roomResponse.text()}`);
    await page.getByRole('button', { name: 'Overview' }).click();
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
    await page.getByTitle('Close owner console').click();
    await page.getByText('Administration').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: `Open ${auditFloor}` }).click();
    await page.locator(`#btn-join-room-${createdRoomId}`).waitFor();
    await page.getByRole('button', { name: 'Open Main Floor' }).click();
    assert(await page.locator(`#btn-join-room-${createdRoomId}`).count() === 0, 'A room from another floor remained on the active floor canvas');
  });

  await step('Personal office background camera and microphone controls', async () => {
    assert(mediaMeetingRoomId, 'No personal office exists for the media regression');
    await page.locator(`#btn-join-room-${mediaMeetingRoomId}`).click();
    await page.getByRole('button', { name: 'Leave office' }).waitFor();
    await page.locator('section[aria-label="Office floor"]').waitFor();
    await page.locator('section[aria-label="Office floor"]').getByRole('heading', { name: 'Main Floor' }).waitFor();
    assert(await page.locator('[id^="room-card-"]').count() >= 4, 'The complete floor disappeared after entering a personal office');
    assert(await page.getByText('Office Live').count() === 0, 'A participant-only personal-office view replaced the floor');
    await page.locator('#btn-toggle-screenshare').waitFor();
    await page.locator('#btn-toggle-screenshare').click();
    await page.locator('[data-personal-presentation="true"]').waitFor({ timeout: 10000 });
    assert(await page.getByRole('button', { name: 'Leave office' }).count() === 1, 'Opening a presentation removed the explicit office leave control');
    await page.getByRole('button', { name: 'Stop sharing' }).click();
    await page.locator('[data-personal-presentation="true"]').waitFor({ state: 'detached' });
    await page.locator('#btn-toggle-camera[title="Turn Camera On"]').waitFor();
    if (process.env.FAKE_AUDIO_FILE) await page.locator('[data-speaking="true"]').last().waitFor({ timeout: 5000 });
    await page.locator('#btn-toggle-camera').click();
    await page.locator('#btn-toggle-camera[title="Turn Camera Off"]').waitFor();
    await page.locator('#btn-toggle-camera').click();
    await page.locator('#btn-toggle-camera[title="Turn Camera On"]').waitFor();
    await page.locator('#btn-toggle-mic').click();
    await page.locator('#btn-toggle-mic[title="Unmute Microphone"]').waitFor();
    if (process.env.FAKE_AUDIO_FILE) await page.locator('[data-speaking="true"]').last().waitFor({ state: 'detached', timeout: 5000 });
    await page.locator('#btn-toggle-mic').click();
    await page.locator('#btn-toggle-mic[title="Mute Microphone"]').waitFor();
    if (process.env.FAKE_AUDIO_FILE) await page.locator('[data-speaking="true"]').last().waitFor({ timeout: 5000 });
    const presenceAfterControls = await page.evaluate(() => Promise.all([fetch('/api/auth/session').then((response) => response.json()), fetch('/api/presences').then((response) => response.json())]).then(([session, presences]) => presences[session.user.id]));
    assert(presenceAfterControls.currentRoomId === mediaMeetingRoomId, 'A personal-office media control unexpectedly removed the user from the room');
    await page.getByRole('button', { name: 'Leave office' }).click();
    await page.locator(`#btn-join-room-${mediaMeetingRoomId}`).waitFor();
  });

  await step('Meeting reaction, hand, layout, screen presentation, and leave', async () => {
    assert(sharedMeetingRoomId, 'No shared meeting room exists for the meeting regression');
    await page.locator(`#btn-join-room-${sharedMeetingRoomId}`).click();
    await page.getByRole('heading', { name: 'Choose how you enter' }).waitFor();
    await page.getByTitle('Turn camera on before joining').click();
    await page.getByTitle('Turn camera off before joining').waitFor();
    await page.getByTitle('Turn camera off before joining').click();
    await page.getByTitle('Turn microphone off before joining').click();
    await page.getByTitle('Turn microphone on before joining').click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert(await page.getByTitle('Switch room layout').count() === 0, 'Meeting opened before media consent');
    await page.locator(`#btn-join-room-${sharedMeetingRoomId}`).click();
    await page.getByRole('button', { name: 'Join meeting', exact: true }).click();
    await page.getByTitle('Switch room layout').waitFor();
    const meetingWindow = page.locator('[data-room-window="open"]');
    await meetingWindow.waitFor();
    assert(await page.locator('section[aria-label="Office floor"]').isVisible(), 'The office floor is not retained behind the meeting window');
    assert(await page.getByRole('complementary', { name: 'Office floors' }).isVisible(), 'The floor overview disappeared behind the meeting window');
    await meetingWindow.getByTitle('Maximize room window').click();
    await meetingWindow.getByTitle('Restore room window').click();
    await meetingWindow.getByTitle('Minimize room').click();
    const minimizedMeeting = page.locator('[data-room-window="minimized"]');
    await minimizedMeeting.waitFor();
    await minimizedMeeting.locator('button').first().click();
    await page.locator('[data-room-window="open"]').waitFor();
    await page.locator('#btn-toggle-camera[title="Turn Camera On"]').waitFor();
    await page.locator('#meeting-toggle-camera').click();
    await page.locator('#btn-toggle-camera[title="Turn Camera Off"]').waitFor();
    await page.locator('#meeting-toggle-camera').click();
    await page.locator('#meeting-toggle-mic').click();
    await page.locator('#btn-toggle-mic[title="Unmute Microphone"]').waitFor();
    await page.locator('#meeting-toggle-mic').click();
    await page.locator('#btn-toggle-mic[title="Mute Microphone"]').waitFor();
    assert(await page.locator('[class*="FF5F56"], [class*="FFBD2E"], [class*="27C93F"]').count() === 0, 'macOS window dots remain in the meeting room');
    await page.getByTitle('Clap').last().click();
    await page.getByTitle('Raise Hand').click();
    await page.getByText('Hand raised').waitFor();
    await page.getByTitle('Raise Hand').click();
    await page.getByTitle('Switch room layout').click();
    await page.getByText('Speaker', { exact: true }).waitFor();
    await page.getByTitle('Switch room layout').click();
    await page.getByTitle('Present your screen').click();
    await page.getByTitle('Stop presenting').waitFor({ timeout: 10000 });
    await page.locator('[data-presentation-stage="true"]').waitFor({ timeout: 10000 });
    const presentationBox = await page.locator('[data-presentation-stage="true"] video').boundingBox();
    assert(presentationBox && presentationBox.width >= 700 && presentationBox.height >= 400, `Shared screen was not promoted to a large stage: ${JSON.stringify(presentationBox)}`);
    await page.getByTitle('Stop presenting').click();
    await page.locator('[data-presentation-stage="true"]').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Leave Room' }).last().click();
    await page.locator(`#btn-join-room-${sharedMeetingRoomId}`).waitFor();
    await page.locator(`#btn-join-room-${sharedMeetingRoomId}`).click();
    await page.getByRole('heading', { name: 'Choose how you enter' }).waitFor();
    await page.getByTitle('Turn microphone off before joining').click();
    await page.getByRole('button', { name: 'Join meeting', exact: true }).click();
    await page.getByTitle('Switch room layout').waitFor();
    await page.locator('#btn-toggle-camera[title="Turn Camera On"]').waitFor();
    await page.locator('#btn-toggle-mic[title="Unmute Microphone"]').waitFor();
    await page.locator('#meeting-toggle-mic').click();
    await page.locator('#btn-toggle-mic[title="Mute Microphone"]').waitFor();
    await page.getByRole('button', { name: 'Leave Room' }).last().click();
    await page.locator(`#btn-join-room-${sharedMeetingRoomId}`).click();
    await page.getByRole('heading', { name: 'Choose how you enter' }).waitFor();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  await step('Game lounge controls contain no inapplicable media buttons', async () => {
    await page.getByRole('button', { name: `Open ${auditFloor}` }).click();
    await page.locator(`#btn-join-room-${createdGameRoomId}`).click();
    await page.locator('[data-room-window="open"]').waitFor();
    assert(await page.getByTitle('Toggle Video').count() === 0, 'Game lounge incorrectly exposes camera controls');
    await page.getByTitle('Raise Hand').click();
    await page.getByRole('button', { name: 'Leave Room' }).last().click();
  });

  await step('Theater join and media controls', async () => {
    await page.locator(`#btn-join-room-${createdRoomId}`).click();
    await page.locator('[data-room-window="open"]').waitFor();
    await page.getByTitle('Toggle Video').waitFor();
    await page.getByTitle('Toggle Video').click();
    await page.getByTitle('Toggle Video').click();
    await page.getByRole('button', { name: 'Leave Room' }).last().click();
  });

  await step('Second-account onboarding, accepted knock, and admin isolation', async () => {
    const memberContext = await browser.newContext();
    await memberContext.grantPermissions(['camera', 'microphone'], { origin: baseURL });
    const memberPage = await memberContext.newPage();
    const showedFirstLoginNotice = await login(memberPage, auditUsername, auditPassword);
    assert(showedFirstLoginNotice, 'New account did not receive the one-time office notice');
    await memberPage.getByRole('button', { name: 'Open account menu' }).click();
    await memberPage.getByRole('button', { name: 'Sign out' }).click();
    const showedSecondLoginNotice = await login(memberPage, auditUsername, auditPassword);
    assert(!showedSecondLoginNotice, 'Office notice appeared more than once');
    assert(await memberPage.locator('#btn-bottom-schema').count() === 0, 'Schema explorer is visible to non-admin user');
    const analyticsStatus = await memberPage.evaluate(() => fetch('/api/admin/analytics').then((response) => response.status));
    assert(analyticsStatus === 403, `Non-admin analytics request returned HTTP ${analyticsStatus}`);

    await page.locator(`#btn-knock-${createdUserId}`).click();
    await memberPage.locator('[data-knock-ringing="true"]').waitFor();
    await memberPage.waitForTimeout(2400);
    assert(await memberPage.locator('[data-knock-ringing="true"]').count() === 1, 'Incoming knock stopped ringing before it was answered');
    await memberPage.getByRole('button', { name: 'Accept & Join' }).click();
    await memberPage.locator('[data-knock-ringing="true"]').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Leave office' }).waitFor({ timeout: 10000 });
    await memberPage.getByRole('button', { name: 'Leave office' }).waitFor({ timeout: 10000 });
    await page.locator('section[aria-label="Office floor"]').getByRole('heading', { name: auditFloor }).waitFor();
    await memberPage.locator('section[aria-label="Office floor"]').getByRole('heading', { name: auditFloor }).waitFor();
    await page.locator(`#room-card-${createdPersonalRoomId}`).getByRole('img', { name: 'UI Audit User' }).waitFor({ timeout: 15000 });
    await memberPage.locator(`#room-card-${createdPersonalRoomId} img`).nth(1).waitFor({ timeout: 15000 });
    const adminAudio = page.locator('audio[data-remote-office-audio]');
    const memberAudio = memberPage.locator('audio[data-remote-office-audio]');
    await adminAudio.waitFor({ state: 'attached', timeout: 15000 });
    await memberAudio.waitFor({ state: 'attached', timeout: 15000 });
    const inspectRemoteAudio = (audio) => audio.evaluate((element) => ({
      paused: element.paused,
      readyState: element.readyState,
      tracks: element.srcObject?.getAudioTracks().map((track) => ({ enabled: track.enabled, muted: track.muted, readyState: track.readyState })) || [],
    }));
    const waitForLiveRemoteAudio = async (audio, targetPage) => {
      let state;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        state = await inspectRemoteAudio(audio);
        if (!state.paused && state.readyState >= 2 && state.tracks[0]?.enabled && !state.tracks[0]?.muted && state.tracks[0]?.readyState === 'live') return state;
        await targetPage.waitForTimeout(250);
      }
      return state;
    };
    const [adminRemoteAudio, memberRemoteAudio] = await Promise.all([waitForLiveRemoteAudio(adminAudio, page), waitForLiveRemoteAudio(memberAudio, memberPage)]);
    assert(!adminRemoteAudio.paused && adminRemoteAudio.readyState >= 2 && adminRemoteAudio.tracks[0]?.enabled && !adminRemoteAudio.tracks[0]?.muted && adminRemoteAudio.tracks[0]?.readyState === 'live', `Admin did not receive live office audio: ${JSON.stringify(adminRemoteAudio)}`);
    assert(!memberRemoteAudio.paused && memberRemoteAudio.readyState >= 2 && memberRemoteAudio.tracks[0]?.enabled && !memberRemoteAudio.tracks[0]?.muted && memberRemoteAudio.tracks[0]?.readyState === 'live', `Member did not receive live office audio: ${JSON.stringify(memberRemoteAudio)}`);

    await page.locator(`#room-card-${createdPersonalRoomId}`).getByRole('img', { name: 'UI Audit User' }).click();
    const profileMenu = page.getByRole('menu', { name: 'UI Audit User actions' });
    await profileMenu.waitFor();
    await profileMenu.getByRole('menuitem', { name: 'Chat' }).click();
    const chatWindow = page.getByRole('dialog', { name: 'Messages' });
    await chatWindow.waitFor();
    await chatWindow.getByTitle('Maximize messages').click();
    await chatWindow.getByTitle('Restore messages').click();
    await chatWindow.getByTitle('Minimize messages').click();
    await page.getByRole('dialog', { name: 'Messages' }).getByRole('button', { name: /^Messages/ }).click();
    await page.getByPlaceholder('Write a message…').fill('Production direct-message validation');
    await page.getByPlaceholder('Write a message…').press('Enter');
    await page.getByText('Production direct-message validation').waitFor();

    const groupResult = await page.evaluate(({ memberId, name }) => fetch('/api/admin/chat/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'channel', name, isPrivate: true, memberIds: [memberId] }) }).then(async (response) => ({ status: response.status, body: await response.json() })), { memberId: createdUserId, name: `UI Audit Channel ${suffix}` });
    assert(groupResult.status === 201 && groupResult.body.conversation?.id, `Private channel creation failed: HTTP ${groupResult.status}`);
    createdConversationId = groupResult.body.conversation.id;
    const memberConversations = await memberPage.evaluate(() => fetch('/api/chat/conversations').then((response) => response.json()));
    assert(memberConversations.some((conversation) => conversation.id === createdConversationId), 'Private channel is unavailable to its invited member');
    const forbiddenCreate = await memberPage.evaluate(() => fetch('/api/admin/chat/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'group', name: 'Forbidden group', isPrivate: true, memberIds: [] }) }).then((response) => response.status));
    assert(forbiddenCreate === 403, `Non-owner channel creation returned HTTP ${forbiddenCreate}`);
    await page.getByRole('button', { name: 'Leave office' }).click();
    await memberPage.getByRole('button', { name: 'Leave office' }).click();

    const dmAudit = await page.evaluate((memberId) => fetch('/api/chat/conversations').then((response) => response.json()).then(async (conversations) => {
      const dm = conversations.find((conversation) => conversation.type === 'dm' && conversation.members.some((member) => member.id === memberId));
      return dm ? { id: dm.id, messages: await fetch(`/api/chat/conversations/${dm.id}/messages`).then((response) => response.json()) } : null;
    }), createdUserId);
    assert(dmAudit, 'Direct-message conversation was not persisted');
    for (const eventType of ['call_started', 'call_accepted', 'office_entered', 'office_left', 'call_ended']) assert(dmAudit.messages.some((message) => message.eventType === eventType), `DM call log is missing ${eventType}`);
    assert(dmAudit.messages.some((message) => message.content === 'Production direct-message validation'), 'Direct message was not persisted');
    await page.evaluate((id) => fetch(`/api/admin/chat/conversations/${id}`, { method: 'DELETE' }), createdConversationId);
    createdConversationId = undefined;

    await memberPage.getByRole('button', { name: 'Open account menu' }).click();
    assert(await memberPage.getByRole('button', { name: 'Owner dashboard' }).count() === 0, 'Owner console is visible to non-admin user');
    await memberPage.getByRole('button', { name: 'Sign out' }).click();
    await memberPage.getByRole('button', { name: 'Enter office' }).waitFor();
    await memberContext.close();
  });

  await step('Temporary account and room cleanup through owner UI', async () => {
    await page.getByRole('button', { name: 'Open account menu' }).click();
    await page.getByRole('button', { name: 'Owner dashboard' }).click();
    await page.getByRole('button', { name: 'Accounts & access' }).click();
    await page.getByRole('button', { name: new RegExp(`UI Audit User.*@${auditUsername}`) }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete account' }).click();
    await page.getByText('Account deleted.').waitFor();
    createdUserId = undefined;
    const roomsAfterAccountDelete = await page.evaluate(() => fetch('/api/rooms').then((response) => response.json()));
    assert(!roomsAfterAccountDelete.some((room) => room.id === createdPersonalRoomId), 'Personal office remained after account deletion');
    createdPersonalRoomId = undefined;
    await page.getByRole('button', { name: 'Rooms', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(auditRoom) }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete room' }).click();
    await page.getByText('Room deleted.').waitFor();
    createdRoomId = undefined;
    await page.evaluate((id) => fetch(`/api/admin/rooms/${id}`, { method: 'DELETE' }), createdGameRoomId);
    createdGameRoomId = undefined;
    await page.getByRole('button', { name: 'Floors', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^Floor \\d+\\s+${auditFloor}`) }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete floor' }).click();
    await page.getByText('Floor deleted and its spaces reassigned.').waitFor();
    createdFloorId = undefined;
  });

  assert(runtimeErrors.length === 0, `Browser runtime errors:\n${runtimeErrors.join('\n')}`);
  process.stdout.write(`\n${results.length} production UI groups passed without browser runtime errors.\n`);
} finally {
  if (createdUserId) await page.evaluate((id) => fetch(`/api/admin/users/${id}`, { method: 'DELETE' }), createdUserId).catch(() => {});
  if (createdRoomId) await page.evaluate((id) => fetch(`/api/admin/rooms/${id}`, { method: 'DELETE' }), createdRoomId).catch(() => {});
  if (createdGameRoomId) await page.evaluate((id) => fetch(`/api/admin/rooms/${id}`, { method: 'DELETE' }), createdGameRoomId).catch(() => {});
  if (createdFloorId) await page.evaluate((id) => fetch(`/api/admin/floors/${id}`, { method: 'DELETE' }), createdFloorId).catch(() => {});
  if (createdConversationId) await page.evaluate((id) => fetch(`/api/admin/chat/conversations/${id}`, { method: 'DELETE' }), createdConversationId).catch(() => {});
  await context.close();
  await browser.close();
}
