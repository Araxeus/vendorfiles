import { Entry } from '@napi-rs/keyring';

const keyring = new Entry('vendorfiles-cli', 'github_token');

let password = process.env.GITHUB_TOKEN || keyring.getPassword() || undefined;

export const get = () => password;

export const set = (newToken: string) => {
    keyring.setPassword(newToken);
    password = newToken;
};
