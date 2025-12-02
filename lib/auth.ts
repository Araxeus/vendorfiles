import { Entry } from '@napi-rs/keyring';
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import open from 'open';
import { assert, error, success } from './utils.js';

const keyring = new Entry('vendorfiles-cli', 'github_token');

export const token =
    process.env.GITHUB_TOKEN || keyring.getPassword() || undefined;

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
        keyring.setPassword(token);
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

        keyring.setPassword(tokenAuthentication.token);

        success('Logged in successfully');
    } catch (e) {
        error(e as string);
    } finally {
        process.exit(0);
    }
}
