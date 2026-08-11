import { chromium } from 'playwright';

const baseURL = process.env.APP_URL || 'https://91-107-242-1.sslip.io';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';
const suffix = Date.now().toString().slice(-8);
const auditUsername = `ui_audit_${suffix}`;
const auditPassword = 'Audit12345!';
const auditRoom = `UI Audit Theater ${suffix}`;
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
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--auto-select-desktop-capture-source=Entire screen',
  ],
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

try {
  await step('HTTPS login and password visibility', async () => {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    const password = page.getByPlaceholder('Your password');
    assert(await password.getAttribute('type') === 'password', 'Password is not initially masked');
    await password.locator('xpath=..').getByRole('button').click();
    assert(await password.getAttribute('type') === 'text', 'Password visibility button failed');
    await page.getByPlaceholder('your.username').fill('admin');
    await password.fill(adminPassword);
    await page.getByRole('button', { name: 'Enter office' }).click();
    await page.getByText('Creativeprocess Office', { exact: true }).waitFor();
    assert(page.url().startsWith('https://'), 'App is not using HTTPS');
  });

  await step('Top bar sound and presence status controls', async () => {
    await page.getByTitle('Toggle sounds').click();
    await page.getByRole('button', { name: /Online/ }).click();
    await page.getByRole('button', { name: 'Away', exact: true }).click();
    await page.getByRole('button', { name: /Away/ }).click();
    await page.getByRole('button', { name: 'Online', exact: true }).click();
  });

  await step('Sidebar filters, collapse, and expand', async () => {
    const search = page.getByPlaceholder('Find a colleague');
    await search.fill('admin');
    await page.getByRole('button', { name: /Everyone/ }).click();
    await search.fill('');
    const sidebar = page.locator('aside').first();
    await sidebar.locator('button').first().click();
    await page.waitForTimeout(150);
    await page.locator('aside').first().locator('button').first().click();
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
    await page.getByRole('button', { name: /Admin/ }).click();
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: /Admin/ }).click();
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await page.getByPlaceholder('e.g. Reviewing UI Figma specs').fill('Production UI audit');
    await page.getByRole('button', { name: 'Save Presence' }).click();
    await page.getByText('Edit Profile & Presence Badges').waitFor({ state: 'detached' });
  });

  await step('Owner analytics and account creation', async () => {
    await page.getByRole('button', { name: /Admin/ }).click();
    await page.getByRole('button', { name: 'Owner dashboard' }).click();
    await page.getByText('Room utilization').waitFor();
    await page.getByRole('button', { name: 'Accounts & access' }).click();
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByLabel('Display name').fill('UI Audit User');
    await page.getByLabel('Username').fill(auditUsername);
    await page.getByLabel('Role / title').fill('QA Auditor');
    await page.getByLabel('Temporary password').fill(auditPassword);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByText('Account created.').waitFor();
    const users = await page.evaluate(() => fetch('/api/users').then((response) => response.json()));
    createdUserId = users.find((user) => user.username === auditUsername)?.id;
    assert(createdUserId, 'Created account was not returned by the API');
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
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByLabel('Room name').fill(auditRoom);
    await page.getByLabel('Room type').selectOption('theater');
    await page.getByLabel('Capacity').fill('6');
    await page.getByLabel('Description').fill('Temporary production validation room');
    await page.getByRole('button', { name: 'Create room' }).click();
    await page.getByText('Room created.').waitFor();
    const rooms = await page.evaluate(() => fetch('/api/rooms').then((response) => response.json()));
    createdRoomId = rooms.find((room) => room.name === auditRoom)?.id;
    assert(createdRoomId, 'Created room was not returned by the API');
    await page.getByRole('button', { name: new RegExp(auditRoom) }).click();
    await page.getByRole('heading', { name: 'Edit room' }).waitFor();
    await page.getByLabel('Capacity').fill('7');
    const updateResponse = page.waitForResponse((response) => response.url().includes(`/api/admin/rooms/${createdRoomId}`) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Save room' }).click();
    const roomResponse = await updateResponse;
    assert(roomResponse.ok(), `Room update returned HTTP ${roomResponse.status()} for ${roomResponse.request().postData()}: ${await roomResponse.text()}`);
    await page.getByText('Room updated.').waitFor();
    await page.getByRole('button', { name: 'Overview' }).click();
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
    await page.getByTitle('Close owner console').click();
    await page.getByText('Administration').waitFor({ state: 'detached' });
  });

  await step('Meeting camera and microphone physical track controls', async () => {
    const joinCount = await page.getByRole('button', { name: 'Join Meeting Room' }).count();
    assert(joinCount > 0, `Meeting join button missing. Buttons present: ${(await page.getByRole('button').allTextContents()).join(' | ')}`);
    await page.getByRole('button', { name: 'Join Meeting Room' }).first().click();
    await page.getByText('(You)').waitFor();
    const trackCounts = async () => page.locator('video').first().evaluate((video) => ({
      audio: video.srcObject?.getAudioTracks().length ?? 0,
      video: video.srcObject?.getVideoTracks().length ?? 0,
    }));
    await page.waitForFunction(() => document.querySelector('video')?.srcObject?.getVideoTracks().length === 1);
    assert((await trackCounts()).video === 1, 'Camera track did not start');
    await page.getByTitle('Toggle Video').click();
    await page.waitForFunction(() => !document.querySelector('video') || document.querySelector('video').srcObject?.getVideoTracks().length === 0);
    await page.getByTitle('Toggle Video').click();
    await page.waitForFunction(() => document.querySelector('video')?.srcObject?.getVideoTracks().length === 1);
    await page.getByTitle('Toggle Mic').click();
    await page.waitForTimeout(250);
    await page.getByTitle('Toggle Mic').click();
    await page.waitForTimeout(250);
  });

  await step('Meeting reaction, hand, layout, screen presentation, and leave', async () => {
    await page.getByTitle('Clap').last().click();
    await page.getByTitle('Raise Hand').click();
    await page.getByText('Hand raised').waitFor();
    await page.getByTitle('Raise Hand').click();
    await page.getByTitle('Switch room layout').click();
    await page.getByText('Speaker', { exact: true }).waitFor();
    await page.getByTitle('Switch room layout').click();
    await page.getByTitle('Present your screen').click();
    await page.getByTitle('Stop presenting').waitFor({ timeout: 10000 });
    await page.getByTitle('Stop presenting').click();
    await page.getByRole('button', { name: 'Leave Room' }).last().click();
    await page.getByRole('button', { name: 'Join Meeting Room' }).first().waitFor();
  });

  await step('Game lounge controls contain no inapplicable media buttons', async () => {
    await page.getByRole('button', { name: 'Join Game Lounge' }).first().click();
    assert(await page.getByTitle('Toggle Video').count() === 0, 'Game lounge incorrectly exposes camera controls');
    await page.getByTitle('Raise Hand').click();
    await page.getByRole('button', { name: 'Leave Room' }).last().click();
  });

  await step('Theater join and media controls', async () => {
    await page.getByRole('button', { name: 'Join Theater' }).filter({ hasText: 'Join Theater' }).last().click();
    await page.getByTitle('Toggle Video').waitFor();
    await page.getByTitle('Toggle Video').click();
    await page.getByTitle('Toggle Video').click();
    await page.getByRole('button', { name: 'Leave Room' }).last().click();
  });

  await step('Second-account login and admin control isolation', async () => {
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await login(memberPage, auditUsername, auditPassword);
    assert(await memberPage.locator('#btn-bottom-schema').count() === 0, 'Schema explorer is visible to non-admin user');
    await memberPage.getByRole('button', { name: /UI Audit User/ }).click();
    assert(await memberPage.getByRole('button', { name: 'Owner dashboard' }).count() === 0, 'Owner console is visible to non-admin user');
    await memberPage.getByRole('button', { name: 'Sign out' }).click();
    await memberPage.getByRole('button', { name: 'Enter office' }).waitFor();
    await memberContext.close();
  });

  await step('Temporary account and room cleanup through owner UI', async () => {
    await page.getByRole('button', { name: /Admin/ }).click();
    await page.getByRole('button', { name: 'Owner dashboard' }).click();
    await page.getByRole('button', { name: 'Accounts & access' }).click();
    await page.getByRole('button', { name: new RegExp(`UI Audit User.*@${auditUsername}`) }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete account' }).click();
    await page.getByText('Account deleted.').waitFor();
    createdUserId = undefined;
    await page.getByRole('button', { name: 'Rooms', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(auditRoom) }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete room' }).click();
    await page.getByText('Room deleted.').waitFor();
    createdRoomId = undefined;
  });

  assert(runtimeErrors.length === 0, `Browser runtime errors:\n${runtimeErrors.join('\n')}`);
  process.stdout.write(`\n${results.length} production UI groups passed without browser runtime errors.\n`);
} finally {
  if (createdUserId) await page.evaluate((id) => fetch(`/api/admin/users/${id}`, { method: 'DELETE' }), createdUserId).catch(() => {});
  if (createdRoomId) await page.evaluate((id) => fetch(`/api/admin/rooms/${id}`, { method: 'DELETE' }), createdRoomId).catch(() => {});
  await context.close();
  await browser.close();
}
