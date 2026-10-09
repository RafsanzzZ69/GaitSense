import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { screen } from './helpers/auth-screen-harness.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('Welcome exposes real email actions and no Google/demo/medical claims', () => {
  const h = screen('welcome');
  h.button('Sign in with email').onPress(); h.button('Create account').onPress();
  assert.deepEqual(h.navigations, [['push', '/account/sign-in'], ['push', '/account/create']]);
  assert.match(h.text(), /shared across accounts on this device/);
  assert.match(h.text(), /Sign in requires internet/);
  assert.match(h.text(), /saved sign-in is restored.*work offline/);
  assert.doesNotMatch(h.text(), /without signing in|later checkpoint/);
  assert.doesNotMatch(h.text(), /Google|demo account|health score|fall risk|validated medical/i);
});
test('restoring/error account controls cannot bypass protected app entry', () => {
  const h = screen('welcome', { status: 'RESTORING' });
  assert.equal(h.button('Sign in with email').disabled, true);
  assert.equal(h.nodes.some(n => n.props?.accessibilityLabel === 'Return to Home'), false);
  const e = screen('welcome', { status: 'ERROR' });
  e.button('Retry account access').onPress(); assert.deepEqual(e.operations, [['retry']]);
  assert.match(e.text(), /local measurements have not been deleted/);
  assert.equal(e.nodes.some(n => n.props?.accessibilityLabel === 'Return to Home'), false);
});
test('form fields support autofill, obscured passwords, paste and accessible show/hide', () => {
  const h = screen('register');
  assert.equal(h.field('Email').keyboardType, 'email-address');
  assert.equal(h.field('Password').autoComplete, 'new-password');
  assert.equal(h.field('Confirm password').textContentType, 'newPassword');
  assert.equal(h.field('Password').secureTextEntry, true);
  assert.equal(h.field('Password').importantForAutofill, 'yes');
  assert.equal(h.field('Password').contextMenuHidden, undefined);
  h.button('Show password').onPress(); h.render();
  assert.equal(h.field('Password').secureTextEntry, false);
  assert.equal(h.field('Confirm password').secureTextEntry, false);
  assert.ok(h.button('Hide password').style({ pressed: false })[0].minHeight >= 48);
  const login = screen('login'); assert.equal(login.field('Password').autoComplete, 'current-password');
});
test('invalid email/password confirmation stops before any adapter operation', async () => {
  const h = screen('register'); h.fill('invalid', 'a', 'b'); h.button('Create account').onPress(); h.render();
  assert.match(h.text(), /valid email/); assert.equal(h.operations.length, 0);
  h.fill('fixture@example.test', 'a', 'b'); h.button('Create account').onPress(); h.render();
  assert.match(h.text(), /do not match/); assert.equal(h.operations.length, 0);
});
for (const [mode, label] of [['register', 'Create account'], ['login', 'Sign in'], ['reset', 'Send reset instructions']]) {
  test(`${mode} handler prevents rapid submits, clears passwords and waits for SDK session`, async () => {
    let resolve;
    const h = screen(mode, { run: () => new Promise(done => { resolve = done; }) }); h.fill();
    const button = h.button(label); button.onPress(); button.onPress();
    assert.equal(h.operations.length, 1); assert.equal(h.operations[0][0], mode);
    h.render(); assert.equal(h.button('Please wait…').disabled, true);
    resolve({ ok: true, message: 'Operation accepted' }); await flush(); h.render();
    assert.deepEqual(h.navigations, []); // no fabricated session from success
    if (mode !== 'reset') assert.equal(h.field('Password').value, '');
    if (mode === 'register') assert.equal(h.field('Confirm password').value, '');
    assert.match(h.text(), /Operation accepted/);
    if (mode !== 'reset') {
      h.auth.session = { status: 'SIGNED_IN', user: { uid: 'fixture', emailVerified: false } }; h.render(); h.render();
      assert.deepEqual(h.navigations, [['dismissAll'], ['replace', mode === 'register' ? '/account/verification' : '/']]);
    }
  });
}
test('reset provides only email input and displays neutral confirmation', async () => {
  const message = 'If an account can receive a reset email, instructions will be sent.';
  const h = screen('reset', { run: async () => ({ ok: true, message }) }); h.fill();
  assert.equal(h.nodes.filter(n => n.type === 'TextInput').length, 1);
  h.button('Send reset instructions').onPress(); await flush(); h.render();
  assert.match(h.text(), /If an account can receive/);
});
test('verification never refreshes on mount, bounds rapid requests and lets unverified user continue', async () => {
  let resolve; const h = screen('verification', { signedIn: true, run: () => new Promise(done => { resolve = done; }) });
  assert.deepEqual(h.operations, []); assert.match(h.text(), /does not block local gait/);
  const button = h.button('I have verified — refresh'); button.onPress(); button.onPress();
  assert.equal(h.operations.length, 1); assert.equal(h.operations[0][0], 'refresh');
  h.render(); assert.equal(h.button('Resend verification email').disabled, true);
  h.button('Continue to local app').onPress();
  assert.deepEqual(h.navigations, [['dismissAll'], ['replace', '/']]);
  h.unmount(); const before = h.updates;
  resolve({ ok: true, message: 'Verified' }); await flush(); assert.equal(h.updates, before);
});
test('resend is explicit; verified status appears only from provider snapshot', async () => {
  const h = screen('verification', { signedIn: true });
  h.button('Resend verification email').onPress(); h.button('Resend verification email').onPress(); await flush();
  assert.equal(h.operations.length, 1); assert.equal(h.operations[0][0], 'resend');
  h.render(); assert.doesNotMatch(h.text(), /Firebase reports that your email is verified/);
  h.auth.session.user.emailVerified = true; h.render(); assert.match(h.text(), /Firebase reports that your email is verified/);
});

for (const mode of ['login', 'register', 'reset']) {
  test(`already signed in: ${mode} has no parallel credential form and replaces toward app`, () => {
    const h = screen(mode, { signedIn: true }); h.render();
    assert.equal(h.nodes.some(node => node.type === 'TextInput'), false);
    assert.deepEqual(h.operations, []);
    assert.deepEqual(h.navigations, [['dismissAll'], ['replace', mode === 'register' ? '/account/verification' : '/']]);
  });
}
test('auth route variants are real Android screens and safe generic redirects; legacy routes remain transitional', () => {
  for (const [name, mode] of [['index', 'welcome'], ['sign-in', 'login'], ['create', 'register'], ['reset', 'reset'], ['verification', 'verification']]) {
    assert.match(read(`src/app/account/${name}.android.tsx`), new RegExp(`AuthScreen mode='${mode}'`));
    assert.match(read(`src/app/account/${name}.tsx`), /Redirect href='\/'/);
  }
  assert.match(read('src/app/account/_layout.tsx'), /Redirect href="\/"/);
  assert.match(read('src/app/login.android.tsx'), /href="\/offline"/);
  assert.match(read('src/app/register.android.tsx'), /href="\/offline"/);
});
