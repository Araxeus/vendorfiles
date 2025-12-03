import crypto from 'node:crypto';
import os from 'node:os';
import { Entry } from '@napi-rs/keyring';
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import open from 'open';
import { assert, error, getPackageJson, success, warning } from './utils.js';

const keyring = new Entry('vendorfiles-cli', 'github_token');

const h = os.hostname();
const v = (await getPackageJson()).name as string;
const he = (e: string) => `${h}-${v[0]}${v[6]}${v[10]}${e}`;
const cipher = {
    key: crypto
        .createHash('sha256')
        .update(he('daab511784574ec8a96cecf86cd10353'))
        .digest()
        .subarray(0, 0x20),
    iv: crypto
        .createHash('sha256')
        .update(he('21ft0as6vba96zxcpqaha1bsflv'))
        .digest()
        .subarray(0, 0x10),
};

const getKeyringToken = () => {
    try {
        const encryptedToken = keyring.getPassword();
        if (encryptedToken) return decryptToken(encryptedToken);
        return null;
    } catch {
        return null;
    }
};

const saveTokenToKeyring = (token: string) => {
    try {
        keyring.setPassword(encryptToken(token));
        return true;
    } catch {
        warning('Failed to save token to keyring');
        return false;
    }
};

export const token = process.env.GITHUB_TOKEN || getKeyringToken() || undefined;

export async function login(token?: string) {
    if (token) {
        const res = await fetch('https://api.github.com', {
            cache: 'no-store',
            method: 'HEAD',
            headers: {
                Authorization: `bearer ${token}`,
            },
        });

        assert(res.status !== 401, 'Invalid token');
        assert(res.status !== 403, 'Token is rate limited');
        assert(res.ok, 'Something went wrong, try again later');
        saveTokenToKeyring(token);
        success('Token saved successfully');
        return;
    }
    try {
        const auth = createOAuthDeviceAuth({
            clientType: 'oauth-app',
            clientId: '39d3104ecbbfd876dfa5',
            scopes: [],
            async onVerification(verification) {
                console.log(
                    `First, copy your one-time code: ${verification.user_code}`,
                );
                console.log(
                    'Then press [Enter] to continue in your web browser',
                );
                await new Promise(resolve => {
                    process.stdin.once('data', resolve);
                });
                console.log('Opening your web browser...');
                await open(verification.verification_uri);
            },
        });

        const tokenAuthentication = await auth({
            type: 'oauth',
        });

        saveTokenToKeyring(tokenAuthentication.token);

        success('Logged in successfully');
    } catch (e) {
        error(e as string);
    } finally {
        process.exit(0);
    }
}

function encryptToken(token: string) {
    const c = crypto.createCipheriv('aes-256-cbc', cipher.key, cipher.iv);
    return c.update(token, 'utf8', 'base64') + c.final('base64');
}

function decryptToken(encryptedToken: string) {
    try {
        const d = crypto.createDecipheriv('aes-256-cbc', cipher.key, cipher.iv);
        return d.update(encryptedToken, 'base64', 'utf8') + d.final('utf8');
    } catch {
        warning('Failed to decrypt token:');
        return undefined;
    }
}
